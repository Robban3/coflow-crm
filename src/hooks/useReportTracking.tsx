import { useEffect, useRef, useCallback } from "react";

interface TrackEvent {
  type: string;
  name?: string;
  valueInt?: number;
  meta?: Record<string, unknown>;
}

const FLUSH_INTERVAL = 2000;
const MAX_BATCH = 10;
const HEARTBEAT_INTERVAL = 15000;

/**
 * Client-side tracking for public report pages.
 * Fail-safe: errors never affect rendering.
 */
export function useReportTracking(token: string | undefined) {
  const sessionKey = useRef<string>("");
  const queue = useRef<TrackEvent[]>([]);
  const flushing = useRef(false);
  const sentSections = useRef(new Set<string>());
  const sentDepths = useRef(new Set<number>());
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);

  // Initialize session key
  useEffect(() => {
    if (!token) return;
    mounted.current = true;

    const storageKey = `rt_session_${token}`;
    let key = sessionStorage.getItem(storageKey);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
    }
    sessionKey.current = key;

    // Send initial view event
    enqueue({ type: "view" });

    // Flush timer
    flushTimer.current = setInterval(flush, FLUSH_INTERVAL);

    // Heartbeat (pauses when hidden)
    let visible = true;
    const startHeartbeat = () => {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = setInterval(() => {
        if (visible) enqueue({ type: "heartbeat" });
      }, HEARTBEAT_INTERVAL);
    };

    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    startHeartbeat();

    // Scroll depth tracking
    const scrollThresholds = [25, 50, 75, 100];
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((scrollTop / docHeight) * 100);
      for (const t of scrollThresholds) {
        if (pct >= t && !sentDepths.current.has(t)) {
          sentDepths.current.add(t);
          enqueue({ type: "scroll_depth", valueInt: t });
        }
      }
    };
    let scrollRaf: number | null = null;
    const throttledScroll = () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        onScroll();
        scrollRaf = null;
      });
    };
    window.addEventListener("scroll", throttledScroll, { passive: true });

    // Section observation via IntersectionObserver
    const sectionMap: Record<string, string> = {
      "growth-report-section": "section",
    };
    // We'll use data-track-section attributes
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            const name = (entry.target as HTMLElement).dataset.trackSection;
            if (name && !sentSections.current.has(name)) {
              sentSections.current.add(name);
              enqueue({ type: "section_view", name });
            }
          }
        }
      },
      { threshold: 0.35 }
    );

    // Observe after a short delay to let DOM render
    const observeTimer = setTimeout(() => {
      document.querySelectorAll("[data-track-section]").forEach((el) => {
        observer.observe(el);
      });
    }, 1000);

    // Flush on page unload
    const onUnload = () => {
      flush(true);
    };
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      mounted.current = false;
      flush(true);
      if (flushTimer.current) clearInterval(flushTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      clearTimeout(observeTimer);
      observer.disconnect();
      window.removeEventListener("scroll", throttledScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [token]);

  const enqueue = useCallback((event: TrackEvent) => {
    queue.current.push(event);
    if (queue.current.length >= MAX_BATCH) {
      flush();
    }
  }, []);

  const flush = useCallback((useBeacon = false) => {
    if (!token || !sessionKey.current || queue.current.length === 0) return;
    if (flushing.current && !useBeacon) return;

    const events = queue.current.splice(0, 20);
    if (events.length === 0) return;

    const payload = JSON.stringify({
      token,
      sessionKey: sessionKey.current,
      events,
      referrer: document.referrer?.slice(0, 200) || null,
    });

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-track`;

    if (useBeacon && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(
          url,
          new Blob([payload], { type: "application/json" })
        );
      } catch {
        // silent fail
      }
      return;
    }

    flushing.current = true;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: payload,
      keepalive: true,
    })
      .catch(() => {
        // silent fail — re-enqueue if still mounted
        if (mounted.current) {
          queue.current.unshift(...events);
        }
      })
      .finally(() => {
        flushing.current = false;
      });
  }, [token]);

  // Public API for CTA click tracking
  const trackCta = useCallback(
    (name: string) => {
      enqueue({ type: "cta_click", name });
      // Flush immediately for CTA clicks
      setTimeout(() => flush(), 50);
    },
    [enqueue, flush]
  );

  const trackPdf = useCallback(() => {
    enqueue({ type: "pdf_click" });
    setTimeout(() => flush(), 50);
  }, [enqueue, flush]);

  const trackShare = useCallback(() => {
    enqueue({ type: "share_click" });
    setTimeout(() => flush(), 50);
  }, [enqueue, flush]);

  return { trackCta, trackPdf, trackShare };
}

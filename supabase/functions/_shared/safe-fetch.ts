// SSRF-safe fetcher for the Deno edge runtime.
//
// Replaces the four-line guard in geo-quick-scan/index.ts, which missed
// 169.254.169.254 (cloud metadata), all IPv6, 127.x other than 127.0.0.1,
// decimal/hex IP encodings, and every redirect — while over-blocking all of
// 172.0–172.255 instead of just 172.16–31.
//
// Runtime note: unlike the Node original this is ported from, Deno Edge has no
// node:dns / node:net. Where Deno.resolveDns is available we resolve and
// validate the addresses; where it is not we fall back to hostname/IP-literal
// analysis plus per-hop redirect revalidation. That leaves DNS rebinding open —
// a hostname resolving to a private address cannot be caught without a
// resolver. Compensating controls: no credentials are ever forwarded, response
// bodies are size-capped, and callers must not echo raw bodies back to users.

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "169.254.169.254",
  "instance-data",
  "broadcasthost",
]);

export class SafeFetchError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SafeFetchError";
  }
}

function isIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

function ipv4ToLong(ip: string): number {
  const p = ip.split(".").map(Number);
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}

export function isPrivateOrReservedV4(ip: string): boolean {
  const n = ipv4ToLong(ip);
  const inRange = (base: string, mask: number) => {
    const b = ipv4ToLong(base);
    const m = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
    return (n & m) === (b & m);
  };
  return (
    inRange("0.0.0.0", 8) ||
    inRange("10.0.0.0", 8) ||
    inRange("100.64.0.0", 10) ||     // CGNAT
    inRange("127.0.0.0", 8) ||
    inRange("169.254.0.0", 16) ||    // link-local, incl. cloud metadata
    inRange("172.16.0.0", 12) ||     // NOT all of 172.x
    inRange("192.0.0.0", 24) ||
    inRange("192.168.0.0", 16) ||
    inRange("198.18.0.0", 15) ||     // benchmarking
    inRange("224.0.0.0", 4) ||       // multicast
    inRange("240.0.0.0", 4) ||       // reserved
    ip === "255.255.255.255"
  );
}

// `::ffff:127.0.0.1` and `::ffff:7f00:1` are the same address.
function v4FromMapped(lower: string): string | null {
  if (!lower.startsWith("::ffff:")) return null;
  const tail = lower.slice(7);
  if (isIPv4(tail)) return tail;
  const m = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(tail);
  if (!m) return null;
  const hi = parseInt(m[1], 16);
  const lo = parseInt(m[2], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join(".");
}

export function isPrivateOrReservedV6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (lower === "::" || lower === "::1") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("ff")) return true; // multicast
  const mapped = v4FromMapped(lower);
  if (mapped) return isPrivateOrReservedV4(mapped);
  return false;
}

function looksLikeIPv6(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, "");
  return bare.includes(":");
}

/** Throws SafeFetchError when the hostname must not be fetched. */
export async function assertHostSafe(hostname: string): Promise<void> {
  const host = hostname.toLowerCase();
  if (!host) throw new SafeFetchError("blocked_host", "Empty hostname");
  if (BLOCKED_HOSTS.has(host)) throw new SafeFetchError("blocked_host", `Blocked host: ${host}`);
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    throw new SafeFetchError("blocked_host", `Blocked host: ${host}`);
  }

  const bare = host.replace(/^\[|\]$/g, "");

  // Bare IP literals are refused outright — they bypass the hostname denylist.
  // (WHATWG URL already normalises decimal/octal/hex forms such as
  // http://2130706433/ to dotted quad, so this catches those too. The
  // all-digits test is belt-and-braces for anything that slips through.)
  if (isIPv4(bare)) {
    throw new SafeFetchError("blocked_host", "IP-literal hostnames not allowed");
  }
  if (looksLikeIPv6(bare)) {
    throw new SafeFetchError("blocked_host", "IP-literal hostnames not allowed");
  }
  if (/^\d+$/.test(bare)) {
    throw new SafeFetchError("blocked_host", "Numeric hostnames not allowed");
  }

  // Resolve where the runtime allows it.
  const resolveDns = (globalThis as any).Deno?.resolveDns;
  if (typeof resolveDns !== "function") return;

  const addrs: string[] = [];
  for (const kind of ["A", "AAAA"] as const) {
    try {
      const res = await resolveDns(host, kind);
      if (Array.isArray(res)) addrs.push(...res);
    } catch {
      // NXDOMAIN for one family is normal; handled by the empty check below.
    }
  }
  if (addrs.length === 0) return; // resolution unavailable/blocked — not proof of danger

  for (const addr of addrs) {
    if (isIPv4(addr) && isPrivateOrReservedV4(addr)) {
      throw new SafeFetchError("blocked_ip", `Blocked private/reserved IP ${addr} for ${host}`);
    }
    if (addr.includes(":") && isPrivateOrReservedV6(addr)) {
      throw new SafeFetchError("blocked_ip", `Blocked private/reserved IPv6 ${addr} for ${host}`);
    }
  }
}

export type SafeFetchResult = {
  ok: boolean;
  status: number;
  finalUrl: string;
  finalHost: string;
  headers: Record<string, string>;
  body: string;
  redirectChain: string[];
};

async function readBounded(res: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        if (received + value.length > maxBytes) {
          try { await reader.cancel(); } catch { /* noop */ }
          break;
        }
        received += value.length;
        chunks.push(value);
      }
    }
  }
  const buf = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return buf;
}

/**
 * GET a user-influenced URL with protocol, host and per-redirect-hop validation.
 * Never pass `redirect: "follow"` to a bare fetch() for such URLs — that hands
 * redirect handling to the runtime and skips every check below.
 */
export async function safeFetch(
  startUrl: string,
  opts: { accept?: string; maxBytes?: number; timeoutMs?: number; userAgent?: string } = {},
): Promise<SafeFetchResult> {
  const accept = opts.accept ?? "text/html,application/xhtml+xml";
  const maxBytes = opts.maxBytes ?? MAX_BYTES;
  const userAgent = opts.userAgent ?? "CoflowBot/1.0 (+https://www.coflow.se)";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  const chain: string[] = [];

  try {
    let current = startUrl;
    let hops = 0;

    while (true) {
      let parsed: URL;
      try {
        parsed = new URL(current);
      } catch {
        throw new SafeFetchError("invalid_url", `Invalid URL: ${current}`);
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new SafeFetchError("blocked_protocol", `Blocked protocol: ${parsed.protocol}`);
      }
      await assertHostSafe(parsed.hostname);
      chain.push(parsed.toString());

      const res = await fetch(parsed.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": userAgent, accept, "accept-language": "sv,en;q=0.9" },
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (loc) {
          hops += 1;
          if (hops > MAX_REDIRECTS) {
            throw new SafeFetchError("too_many_redirects", "Redirect limit exceeded");
          }
          try {
            current = new URL(loc, parsed).toString();
          } catch {
            throw new SafeFetchError("invalid_redirect", `Bad Location header: ${loc}`);
          }
          continue;
        }
      }

      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      const bytes = await readBounded(res, maxBytes);

      return {
        ok: res.ok,
        status: res.status,
        finalUrl: parsed.toString(),
        finalHost: parsed.hostname,
        headers,
        body: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
        redirectChain: chain,
      };
    }
  } finally {
    clearTimeout(timer);
  }
}

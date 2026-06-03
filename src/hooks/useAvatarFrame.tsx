import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "./useOrganizationId";

export type AvatarFrame = "gold" | "silver" | "bronze" | null;

let cachedSnapshot: { org: string; data: { top1: string | null; top2: string | null; top3: string | null } } | null = null;

export function useAvatarFrame(userId: string | null | undefined): AvatarFrame {
  const organizationId = useOrganizationId();

  const { data } = useQuery({
    queryKey: ["leaderboard-snapshot", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data } = await supabase
        .from("leaderboard_snapshots")
        .select("top1_user_id, top2_user_id, top3_user_id, month")
        .eq("organization_id", organizationId)
        .order("month", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  if (!userId || !data) return null;
  if (data.top1_user_id === userId) return "gold";
  if (data.top2_user_id === userId) return "silver";
  if (data.top3_user_id === userId) return "bronze";
  return null;
}

export function getFrameClasses(frame: AvatarFrame): string {
  switch (frame) {
    case "gold":
      return "ring-2 ring-amber-400/80 shadow-md shadow-amber-400/30";
    case "silver":
      return "ring-2 ring-slate-400/70 shadow-sm shadow-slate-400/25";
    case "bronze":
      return "ring-2 ring-amber-700/60 shadow-sm shadow-amber-700/20";
    default:
      return "";
  }
}

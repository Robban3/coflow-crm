import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

interface UserAvatarProps {
  userId: string | null;
  size?: "xs" | "sm" | "md";
  showTooltip?: boolean;
}

interface CachedProfile {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

// Simple in-memory cache
const profileCache = new Map<string, CachedProfile>();

export function UserAvatar({ userId, size = "sm", showTooltip = true }: UserAvatarProps) {
  const [profile, setProfile] = useState<CachedProfile | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Check cache first
    if (profileCache.has(userId)) {
      setProfile(profileCache.get(userId)!);
      return;
    }

    // Fetch profile
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) {
        profileCache.set(userId, data);
        setProfile(data);
      }
    };

    fetchProfile();
  }, [userId]);

  if (!userId || !profile) {
    return null;
  }

  const sizeClasses = {
    xs: "h-5 w-5",
    sm: "h-6 w-6",
    md: "h-8 w-8",
  };

  const textSizes = {
    xs: "text-[8px]",
    sm: "text-[10px]",
    md: "text-xs",
  };

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : profile.email.substring(0, 2).toUpperCase();

  const displayName = profile.full_name || profile.email;

  const avatar = (
    <Avatar className={sizeClasses[size]}>
      <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
      <AvatarFallback className={`${textSizes[size]} bg-primary/10 text-primary`}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  if (!showTooltip) {
    return avatar;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {avatar}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {displayName}
      </TooltipContent>
    </Tooltip>
  );
}

// Hook to prefetch multiple profiles at once
export function usePrefetchProfiles(userIds: (string | null)[]) {
  useEffect(() => {
    const idsToFetch = userIds.filter(
      (id): id is string => id !== null && !profileCache.has(id)
    );

    if (idsToFetch.length === 0) return;

    const fetchProfiles = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", idsToFetch);

      data?.forEach((profile) => {
        profileCache.set(profile.id, {
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
        });
      });
    };

    fetchProfiles();
  }, [userIds.join(",")]);
}

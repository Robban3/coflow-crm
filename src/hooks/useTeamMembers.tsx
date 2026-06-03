import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [membersMap, setMembersMap] = useState<Map<string, TeamMember>>(new Map());

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url");

    if (!error && data) {
      setMembers(data);
      setMembersMap(new Map(data.map(m => [m.id, m])));
    }
    setIsLoading(false);
  };

  const getMember = (id: string | null): TeamMember | undefined => {
    if (!id) return undefined;
    return membersMap.get(id);
  };

  const getInitials = (member: TeamMember): string => {
    if (member.full_name) {
      return member.full_name
        .split(" ")
        .map(n => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase();
    }
    return member.email.substring(0, 2).toUpperCase();
  };

  return {
    members,
    isLoading,
    membersMap,
    getMember,
    getInitials,
    refetch: fetchMembers,
  };
}

import { useAuth } from "@/hooks/useAuth";

// Access rules (kept in sync with the RLS helpers in the training migration):
//   view  -> any @applabbet.com address
//   edit  -> explicit admin allowlist
const APPLABBET_DOMAIN = "@applabbet.com";
const TRAINING_ADMINS = ["robert@applabbet.com", "oliver@applabbet.com"];

/**
 * Whether the current user may view / edit the Training feature, based on their
 * email. RLS enforces the same rules server-side — this just drives the UI.
 */
export function useTrainingAccess() {
  const { user } = useAuth();
  const email = user?.email?.toLowerCase() ?? "";
  const canView = email.endsWith(APPLABBET_DOMAIN);
  const canEdit = TRAINING_ADMINS.includes(email);
  return { canView, canEdit };
}

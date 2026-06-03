import { useOrganization } from './useOrganization';

/**
 * Simple hook that returns the current user's organization_id
 * This is essential for all INSERT operations to ensure data isolation
 */
export function useOrganizationId(): string | null {
  const { organization } = useOrganization();
  return organization?.id ?? null;
}

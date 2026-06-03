import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface OrganizationData {
  id: string;
  name: string;
  website: string | null;
  logo_url: string | null;
  sender_email: string | null;
  sender_name: string | null;
  resend_api_key_configured: boolean;
}

interface OrganizationSettings {
  company_name: string | null;
  company_website: string | null;
  company_logo_url: string | null;
}

interface OrganizationContextType {
  organization: OrganizationData | null;
  settings: OrganizationSettings;
  isLoading: boolean;
  needsOnboarding: boolean;
  refreshSettings: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [settings, setSettings] = useState<OrganizationSettings>({
    company_name: null,
    company_website: null,
    company_logo_url: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const fetchSettings = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      // Get user's profile with organization
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id, onboarding_completed, company_name, company_website, company_logo_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setIsLoading(false);
        return;
      }

      // Check if user needs onboarding
      if (!profile?.organization_id || !profile?.onboarding_completed) {
        setNeedsOnboarding(true);
        setIsLoading(false);
        return;
      }

      setNeedsOnboarding(false);

      // Fetch organization details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, website, logo_url, sender_email, sender_name, resend_api_key_configured')
        .eq('id', profile.organization_id)
        .single();

      if (!orgError && org) {
        setOrganization({
          id: org.id,
          name: org.name,
          website: org.website,
          logo_url: org.logo_url,
          sender_email: org.sender_email,
          sender_name: org.sender_name,
          resend_api_key_configured: org.resend_api_key_configured || false,
        });

        // Use organization data for settings, fallback to profile data
        setSettings({
          company_name: org.name || profile.company_name,
          company_website: org.website || profile.company_website,
          company_logo_url: org.logo_url || profile.company_logo_url,
        });
      } else {
        // Fallback to profile data
        setSettings({
          company_name: profile.company_name,
          company_website: profile.company_website,
          company_logo_url: profile.company_logo_url,
        });
      }
    } catch (error) {
      console.error('Error fetching organization settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  return (
    <OrganizationContext.Provider 
      value={{ 
        organization,
        settings, 
        isLoading, 
        needsOnboarding,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

import { supabase } from '@/integrations/supabase/client';

export interface HunterEmail {
  email: string;
  type: string;
  confidence: number;
  firstName: string | null;
  lastName: string | null;
  position: string | null;
  department: string | null;
  linkedin: string | null;
  phone: string | null;
}

export interface DomainSearchResult {
  domain: string;
  organization: string;
  pattern: string;
  emails: HunterEmail[];
  totalResults: number;
}

export interface EmailFinderResult {
  email: string;
  score: number;
  firstName: string;
  lastName: string;
  position: string | null;
  linkedin: string | null;
  phone: string | null;
  company: string | null;
}

export interface EmailVerifyResult {
  email: string;
  status: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'disposable' | 'unknown';
  score: number;
  isValid: boolean;
  mxRecords: boolean;
  smtpCheck: boolean;
}

type HunterResponse<T> = {
  success: boolean;
  error?: string;
  data?: T;
};

export const hunterApi = {
  /**
   * Search for all emails associated with a domain
   */
  async domainSearch(domain: string): Promise<HunterResponse<DomainSearchResult>> {
    const { data, error } = await supabase.functions.invoke('hunter-email-finder', {
      body: { action: 'domain-search', domain },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  /**
   * Find email for a specific person at a domain
   */
  async emailFinder(params: {
    domain: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  }): Promise<HunterResponse<EmailFinderResult>> {
    const { data, error } = await supabase.functions.invoke('hunter-email-finder', {
      body: { 
        action: 'email-finder',
        domain: params.domain,
        first_name: params.firstName,
        last_name: params.lastName,
        company: params.company,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  /**
   * Verify if an email address is valid
   */
  async verifyEmail(email: string): Promise<HunterResponse<EmailVerifyResult>> {
    const { data, error } = await supabase.functions.invoke('hunter-email-finder', {
      body: { action: 'verify', email },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  /**
   * Extract domain from a URL or email
   */
  extractDomain(input: string): string {
    let domain = input.toLowerCase().trim();
    domain = domain.replace(/^https?:\/\//, '');
    domain = domain.replace(/^www\./, '');
    domain = domain.split('/')[0];
    domain = domain.split(':')[0];
    return domain;
  },
};

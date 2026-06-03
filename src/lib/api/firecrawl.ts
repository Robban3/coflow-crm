import { supabase } from '@/integrations/supabase/client';

export interface ExtractedCompanyData {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  orgNumber?: string;
  description?: string;
  industry?: string;
  socialLinks?: {
    linkedin?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
  logoUrl?: string;
}

export interface ExtractResponse {
  success: boolean;
  data?: ExtractedCompanyData;
  sourceUrl?: string;
  error?: string;
}

export const firecrawlApi = {
  async extractCompanyData(url: string): Promise<ExtractResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-extract', {
      body: { url },
    });

    if (error) {
      console.error('Firecrawl extract error:', error);
      return { success: false, error: error.message };
    }

    return data;
  },
};

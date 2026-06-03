// Shared validation utilities for edge functions
// Uses Zod-like validation patterns for Deno

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// URL validation regex (basic)
const URL_REGEX = /^https?:\/\/.+/i;

// Validators
export function isUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_REGEX.test(value) && value.length <= 255;
}

export function isURL(value: unknown): value is string {
  return typeof value === 'string' && (URL_REGEX.test(value) || !value.includes(' '));
}

export function isString(value: unknown, maxLength = 10000): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

export function isNumber(value: unknown, min?: number, max?: number): value is number {
  if (typeof value !== 'number' || isNaN(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

// Schema-based validation
export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'uuid' | 'email' | 'url';
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
}

export type Schema = Record<string, SchemaField>;

export function validateSchema<T>(data: unknown, schema: Schema): ValidationResult<T> {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid request body' };
  }

  const obj = data as Record<string, unknown>;
  const validated: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema)) {
    const value = obj[key];

    // Check required fields
    if (field.required && (value === undefined || value === null || value === '')) {
      return { success: false, error: `Missing required field: ${key}` };
    }

    // Skip optional undefined fields
    if (value === undefined || value === null) {
      continue;
    }

    // Validate by type
    switch (field.type) {
      case 'string':
        if (!isString(value, field.maxLength || 10000)) {
          return { success: false, error: `Invalid string for field: ${key}` };
        }
        validated[key] = value;
        break;

      case 'number':
        if (!isNumber(value, field.min, field.max)) {
          return { success: false, error: `Invalid number for field: ${key}` };
        }
        validated[key] = value;
        break;

      case 'boolean':
        if (!isBoolean(value)) {
          return { success: false, error: `Invalid boolean for field: ${key}` };
        }
        validated[key] = value;
        break;

      case 'uuid':
        if (!isUUID(value)) {
          return { success: false, error: `Invalid UUID for field: ${key}` };
        }
        validated[key] = value;
        break;

      case 'email':
        if (!isEmail(value)) {
          return { success: false, error: `Invalid email for field: ${key}` };
        }
        validated[key] = value;
        break;

      case 'url':
        if (!isURL(value)) {
          return { success: false, error: `Invalid URL for field: ${key}` };
        }
        validated[key] = value;
        break;
    }
  }

  return { success: true, data: validated as T };
}

// Quick validation helpers
export function validateQuickOutreachRequest(data: unknown): ValidationResult<{
  to: string;
  subject: string;
  bodyText: string;
  leadId?: string;
}> {
  return validateSchema(data, {
    to: { type: 'email', required: true },
    subject: { type: 'string', required: true, maxLength: 500 },
    bodyText: { type: 'string', required: true, maxLength: 50000 },
    leadId: { type: 'uuid', required: false },
  });
}

export function validateGenerateOutreachRequest(data: unknown): ValidationResult<{
  leadId: string;
  stepNumber: number;
  totalSteps: number;
  emailPrompt?: string;
  userId: string;
  market?: string;
}> {
  // For follow_up context, stepNumber and totalSteps are optional
  const context = (data as Record<string, unknown>)?.context;
  const isFollowUp = context === "follow_up";

  return validateSchema(data, {
    leadId: { type: 'uuid', required: true },
    stepNumber: { type: 'number', required: !isFollowUp, min: 1, max: 100 },
    totalSteps: { type: 'number', required: !isFollowUp, min: 1, max: 100 },
    emailPrompt: { type: 'string', required: false, maxLength: 5000 },
    userId: { type: 'uuid', required: true },
    market: { type: 'string', required: false, maxLength: 4 },
  });
}

export function validateCreateUserRequest(data: unknown): ValidationResult<{
  email: string;
  password: string;
  fullName?: string;
  role?: string;
}> {
  type CreateUserData = {
    email: string;
    password: string;
    fullName?: string;
    role?: string;
  };
  
  const result = validateSchema<CreateUserData>(data, {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, maxLength: 128 },
    fullName: { type: 'string', required: false, maxLength: 255 },
    role: { type: 'string', required: false, maxLength: 50 },
  });

  // Additional password validation
  if (result.success && result.data) {
    const password = result.data.password;
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }
  }

  return result;
}

export function validateGooglePlacesRequest(data: unknown): ValidationResult<{
  query?: string;
  location?: string;
  radius?: number;
  pageToken?: string;
  market?: string;
}> {
  return validateSchema(data, {
    query: { type: 'string', required: false, maxLength: 500 },
    location: { type: 'string', required: false, maxLength: 255 },
    radius: { type: 'number', required: false, min: 1, max: 50000 },
    pageToken: { type: 'string', required: false, maxLength: 2000 },
    market: { type: 'string', required: false, maxLength: 2 },
  });
}

export function validateHunterRequest(data: unknown): ValidationResult<{
  action: string;
  domain?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
}> {
  return validateSchema(data, {
    action: { type: 'string', required: true, maxLength: 50 },
    domain: { type: 'string', required: false, maxLength: 255 },
    email: { type: 'email', required: false },
    first_name: { type: 'string', required: false, maxLength: 100 },
    last_name: { type: 'string', required: false, maxLength: 100 },
    company: { type: 'string', required: false, maxLength: 255 },
  });
}

export function validateFirecrawlRequest(data: unknown): ValidationResult<{
  url: string;
}> {
  return validateSchema(data, {
    url: { type: 'string', required: true, maxLength: 2048 },
  });
}

export function validateSendSequenceRequest(data: unknown): ValidationResult<{
  leadSequenceId: string;
  stepId: string;
  executionId: string;
  preApproved?: boolean;
  approvedSubject?: string;
  approvedBody?: string;
}> {
  return validateSchema(data, {
    leadSequenceId: { type: 'uuid', required: true },
    stepId: { type: 'uuid', required: true },
    executionId: { type: 'uuid', required: true },
    preApproved: { type: 'boolean', required: false },
    approvedSubject: { type: 'string', required: false, maxLength: 500 },
    approvedBody: { type: 'string', required: false, maxLength: 50000 },
  });
}

export function validateAnalysisOutreachRequest(data: unknown): ValidationResult<{
  url: string;
  performanceScore: number;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  pwaScore?: number;
  recipientEmail?: string;
  companyName?: string;
  contactName?: string;
  customPrompt?: string;
  tone?: string;
  // SEO Intelligence data
  seoVisibilityScore?: number;
  seoSummary?: string;
  seoOpportunities?: string;
}> {
  return validateSchema(data, {
    url: { type: 'string', required: true, maxLength: 2048 },
    performanceScore: { type: 'number', required: true, min: 0, max: 100 },
    seoScore: { type: 'number', required: true, min: 0, max: 100 },
    accessibilityScore: { type: 'number', required: true, min: 0, max: 100 },
    bestPracticesScore: { type: 'number', required: true, min: 0, max: 100 },
    pwaScore: { type: 'number', required: false, min: 0, max: 100 },
    recipientEmail: { type: 'email', required: false },
    companyName: { type: 'string', required: false, maxLength: 255 },
    contactName: { type: 'string', required: false, maxLength: 255 },
    customPrompt: { type: 'string', required: false, maxLength: 2000 },
    tone: { type: 'string', required: false, maxLength: 50 },
    seoVisibilityScore: { type: 'number', required: false, min: 0, max: 100 },
    seoSummary: { type: 'string', required: false, maxLength: 5000 },
    seoOpportunities: { type: 'string', required: false, maxLength: 10000 },
  });
}

// Sanitization helper for preventing XSS in HTML emails
export function sanitizeForHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

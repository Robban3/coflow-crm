import { 
  LayoutDashboard, 
  Users, 
  GitBranch, 
  Search, 
  CheckSquare, 
  BarChart3, 
  Mail, 
  Inbox,
  Settings,
  Car,
  Eye,
  Calendar,
  FileText,
  Layout,
  Brain,
  PhoneCall,
  Telescope,
  GraduationCap,
  type LucideIcon
} from "lucide-react";

export type ModuleId = 
  | 'dashboard'
  | 'customers' 
  | 'pipeline'
  | 'leads'
  | 'prospecting'
  | 'tasks'
  | 'tickets'
  | 'web_analysis'
  | 'geo_analysis'
  | 'outreach'
  | 'outreach_pro'
  | 'mail'
  | 'templates'
  | 'offers'
  | 'quotes'
  
  | 'reports'
  | 'meetings'
  | 'fleet_data'
  | 'seo_intelligence'
  | 'statistics'
  | 'training'
  | 'settings';

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
  icon: LucideIcon;
  path: string;
  enabled: boolean; // Default enabled state
  requiresAdmin?: boolean;
  dbModuleKey?: string; // Maps to app_module enum in database
  isLeadSection?: boolean; // If true, this module adds a section to lead detail view instead of a page
}

// Central module registry - single source of truth
export const MODULE_REGISTRY: ModuleDefinition[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Översikt och snabbåtkomst',
    icon: LayoutDashboard,
    path: '/dashboard',
    enabled: true, // Always enabled
  },
  {
    id: 'customers',
    name: 'Kunder',
    description: 'Hantera kunder och kontakter',
    icon: Users,
    path: '/customers',
    enabled: true,
    dbModuleKey: 'customers',
  },
  {
    id: 'pipeline',
    name: 'Pipeline',
    description: 'Säljflöde och deals',
    icon: GitBranch,
    path: '/pipeline',
    enabled: true,
    dbModuleKey: 'pipeline',
  },
  {
    id: 'leads',
    name: 'Leads',
    description: 'Prospektering och leadgenerering',
    icon: Search,
    path: '/leads',
    enabled: true,
    dbModuleKey: 'leads',
  },
  {
    id: 'prospecting',
    name: 'Prospektering',
    description: 'Hitta, analysera och kontakta nya leads i bulk',
    icon: Telescope,
    path: '/prospecting',
    enabled: true,
    dbModuleKey: 'prospecting',
  },
  {
    id: 'tasks',
    name: 'Tasks',
    description: 'Uppgifter och uppföljningar',
    icon: CheckSquare,
    path: '/tasks',
    enabled: true,
    dbModuleKey: 'tasks',
  },
  {
    id: 'tickets',
    name: 'Ärenden',
    description: 'Hantera sälj- och supportärenden',
    icon: FileText,
    path: '/tickets',
    enabled: true,
    dbModuleKey: 'tickets',
  },
  {
    id: 'web_analysis',
    name: 'Webbanalys',
    description: 'Analysera webbplatser',
    icon: BarChart3,
    path: '/web-analysis',
    enabled: true,
    dbModuleKey: 'web_analysis',
  },
  {
    id: 'geo_analysis',
    name: 'GEO / AI-synlighet',
    description: 'Analysera synlighet i AI-sökmotorer',
    icon: Brain,
    path: '', // Shows as tab in web analysis
    enabled: true,
    dbModuleKey: 'geo_analysis',
    isLeadSection: true,
  },
  {
    id: 'outreach',
    name: 'Outreach',
    description: 'E-postkampanjer och automation',
    icon: Mail,
    path: '/mail',
    enabled: false, // Merged into Mail module
    dbModuleKey: 'outreach',
    isLeadSection: true, // Hide from sidebar
  },
  {
    id: 'mail',
    name: 'Mail',
    description: 'Inkorg, skickade mail och outreach',
    icon: Inbox,
    path: '/mail',
    enabled: true,
    dbModuleKey: 'mail',
  },
  {
    id: 'outreach_pro',
    name: 'Power Call',
    description: 'Fokuserat ringflöde för säljare',
    icon: PhoneCall,
    path: '/outreach-pro',
    enabled: true,
    dbModuleKey: 'outreach_pro',
  },
  {
    id: 'reports',
    name: 'Rapporter',
    description: 'Generera och exportera rapporter',
    icon: BarChart3,
    path: '/reports',
    enabled: true,
    dbModuleKey: 'reports',
  },
  {
    id: 'templates',
    name: 'Mallar',
    description: 'Skapa och hantera dokumentmallar',
    icon: Layout,
    path: '/templates',
    enabled: true,
    dbModuleKey: 'documents',
    isLeadSection: true, // Hide from sidebar - accessed via Settings
  },
  {
    id: 'offers',
    name: 'Offerter (Block)',
    description: 'Skapa, skicka och spåra offerter med blockbyggaren',
    icon: FileText,
    path: '/offers',
    enabled: false,
    dbModuleKey: 'offers',
  },
  {
    id: 'quotes',
    name: 'Offerter',
    description: 'Klassiska offerter med radbaserad redigering',
    icon: FileText,
    path: '/quotes',
    enabled: true,
    dbModuleKey: 'quotes',
  },
  {
    id: 'meetings',
    name: 'Möten',
    description: 'Bokningar och kalender',
    icon: Calendar,
    path: '/meetings',
    enabled: true,
  },
  {
    id: 'fleet_data',
    name: 'Fordonsdata & Telefoni',
    description: 'Hämta fordons- och telefonidata från merinfo.se',
    icon: Car,
    path: '', // No dedicated page - shows in lead detail
    enabled: true,
    dbModuleKey: 'fleet_data',
    isLeadSection: true, // This module adds a section to lead detail view
  },
   {
     id: 'seo_intelligence',
     name: 'SEO Intelligence',
     description: 'Analysera Google-synlighet och on-page SEO',
     icon: Eye,
     path: '', // Shows as tab in web analysis, not a separate page
     enabled: true,
     dbModuleKey: 'seo_intelligence',
     isLeadSection: true, // This module adds a tab to web analysis view
   },
  {
    id: 'statistics',
    name: 'Statistik',
    description: 'Aktivitetsstatistik och teamprestation',
    icon: BarChart3,
    path: '/statistics',
    enabled: false,
    dbModuleKey: 'statistics',
    requiresAdmin: true,
  },
  {
    id: 'training',
    name: 'Utbildning',
    description: 'Utbildning och resurser för säljteamet',
    icon: GraduationCap,
    path: '/utbildning',
    enabled: true, // Sidebar visibility is gated per-organization (training_enabled), not per-user
  },
  {
    id: 'settings',
    name: 'Inställningar',
    description: 'Systeminställningar',
    icon: Settings,
    path: '/settings',
    enabled: true, // Always enabled
    requiresAdmin: false, // All users can access, but some sections require admin
  },
];

// Helper to get module by ID
export function getModule(id: ModuleId): ModuleDefinition | undefined {
  return MODULE_REGISTRY.find(m => m.id === id);
}

// Get navigable modules (for sidebar) - exclude lead section modules
export function getNavigableModules(): ModuleDefinition[] {
  return MODULE_REGISTRY.filter(m => m.id !== 'settings' && !m.isLeadSection);
}

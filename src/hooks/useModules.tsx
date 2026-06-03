import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { MODULE_REGISTRY, ModuleDefinition, ModuleId } from '@/modules/registry';

interface ModulesContextType {
  modules: ModuleDefinition[];
  enabledModules: ModuleDefinition[];
  isLoading: boolean;
  hasModuleAccess: (moduleId: ModuleId) => boolean;
  refreshModules: () => Promise<void>;
}

const ModulesContext = createContext<ModulesContextType | undefined>(undefined);

export function ModulesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userModules, setUserModules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserModules = async () => {
    if (!user) {
      setUserModules(new Set());
      setIsLoading(false);
      return;
    }

    try {
      // Default behavior: all modules are enabled unless explicitly disabled.
      const allModuleKeys = MODULE_REGISTRY
        .map(m => m.dbModuleKey)
        .filter(Boolean) as string[];

      const { data, error } = await supabase
        .from('user_modules')
        .select('module, enabled')
        .eq('user_id', user.id)
        // NOTE: do NOT filter by enabled=true.
        // Missing rows should still mean enabled by default.
        ;

      if (error) throw error;

      const disabled = new Set<string>(
        (data || [])
          .filter(m => m.enabled === false)
          .map(m => String(m.module))
      );

      const enabledModules = new Set(allModuleKeys.filter(k => !disabled.has(k)));
      setUserModules(enabledModules);
    } catch (error) {
      console.error('Error fetching user modules:', error);
      // Default to all modules enabled if fetch fails
      setUserModules(new Set(MODULE_REGISTRY.map(m => m.dbModuleKey).filter(Boolean) as string[]));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserModules();
  }, [user]);

  const hasModuleAccess = (moduleId: ModuleId): boolean => {
    const module = MODULE_REGISTRY.find(m => m.id === moduleId);
    if (!module) return false;
    
    // Dashboard and settings are always accessible
    if (!module.dbModuleKey) return true;
    
    return userModules.has(module.dbModuleKey);
  };

  const enabledModules = MODULE_REGISTRY.filter(module => {
    if (!module.dbModuleKey) return true; // Dashboard, settings always enabled
    return userModules.has(module.dbModuleKey);
  });

  return (
    <ModulesContext.Provider 
      value={{ 
        modules: MODULE_REGISTRY, 
        enabledModules, 
        isLoading, 
        hasModuleAccess,
        refreshModules: fetchUserModules,
      }}
    >
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  const context = useContext(ModulesContext);
  if (context === undefined) {
    // Return safe defaults during initial render before provider is mounted
    // This can happen during hot module replacement or initial hydration
    return {
      modules: MODULE_REGISTRY,
      enabledModules: MODULE_REGISTRY,
      isLoading: true,
      hasModuleAccess: () => true,
      refreshModules: async () => {},
    };
  }
  return context;
}

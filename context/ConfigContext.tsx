import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

interface AppConfig {
    adsEnabled: boolean;
}

interface ConfigContextType {
    config: AppConfig;
    isLoading: boolean;
    refreshConfig: () => Promise<void>;
}

const defaultConfig: AppConfig = {
    adsEnabled: true, // Default to true to be safe
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<AppConfig>(defaultConfig);
    const [isLoading, setIsLoading] = useState(true);
    const { user } = useAuth(); // Dependency on user to refresh when user logs in

    const fetchConfig = async () => {
        try {
            const response = await api.getConfig();
            if (response.data && typeof response.data.adsEnabled === 'boolean') {
                setConfig({ adsEnabled: response.data.adsEnabled });
            }
        } catch (error) {
            console.error('Error fetching app config:', error);
            // On error we keep the current config (or default)
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Fetch config initially
        fetchConfig();
        
        // We can optionally set up polling here to make it truly realtime
        // For example, checking every 5 minutes while app is running
        // const interval = setInterval(fetchConfig, 5 * 60 * 1000);
        // return () => clearInterval(interval);
        
    }, [user]);

    return (
        <ConfigContext.Provider value={{ config, isLoading, refreshConfig: fetchConfig }}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig() {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
}

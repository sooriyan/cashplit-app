import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
}

interface SignUpData {
    name: string;
    email: string;
    password: string;
    phone: string;
    upiId: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_KEY = 'cashplit_user';

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStoredUser();
    }, []);

    const loadStoredUser = async () => {
        try {
            const storedUser = await SecureStore.getItemAsync(USER_KEY);
            if (storedUser) {
                const userData = JSON.parse(storedUser);
                setUser(userData);
                api.setUserId(userData.id);
            }
        } catch (error) {
            console.error('Error loading user:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            // Call the auth API
            const response = await api.post('/api/auth/signin', { email, password });

            if (response.data?.user) {
                const userData: User = {
                    id: response.data.user.id,
                    name: response.data.user.name,
                    email: response.data.user.email,
                };

                await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
                api.setUserId(userData.id);
                setUser(userData);

                return { success: true };
            }

            return { success: false, error: 'Invalid credentials' };
        } catch (error: any) {
            console.error('Sign in error:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Sign in failed'
            };
        }
    };

    const signUp = async (data: SignUpData): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await api.post('/api/auth/signup', data);

            if (response.data?.userId) {
                // Auto sign in after signup
                const userData: User = {
                    id: response.data.userId,
                    name: data.name,
                    email: data.email,
                };

                await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));
                api.setUserId(userData.id);
                setUser(userData);

                return { success: true };
            }

            return { success: false, error: 'Registration failed' };
        } catch (error: any) {
            console.error('Sign up error:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Sign up failed'
            };
        }
    };

    const signOut = async () => {
        try {
            await SecureStore.deleteItemAsync(USER_KEY);
            api.setUserId(null);
            setUser(null);
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

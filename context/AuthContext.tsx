import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import api from '../services/api';
import { registerForPushNotificationsAsync } from '../services/notifications';
import * as Notifications from 'expo-notifications';

interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
    signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
    forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
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
        // Configure Google Sign-in
        GoogleSignin.configure({
            webClientId: '1034895581377-cvplie31heappubt38bg38fg84035pd6.apps.googleusercontent.com', // client type 3 in google-services.json
            offlineAccess: true,
            forceCodeForRefreshToken: true,
        });

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

    const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
        try {
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo.data?.idToken;

            if (!idToken) {
                return { success: false, error: 'Failed to get ID token' };
            }

            // Call the auth API with the Google ID token
            const response = await api.post('/api/auth/google', { idToken });

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

            return { success: false, error: 'Google sign-in failed on server' };
        } catch (error: any) {
            console.error('Google sign-in error:', error);
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                return { success: false, error: 'Sign in cancelled' };
            } else if (error.code === statusCodes.IN_PROGRESS) {
                return { success: false, error: 'Sign in in progress' };
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                return { success: false, error: 'Play services not available' };
            }
            return {
                success: false,
                error: error.response?.data?.message || 'Google sign-in failed'
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

    const forgotPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await api.post('/api/auth/forgot-password', { email });
            return { success: true };
        } catch (error: any) {
            console.error('Forgot password error:', error);
            return {
                success: false,
                error: error.response?.data?.message || 'Failed to send reset email'
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

    // Configure notification behavior
    useEffect(() => {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
    }, []);

    // Register push token whenever user changes
    useEffect(() => {
        if (user) {
            registerForPushNotificationsAsync().then(token => {
                if (token) {
                    api.updatePushToken(token).catch(err => {
                        console.error('Failed to update push token on server:', err);
                    });
                }
            });
        }
    }, [user]);

    return (
        <AuthContext.Provider value={{ user, isLoading, signIn, signInWithGoogle, signUp, signOut, forgotPassword }}>
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

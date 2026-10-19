import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '../context/AuthContext';
import { ConfigProvider } from '../context/ConfigContext';
import { Colors } from '@/constants/Colors';
import { todoNotificationService } from '../services/todoNotificationService';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Custom dark theme matching web design
const CashplitDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.primary,
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export default function RootLayout() {
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // Initialize notification channels and settings
    todoNotificationService.init();

    // Listen for user tapping on scheduled reminder notifications
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.todoId || data?.type === 'todo_reminder') {
        router.push('/(tabs)/todos' as any);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConfigProvider>
            <ThemeProvider value={CashplitDarkTheme}>
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: Colors.dark.background,
                },
                headerTintColor: Colors.dark.text,
                headerTitleStyle: {
                  fontWeight: '600',
                },
                contentStyle: {
                  backgroundColor: Colors.dark.background,
                },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar style="light" />
          </ThemeProvider>
          </ConfigProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}


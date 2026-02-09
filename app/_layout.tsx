import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';
import { AuthProvider } from '../context/AuthContext';
import { Colors } from '@/constants/Colors';

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

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
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
            <Stack.Screen
              name="group/[id]"
              options={{
                title: 'Group',
                headerBackTitle: 'Back',
              }}
            />
            <Stack.Screen
              name="group/add-expense"
              options={{
                title: 'Add Expense',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="group/create"
              options={{
                title: 'Create Group',
              }}
            />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}


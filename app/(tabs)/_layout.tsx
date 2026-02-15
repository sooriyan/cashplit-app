import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useAuth } from '../../context/AuthContext';

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  // If loading, don't render anything yet
  if (isLoading) {
    return null;
  }

  // If not authenticated, redirect to sign-in
  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.primary,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        headerShown: true,
        headerStyle: {
          backgroundColor: Colors.dark.background,
        },
        headerTintColor: Colors.dark.text,
        tabBarStyle: {
          backgroundColor: Colors.dark.background,
          borderTopColor: Colors.dark.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 4 : 8),
          height: 60 + insets.bottom,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Cashplit',
          headerShown: true,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="group/[id]"
        options={{
          href: null,
          title: 'Group',
        }}
      />
      <Tabs.Screen
        name="group/add-expense"
        options={{
          href: null,
          title: 'Add Expense',
        }}
      />
      <Tabs.Screen
        name="group/all-expenses"
        options={{
          href: null,
          title: 'All Expenses',
        }}
      />
      <Tabs.Screen
        name="group/settings"
        options={{
          href: null,
          title: 'Settings',
        }}
      />
      <Tabs.Screen
        name="group/create"
        options={{
          href: null,
          title: 'Create Group',
        }}
      />
    </Tabs>
  );
}

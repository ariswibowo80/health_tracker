// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0F766E',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: { height: 58, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Profil Keluarga',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👪</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Pengaturan',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}

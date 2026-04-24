import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useTheme } from '@/theme/theme';

function TabIcon({ label, color }: { label: string; color: string }) {
    return (
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, color }}>{label}</Text>
        </View>
    );
}

export default function TabsLayout() {
    const { palette } = useTheme();
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: palette.primary,
                tabBarInactiveTintColor: palette.textFaint,
                tabBarStyle: {
                    backgroundColor: palette.bgElevated,
                    borderTopColor: palette.border,
                },
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            }}
        >
            <Tabs.Screen
                name="today"
                options={{
                    title: 'Today',
                    tabBarIcon: ({ color }) => <TabIcon label="◎" color={color} />,
                }}
            />
            <Tabs.Screen
                name="tasks"
                options={{
                    title: 'Tasks',
                    tabBarIcon: ({ color }) => <TabIcon label="☑" color={color} />,
                }}
            />
            <Tabs.Screen
                name="projects"
                options={{
                    title: 'Projects',
                    tabBarIcon: ({ color }) => <TabIcon label="▦" color={color} />,
                }}
            />
            <Tabs.Screen
                name="notes"
                options={{
                    title: 'Notes',
                    tabBarIcon: ({ color }) => <TabIcon label="✎" color={color} />,
                }}
            />
            <Tabs.Screen
                name="inbox"
                options={{
                    title: 'Inbox',
                    tabBarIcon: ({ color }) => <TabIcon label="⌇" color={color} />,
                }}
            />
            <Tabs.Screen
                name="more"
                options={{
                    title: 'More',
                    tabBarIcon: ({ color }) => <TabIcon label="⋯" color={color} />,
                }}
            />
        </Tabs>
    );
}

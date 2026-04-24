import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="server" />
            <Stack.Screen name="login" />
            <Stack.Screen name="api-key" />
        </Stack>
    );
}

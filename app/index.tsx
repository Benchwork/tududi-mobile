import { Redirect } from 'expo-router';
import { useSessionStore } from '@/stores/session';

export default function Index() {
    const session = useSessionStore((s) => s.session);
    if (!session) return <Redirect href="/(auth)/server" />;
    return <Redirect href="/(tabs)/today" />;
}

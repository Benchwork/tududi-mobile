import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useTheme } from '@/theme/theme';
import { useCreateInboxItem } from './queries';

/**
 * Shared quick-capture row used on Inbox and Today so behavior and UI stay in sync.
 */
export function InboxQuickCaptureBar() {
    const { palette } = useTheme();
    const [content, setContent] = useState('');
    const create = useCreateInboxItem();

    const onCapture = async () => {
        const text = content.trim();
        if (!text) return;
        await create.mutateAsync(text);
        setContent('');
    };

    return (
        <View style={styles.wrap}>
            <View style={styles.captureRow}>
                <TextField
                    placeholder="Jot something down..."
                    value={content}
                    onChangeText={setContent}
                    style={{ marginBottom: 0, flex: 1 }}
                    onSubmitEditing={onCapture}
                    returnKeyType="send"
                />
                <Button title="Add" onPress={onCapture} style={{ marginLeft: 8 }} />
            </View>
            <Text style={[styles.description, { color: palette.textFaint }]}>
                Saved to your inbox — open the Inbox tab to process into tasks or notes.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { paddingBottom: 4 },
    captureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 6,
    },
    description: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        fontSize: 12,
        lineHeight: 16,
    },
});

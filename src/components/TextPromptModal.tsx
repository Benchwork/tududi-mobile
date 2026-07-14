import React, { useEffect, useRef, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Button } from './Button';
import { TextField } from './TextField';
import { useTheme } from '../theme/theme';

export interface TextPromptModalProps {
    visible: boolean;
    title: string;
    message?: string;
    placeholder?: string;
    /** Shown when `visible` becomes true (e.g. current name for rename). */
    defaultValue?: string;
    submitLabel?: string;
    loading?: boolean;
    onCancel: () => void;
    onSubmit: (text: string) => void | Promise<void>;
}

/**
 * Cross-platform text prompt. Replaces `Alert.prompt`, which is iOS-only and
 * does nothing on Android when used with optional chaining.
 */
export function TextPromptModal({
    visible,
    title,
    message,
    placeholder,
    defaultValue = '',
    submitLabel = 'OK',
    loading,
    onCancel,
    onSubmit,
}: TextPromptModalProps) {
    const { palette } = useTheme();
    const [value, setValue] = useState(defaultValue);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        if (visible) setValue(defaultValue);
    }, [visible, defaultValue]);

    /** `autoFocus` is unreliable inside `Modal` on Android; focus after layout. */
    useEffect(() => {
        if (!visible) return;
        const delay = Platform.OS === 'android' ? 200 : 50;
        const id = setTimeout(() => {
            inputRef.current?.focus();
        }, delay);
        return () => clearTimeout(id);
    }, [visible]);

    const submit = async () => {
        const t = value.trim();
        if (!t || loading) return;
        await onSubmit(t);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.flex}
            >
                <View style={[styles.root, { backgroundColor: palette.overlay }]}>
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={onCancel}
                        accessibilityLabel="Dismiss"
                    />
                    <View
                        pointerEvents="box-none"
                        style={[
                            StyleSheet.absoluteFillObject,
                            { justifyContent: 'center', paddingHorizontal: 24 },
                        ]}
                    >
                        <View
                            style={[
                                styles.sheet,
                                {
                                    backgroundColor: palette.bgElevated,
                                    borderColor: palette.border,
                                },
                            ]}
                        >
                            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
                            {message ? (
                                <Text style={[styles.message, { color: palette.textMuted }]}>
                                    {message}
                                </Text>
                            ) : null}
                            <TextField
                                ref={inputRef}
                                placeholder={placeholder}
                                value={value}
                                onChangeText={setValue}
                                onSubmitEditing={submit}
                                returnKeyType="done"
                                editable={!loading}
                                showSoftInputOnFocus
                            />
                            <View style={styles.actions}>
                                <Button
                                    title="Cancel"
                                    variant="secondary"
                                    onPress={onCancel}
                                    disabled={loading}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    title={submitLabel}
                                    onPress={submit}
                                    loading={loading}
                                    disabled={!value.trim()}
                                    style={{ flex: 1, marginLeft: 8 }}
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    root: { flex: 1 },
    sheet: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 20,
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },
    title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
    message: { fontSize: 14, marginBottom: 12 },
    actions: {
        flexDirection: 'row',
        marginTop: 8,
    },
});

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { Colors } from '@/constants/Colors';

export default function CreateGroupScreen() {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a group name');
            return;
        }

        setLoading(true);

        try {
            await api.createGroup(name);
            router.replace('/(tabs)');
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
            style={styles.container}
        >
            {/* Background glow */}
            <View style={styles.glowContainer}>
                <View style={styles.glow} />
            </View>

            <View style={styles.content}>
                <View style={styles.card}>
                    {/* Icon */}
                    <View style={styles.iconContainer}>
                        <Ionicons name="people" size={32} color={Colors.dark.primary} />
                    </View>

                    <Text style={styles.title}>Create a Group</Text>
                    <Text style={styles.subtitle}>Start splitting expenses with your friends</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Group Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Trip to Goa, Roommates, Dinner Club..."
                            placeholderTextColor={Colors.dark.textMuted}
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={Colors.dark.background} />
                        ) : (
                            <Text style={styles.buttonText}>Create Group</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    glowContainer: {
        position: 'absolute',
        top: '30%',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    glow: {
        width: 300,
        height: 150,
        backgroundColor: Colors.dark.primaryGlow,
        borderRadius: 150,
        opacity: 0.3,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: 'rgba(18, 18, 18, 0.8)',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.dark.primaryFaded,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.dark.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        color: Colors.dark.text,
    },
    button: {
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: Colors.dark.background,
        fontSize: 16,
        fontWeight: '600',
    },
});

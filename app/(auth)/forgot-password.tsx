import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';

export default function ForgotPasswordScreen() {
    const { forgotPassword } = useAuth();
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleResetPassword = async () => {
        if (!email) {
            setError('Please enter your email address');
            return;
        }

        setLoading(true);
        setError('');

        const result = await forgotPassword(email);

        if (result.success) {
            setSuccess(true);
        } else {
            setError(result.error || 'Failed to send reset link');
        }

        setLoading(false);
    };

    return (
        <LinearGradient
            colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
            style={styles.container}
        >
            <KeyboardAwareScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Back Button */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                </TouchableOpacity>

                {/* Logo */}
                <View style={styles.logoContainer}>
                    <Text style={styles.logo}>Cashplit</Text>
                </View>

                {/* Card */}
                <View style={styles.card}>
                    <Text style={styles.title}>Forgot Password?</Text>
                    <Text style={styles.subtitle}>
                        Enter your email address and we'll send you a link to reset your password.
                    </Text>

                    {success ? (
                        <View style={styles.successContainer}>
                            <Ionicons name="checkmark-circle" size={48} color={Colors.dark.success} />
                            <Text style={styles.successTitle}>Check your email</Text>
                            <Text style={styles.successText}>
                                We have sent a password reset link to <Text style={styles.emailText}>{email}</Text>.
                            </Text>
                            <Link href="/(auth)/sign-in" asChild>
                                <TouchableOpacity style={styles.button}>
                                    <Text style={styles.buttonText}>Back to Sign In</Text>
                                </TouchableOpacity>
                            </Link>
                        </View>
                    ) : (
                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="you@example.com"
                                    placeholderTextColor={Colors.dark.textMuted}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            {error ? (
                                <View style={styles.errorContainer}>
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleResetPassword}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={Colors.dark.background} />
                                ) : (
                                    <Text style={styles.buttonText}>Send Reset Link</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.footer}>
                                <Link href="/(auth)/sign-in" asChild>
                                    <TouchableOpacity>
                                        <Text style={styles.footerLink}>Back to Sign In</Text>
                                    </TouchableOpacity>
                                </Link>
                            </View>
                        </View>
                    )}
                </View>
            </KeyboardAwareScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 20,
    },
    backButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        zIndex: 10,
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 60,
        marginBottom: 32,
    },
    logo: {
        fontSize: 36,
        fontWeight: 'bold',
        color: Colors.dark.primary,
        textShadowColor: Colors.dark.primaryGlow,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
    },
    card: {
        backgroundColor: 'rgba(18, 18, 18, 0.8)',
        borderRadius: 16,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.dark.border,
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
        lineHeight: 20,
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
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
    errorContainer: {
        backgroundColor: Colors.dark.dangerFaded,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: 8,
        padding: 12,
    },
    errorText: {
        color: Colors.dark.danger,
        fontSize: 14,
        textAlign: 'center',
    },
    button: {
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: Colors.dark.background,
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        alignItems: 'center',
        marginTop: 16,
    },
    footerLink: {
        color: Colors.dark.primary,
        fontSize: 14,
        fontWeight: '500',
    },
    successContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    successTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginTop: 16,
        marginBottom: 8,
    },
    successText: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    emailText: {
        color: Colors.dark.text,
        fontWeight: '600',
    },
});

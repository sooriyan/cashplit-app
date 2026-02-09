import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function ProfileScreen() {
    const { user, signOut } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        upiId: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingUpi, setSavingUpi] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Only fetch profile when user is authenticated
        if (user?.id) {
            fetchProfile();
        } else {
            // Use local user data as fallback
            setFormData({
                name: user?.name || '',
                email: user?.email || '',
                phone: '',
                upiId: '',
            });
            setLoading(false);
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const res = await api.getProfile();
            setFormData({
                name: res.data.name || '',
                email: res.data.email || '',
                phone: res.data.phone || '',
                upiId: res.data.upiId || '',
            });
        } catch (err) {
            console.error('Failed to fetch profile:', err);
            // Fallback to local user data on error
            setFormData({
                name: user?.name || '',
                email: user?.email || '',
                phone: '',
                upiId: '',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage('');

        try {
            await api.updateProfile({
                name: formData.name,
                phone: formData.phone,
                upiId: formData.upiId,
            });
            setMessage('Profile updated successfully!');
        } catch (err) {
            setMessage('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateUpi = async () => {
        if (!formData.upiId) {
            Alert.alert('Error', 'Please enter a UPI ID');
            return;
        }

        setSavingUpi(true);
        setMessage('');

        try {
            await api.updateProfile({
                upiId: formData.upiId,
            });
            setMessage('UPI ID updated successfully!');
            Alert.alert('Success', 'UPI ID updated successfully!');
        } catch (err) {
            setMessage('Failed to update UPI ID');
            Alert.alert('Error', 'Failed to update UPI ID');
        } finally {
            setSavingUpi(false);
        }
    };

    if (loading) {
        return (
            <LinearGradient
                colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
                style={styles.loadingContainer}
            >
                <ActivityIndicator size="large" color={Colors.dark.primary} />
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                    <LinearGradient
                        colors={[Colors.dark.primary, 'rgba(19, 236, 109, 0.5)']}
                        style={styles.avatar}
                    >
                        <Text style={styles.avatarText}>
                            {formData.name?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                    </LinearGradient>
                    <Text style={styles.userName}>{formData.name || 'User'}</Text>
                    <Text style={styles.userEmail}>{formData.email}</Text>
                </View>

                {/* Account Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="person" size={20} color={Colors.dark.primary} />
                        <Text style={styles.sectionTitle}>Account</Text>
                    </View>
                    <View style={styles.sectionContent}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={[styles.input, styles.inputDisabled]}
                                value={formData.email}
                                editable={false}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Name</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                                placeholderTextColor={Colors.dark.textMuted}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Phone</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.phone}
                                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                                keyboardType="phone-pad"
                                placeholderTextColor={Colors.dark.textMuted}
                            />
                        </View>

                        {message ? (
                            <View style={[
                                styles.messageBox,
                                { backgroundColor: message.includes('success') ? Colors.dark.primaryFaded : Colors.dark.dangerFaded }
                            ]}>
                                <Text style={[
                                    styles.messageText,
                                    { color: message.includes('success') ? Colors.dark.primary : Colors.dark.danger }
                                ]}>
                                    {message}
                                </Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.buttonDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator color={Colors.dark.background} />
                            ) : (
                                <Text style={styles.saveButtonText}>Save Changes</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Payment Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="card" size={20} color={Colors.dark.primary} />
                        <Text style={styles.sectionTitle}>Payment Methods</Text>
                    </View>
                    <View style={styles.sectionContent}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>UPI ID</Text>
                            <TextInput
                                style={styles.input}
                                value={formData.upiId}
                                onChangeText={(text) => setFormData({ ...formData, upiId: text })}
                                placeholder="yourname@upi"
                                placeholderTextColor={Colors.dark.textMuted}
                                autoCapitalize="none"
                            />
                            <Text style={styles.hint}>Used for receiving payments from your groups</Text>

                            <TouchableOpacity
                                style={[styles.upiUpdateButton, savingUpi && styles.buttonDisabled]}
                                onPress={handleUpdateUpi}
                                disabled={savingUpi}
                            >
                                {savingUpi ? (
                                    <ActivityIndicator size="small" color={Colors.dark.background} />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle-outline" size={18} color={Colors.dark.background} />
                                        <Text style={styles.upiUpdateButtonText}>Update UPI Id</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
                    <Ionicons name="log-out-outline" size={20} color={Colors.dark.danger} />
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>

                <Text style={styles.version}>Cashplit v1.0.0</Text>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: 'bold',
        color: Colors.dark.background,
    },
    userName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    userEmail: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginTop: 4,
    },
    section: {
        backgroundColor: 'rgba(18, 18, 18, 0.8)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginBottom: 16,
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 16,
        paddingBottom: 0,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    sectionContent: {
        padding: 16,
        gap: 12,
    },
    inputGroup: {
        gap: 6,
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
        padding: 12,
        fontSize: 16,
        color: Colors.dark.text,
    },
    inputDisabled: {
        opacity: 0.5,
    },
    hint: {
        fontSize: 12,
        color: Colors.dark.textMuted,
        marginTop: 4,
    },
    messageBox: {
        padding: 12,
        borderRadius: 8,
        marginTop: 4,
    },
    messageText: {
        fontSize: 14,
        textAlign: 'center',
    },
    saveButton: {
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: Colors.dark.background,
        fontSize: 16,
        fontWeight: '600',
    },
    menuItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    menuItemTitle: {
        fontSize: 16,
        color: Colors.dark.text,
    },
    menuItemSubtitle: {
        fontSize: 12,
        color: Colors.dark.textMuted,
        marginTop: 2,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(18, 18, 18, 0.8)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: 8,
        padding: 14,
        marginTop: 8,
    },
    logoutText: {
        color: Colors.dark.danger,
        fontSize: 16,
        fontWeight: '500',
    },
    version: {
        textAlign: 'center',
        color: Colors.dark.textMuted,
        fontSize: 12,
        marginTop: 24,
    },
    upiUpdateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
    },
    upiUpdateButtonText: {
        color: Colors.dark.background,
        fontSize: 14,
        fontWeight: '600',
    },
});

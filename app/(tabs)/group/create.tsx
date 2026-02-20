import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { CustomAlert, AlertType } from '../../../components/CustomAlert';
import { router, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Colors } from '@/constants/Colors';
import { Avatar } from '../../../components/Avatar';

interface Member {
    _id: string;
    name: string;
    email: string;
    phone?: string;
}

export default function CreateGroupScreen() {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<Member[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<Member[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Custom Alert State
    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: AlertType;
        onPrimaryAction?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
    });

    const showAlert = (title: string, message: string, type: AlertType = 'info', onPrimaryAction?: () => void) => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
            onPrimaryAction,
        });
    };

    const hideAlert = () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
    };

    useEffect(() => {
        fetchSuggestions();
    }, []);

    const fetchSuggestions = async () => {
        try {
            const res = await api.getUserSuggestions();
            setSuggestions(res.data || []);
        } catch (err) {
            console.error('Failed to fetch suggestions:', err);
        }
    };

    const toggleMember = (member: Member) => {
        if (selectedMembers.some(m => m._id === member._id)) {
            setSelectedMembers(selectedMembers.filter(m => m._id !== member._id));
        } else {
            setSelectedMembers([...selectedMembers, member]);
        }
    };

    const filteredSuggestions = suggestions.filter(s => {
        const isSelected = selectedMembers.some(m => m._id === s._id);
        if (isSelected) return false;

        if (searchQuery.length === 0) return true;

        const query = searchQuery.toLowerCase();
        return (
            (s.name && s.name.toLowerCase().includes(query)) ||
            (s.email && s.email.toLowerCase().includes(query)) ||
            (s.phone && s.phone.includes(query))
        );
    });

    const handleSubmit = async () => {
        if (!name.trim()) {
            showAlert('Error', 'Please enter a group name', 'warning');
            return;
        }

        setLoading(true);

        try {
            const groupRes = await api.createGroup(name);
            const groupId = groupRes.data._id;

            // Invite selected members
            const emails = selectedMembers.map(m => m.email);
            if (emails.length > 0) {
                try {
                    await api.addMembers(groupId, emails);
                } catch (inviteErr) {
                    console.error('Failed to invite members:', inviteErr);
                    showAlert('Partially Successful', 'Group created, but some invitations could not be sent.', 'warning');
                }
            }

            router.replace('/(tabs)');
        } catch (err: any) {
            showAlert('Error', err.response?.data?.message || 'Failed to create group', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient
            colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
            style={styles.container}
        >
            <Stack.Screen
                options={{
                    headerTitle: 'Create Group',
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: Colors.dark.background },
                    headerTintColor: Colors.dark.text,
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    ),
                }}
            />
            {/* Background glow */}
            <View style={styles.glowContainer}>
                <View style={styles.glow} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                                placeholder="Trip to Goa, Roommates, Dinner..."
                                placeholderTextColor={Colors.dark.textMuted}
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Add Members</Text>

                            {/* Selected Members Badges */}
                            {selectedMembers.length > 0 && (
                                <View style={styles.selectedBadges}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                        {selectedMembers.map(m => (
                                            <TouchableOpacity
                                                key={m._id}
                                                style={styles.badge}
                                                onPress={() => toggleMember(m)}
                                            >
                                                <Text style={styles.badgeText}>{m.name || m.email}</Text>
                                                <Ionicons name="close-circle" size={14} color={Colors.dark.primary} />
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <TextInput
                                style={styles.input}
                                placeholder="Search by name or email..."
                                placeholderTextColor={Colors.dark.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                            />

                            {/* Suggestions List */}
                            <View style={styles.suggestionsContainer}>
                                {filteredSuggestions.slice(0, 5).map(s => (
                                    <TouchableOpacity
                                        key={s._id}
                                        style={styles.suggestionItem}
                                        onPress={() => {
                                            toggleMember(s);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <Avatar name={s.name || s.email} size={30} fontSize={12} rounded />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={styles.suggestionName}>{s.name || 'Unknown'}</Text>
                                            <Text style={styles.suggestionEmail}>{s.email}</Text>
                                        </View>
                                        <Ionicons name="add-circle-outline" size={20} color={Colors.dark.primary} />
                                    </TouchableOpacity>
                                ))}

                                {/* Direct Email Invite */}
                                {searchQuery.includes('@') && !suggestions.some(s => s.email === searchQuery.toLowerCase()) && (
                                    <TouchableOpacity
                                        style={styles.suggestionItem}
                                        onPress={() => {
                                            const email = searchQuery.toLowerCase().trim();
                                            if (!selectedMembers.some(m => m.email === email)) {
                                                toggleMember({ _id: Date.now().toString(), name: email.split('@')[0], email });
                                                setSearchQuery('');
                                            }
                                        }}
                                    >
                                        <View style={styles.avatarPlaceholder}>
                                            <Ionicons name="mail-outline" size={16} color={Colors.dark.textSecondary} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={styles.suggestionName}>Invite "{searchQuery}"</Text>
                                            <Text style={styles.suggestionEmail}>Add new email address</Text>
                                        </View>
                                        <Ionicons name="add-circle" size={20} color={Colors.dark.primary} />
                                    </TouchableOpacity>
                                )}
                            </View>
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
            </ScrollView>

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={hideAlert}
                onPrimaryAction={alertConfig.onPrimaryAction}
            />
        </LinearGradient >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    glowContainer: {
        position: 'absolute',
        top: '10%',
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
    selectedBadges: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
        gap: 6,
    },
    badgeText: {
        color: '#10b981',
        fontSize: 13,
        fontWeight: '600',
    },
    suggestionsContainer: {
        marginTop: 8,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    suggestionName: {
        color: Colors.dark.text,
        fontSize: 14,
        fontWeight: '500',
    },
    suggestionEmail: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
    },
    avatarPlaceholder: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    button: {
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
        marginTop: 10,
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

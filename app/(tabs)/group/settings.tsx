import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../../components/Avatar';
import { CustomAlert, AlertType } from '../../../components/CustomAlert';
import api from '../../../services/api';

interface Member {
    _id: string;
    name: string;
    email: string;
}

interface Group {
    _id: string;
    name: string;
    members: Member[];
    inactiveMembers: string[];
}

export default function GroupSettingsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const insets = useSafeAreaInsets();
    const [group, setGroup] = useState<Group | null>(null);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [addingMember, setAddingMember] = useState(false);

    // Custom Alert State
    const [alertConfig, setAlertConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: AlertType;
        onPrimaryAction?: () => void;
        secondaryButtonText?: string;
        onSecondaryAction?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
    });

    const showAlert = (
        title: string,
        message: string,
        type: AlertType = 'info',
        onPrimaryAction?: () => void,
        secondaryButtonText?: string,
        onSecondaryAction?: () => void
    ) => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
            onPrimaryAction,
            secondaryButtonText,
            onSecondaryAction,
        });
    };

    const hideAlert = () => {
        setAlertConfig(prev => ({ ...prev, visible: false }));
    };

    useEffect(() => {
        if (id) fetchGroup();
    }, [id]);

    const fetchGroup = async () => {
        try {
            const res = await api.getGroup(id!);
            setGroup(res.data);
        } catch (err) {
            console.error('Failed to fetch group:', err);
            showAlert('Error', 'Failed to load group settings', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLeaveGroup = async () => {
        showAlert(
            "Leave Group",
            "Are you sure you want to leave this group? You can be added back later by other members.",
            'warning',
            async () => {
                try {
                    await api.leaveGroup(id!);
                    router.replace('/(tabs)');
                } catch (err) {
                    showAlert('Error', 'Failed to leave group', 'error');
                }
            },
            "Cancel",
            () => hideAlert()
        );
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        setAddingMember(true);

        try {
            await api.addMember(id!, inviteEmail);
            showAlert('Success', 'Member added!', 'success');
            setInviteEmail('');
            setShowInviteModal(false);
            fetchGroup();
        } catch (err: any) {
            showAlert('Error', err.response?.data?.message || 'Failed to add member', 'error');
        } finally {
            setAddingMember(false);
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

    if (!group) return null;

    return (
        <LinearGradient
            colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
            style={styles.container}
        >
            <Stack.Screen
                options={{
                    headerTitle: 'Group Settings',
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

            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}>
                <View style={styles.header}>
                    <Avatar name={group.name} size={80} fontSize={32} rounded={true} />
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.memberCount}>{group.members.length} members</Text>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Members</Text>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => setShowInviteModal(true)}
                        >
                            <Ionicons name="person-add" size={18} color={Colors.dark.primary} />
                            <Text style={styles.addButtonText}>Add</Text>
                        </TouchableOpacity>
                    </View>

                    {group.members.map((member) => {
                        const isInactive = group.inactiveMembers?.includes(member._id);
                        return (
                            <View key={member._id} style={styles.memberItem}>
                                <Avatar name={member.name} size={40} fontSize={16} rounded={true} />
                                <View style={styles.memberInfo}>
                                    <View style={styles.memberNameRow}>
                                        <Text style={styles.memberName}>{member.name}</Text>
                                        {isInactive && (
                                            <View style={styles.leftBadge}>
                                                <Text style={styles.leftBadgeText}>Left</Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.memberEmail}>{member.email}</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                <TouchableOpacity
                    style={styles.leaveButton}
                    onPress={handleLeaveGroup}
                >
                    <Ionicons name="log-out-outline" size={20} color={Colors.dark.danger} />
                    <Text style={styles.leaveButtonText}>Leave Group</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Invite Modal */}
            <Modal visible={showInviteModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Invite Friend</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="friend@example.com"
                            placeholderTextColor={Colors.dark.textMuted}
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalButtonOutline}
                                onPress={() => setShowInviteModal(false)}
                            >
                                <Text style={styles.modalButtonOutlineText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={handleInvite}
                                disabled={addingMember}
                            >
                                {addingMember ? (
                                    <ActivityIndicator size="small" color={Colors.dark.background} />
                                ) : (
                                    <Text style={styles.modalButtonText}>Add Member</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={hideAlert}
                onPrimaryAction={alertConfig.onPrimaryAction}
                secondaryButtonText={alertConfig.secondaryButtonText}
                onSecondaryAction={alertConfig.onSecondaryAction}
            />
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
    },
    header: {
        alignItems: 'center',
        paddingVertical: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    groupName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginTop: 16,
    },
    memberCount: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginTop: 4,
    },
    section: {
        backgroundColor: 'rgba(18, 18, 18, 0.8)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.dark.primaryFaded,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.dark.primary,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.borderLight,
    },
    memberInfo: {
        marginLeft: 12,
        flex: 1,
    },
    memberNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '500',
        color: Colors.dark.text,
    },
    leftBadge: {
        backgroundColor: Colors.dark.dangerFaded,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    leftBadgeText: {
        color: Colors.dark.danger,
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    memberEmail: {
        fontSize: 13,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    leaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 32,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.dangerFaded,
    },
    leaveButtonText: {
        color: Colors.dark.danger,
        fontWeight: '600',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: Colors.dark.card,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 360,
        borderWidth: 1,
        borderColor: Colors.dark.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    modalInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        color: Colors.dark.text,
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButtonOutline: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalButtonOutlineText: {
        color: Colors.dark.text,
        fontWeight: '500',
    },
    modalButton: {
        flex: 1,
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonText: {
        color: Colors.dark.background,
        fontWeight: '600',
    },
});

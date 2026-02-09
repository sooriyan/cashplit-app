import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

interface Member {
    _id: string;
    name: string;
    email: string;
    upiId?: string;
}

interface Expense {
    _id: string;
    description: string;
    amount: number;
    paidBy: { name: string };
    createdBy: string | { _id: string };
    date: string;
}

interface Transaction {
    from: Member;
    to: Member;
    amount: number;
}

interface Group {
    _id: string;
    name: string;
    members: Member[];
    expenses: Expense[];
}

export default function GroupDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { user } = useAuth();
    const [group, setGroup] = useState<Group | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balances, setBalances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

    const fetchData = async () => {
        try {
            const [groupRes, balanceRes] = await Promise.all([
                api.getGroup(id!),
                api.getGroupBalances(id!),
            ]);
            setGroup(groupRes.data);
            setTransactions(balanceRes.data.transactions || []);
            setBalances(balanceRes.data.balances || []);
        } catch (err) {
            console.error('Failed to fetch group:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (id) fetchData();
        }, [id])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;

        try {
            await api.addMember(id!, inviteEmail);
            Alert.alert('Success', 'Member added!');
            setInviteEmail('');
            setShowInviteModal(false);
            fetchData();
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to add member');
        }
    };

    const handleMarkAsPaid = async () => {
        if (!selectedTx) return;

        try {
            await api.markSettlementPaid(id!, {
                payeeId: selectedTx.to._id,
                amount: selectedTx.amount,
            });
            setShowPayModal(false);
            fetchData();
        } catch (err) {
            Alert.alert('Error', 'Failed to mark as paid');
        }
    };

    const handleDeleteExpense = async (expenseId: string) => {
        Alert.alert(
            'Delete Expense',
            'Are you sure you want to delete this expense?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.deleteExpense(id!, expenseId);
                            fetchData();
                        } catch (err) {
                            Alert.alert('Error', 'Failed to delete expense');
                        }
                    },
                },
            ]
        );
    };

    const handleEditExpense = (expenseId: string) => {
        router.push({ pathname: '/group/add-expense', params: { groupId: id, expenseId } });
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

    if (!group) {
        return (
            <LinearGradient
                colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
                style={styles.loadingContainer}
            >
                <Text style={styles.errorText}>Group not found</Text>
            </LinearGradient>
        );
    }

    const totalSpending = group.expenses.reduce((sum, exp) => sum + exp.amount, 0);

    const enrichedBalances = balances.map((b) => {
        const member = group.members.find((m) => m._id === b.user);
        return {
            ...b,
            name: member ? member.name : 'Unknown',
            _id: member ? member._id : b.user,
        };
    });

    const userBalance = enrichedBalances.find((b) => b._id === user?.id);
    const youOwe = userBalance && userBalance.balance < 0 ? Math.abs(userBalance.balance) : 0;
    const youAreOwed = userBalance && userBalance.balance > 0 ? userBalance.balance : 0;

    return (
        <LinearGradient
            colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
            style={styles.container}
        >
            <Stack.Screen
                options={{
                    headerTitle: group.name,
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: Colors.dark.background },
                    headerTransparent: false,
                    headerTintColor: Colors.dark.text,
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={() => router.push({ pathname: '/group/settings', params: { id: group._id } })}
                            style={{ marginRight: 10 }}
                        >
                            <Ionicons name="ellipsis-vertical" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    ),
                }}
            />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.dark.primary}
                    />
                }
            >
                {/* Actions */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => router.push({ pathname: '/group/add-expense', params: { groupId: id } })}
                    >
                        <Ionicons name="receipt-outline" size={18} color={Colors.dark.background} />
                        <Text style={styles.actionButtonText}>Add Expense</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionButtonOutline}
                        onPress={() => setShowInviteModal(true)}
                    >
                        <Ionicons name="person-add-outline" size={18} color={Colors.dark.primary} />
                        <Text style={styles.actionButtonOutlineText}>Invite</Text>
                    </TouchableOpacity>
                </View>

                {/* Horizontal Summary Cards */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.summaryScroll}
                    decelerationRate="fast"
                    snapToInterval={280 + 16} // card width + gap
                >
                    {/* Total Spending */}
                    <View style={[styles.summaryCard, { backgroundColor: Colors.dark.primaryFaded }]}>
                        <View style={styles.totalCardHeader}>
                            <Ionicons name="trending-up" size={18} color={Colors.dark.primary} />
                            <Text style={styles.totalCardTitle}>Total Spending</Text>
                        </View>
                        <Text style={styles.totalAmount}>₹{totalSpending.toFixed(0)}</Text>
                        <Text style={styles.totalSubtext}>{group.expenses.length} transactions</Text>
                    </View>

                    {/* Owed by me */}
                    <View style={[styles.summaryCard, { backgroundColor: Colors.dark.dangerFaded }]}>
                        <View style={styles.totalCardHeader}>
                            <Ionicons name="arrow-down-circle" size={18} color={Colors.dark.danger} />
                            <Text style={[styles.totalCardTitle, { color: Colors.dark.danger }]}>Owed by me</Text>
                        </View>
                        <Text style={styles.totalAmount}>₹{youOwe.toFixed(0)}</Text>
                        <Text style={[styles.totalSubtext, { color: Colors.dark.danger, opacity: 1 }]}>
                            {youOwe > 0 ? 'Pending payments' : 'No debts!'}
                        </Text>
                    </View>

                    {/* Expected by me */}
                    <View style={[styles.summaryCard, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
                        <View style={styles.totalCardHeader}>
                            <Ionicons name="arrow-up-circle" size={18} color="#10b981" />
                            <Text style={[styles.totalCardTitle, { color: '#10b981' }]}>Expected by me</Text>
                        </View>
                        <Text style={styles.totalAmount}>₹{youAreOwed.toFixed(0)}</Text>
                        <Text style={[styles.totalSubtext, { color: '#10b981', opacity: 1 }]}>
                            {youAreOwed > 0 ? 'To be received' : 'All caught up!'}
                        </Text>
                    </View>
                </ScrollView>

                {/* Member Balances */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="people" size={20} color={Colors.dark.primary} />
                        <Text style={styles.sectionTitle}>Member Balances</Text>
                    </View>
                    {enrichedBalances.map((member) => {
                        const isCurrentUser = member._id === user?.id;
                        const displayName = isCurrentUser ? 'You' : member.name;

                        return (
                            <View key={member._id} style={styles.memberItem}>
                                <Avatar name={member.name} size={40} fontSize={16} rounded={true} />
                                <View style={styles.memberInfo}>
                                    <Text style={styles.memberName}>{displayName}</Text>
                                    <Text style={[
                                        styles.memberBalance,
                                        { color: member.balance > 0 ? Colors.dark.primary : member.balance < 0 ? Colors.dark.danger : Colors.dark.textMuted }
                                    ]}>
                                        {member.balance > 0
                                            ? `${isCurrentUser ? 'You are' : 'Is'} owed ₹${member.balance.toFixed(2)}`
                                            : member.balance < 0
                                                ? `${isCurrentUser ? 'You owe' : 'Owes'} ₹${Math.abs(member.balance).toFixed(2)}`
                                                : 'All settled up'}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Settle Up - Only show if current user owes money */}
                {transactions.some(tx => tx.from?._id === user?.id) && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="wallet" size={20} color={Colors.dark.primary} />
                            <Text style={styles.sectionTitle}>Settle Up</Text>
                        </View>
                        {transactions.filter(tx => tx.from?._id === user?.id).map((tx, idx) => {
                            const toName = tx.to?._id === user?.id ? 'You' : tx.to?.name || 'Unknown';

                            return (
                                <View key={idx} style={styles.settlementItem}>
                                    <View style={styles.settlementInfo}>
                                        <Text style={styles.settlementText}>
                                            <Text style={{ color: Colors.dark.danger }}>You</Text>
                                            <Text style={{ color: Colors.dark.textSecondary }}> → </Text>
                                            <Text style={{ color: Colors.dark.primary }}>{toName}</Text>
                                        </Text>
                                        <Text style={styles.settlementAmount}>₹{tx.amount.toFixed(2)}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.payButton}
                                        onPress={() => {
                                            setSelectedTx(tx);
                                            setShowPayModal(true);
                                        }}
                                    >
                                        <Text style={styles.payButtonText}>Pay Now</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Recent Expenses */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <Ionicons name="list" size={20} color={Colors.dark.primary} />
                            <Text style={styles.sectionTitle}>Recent Expenses</Text>
                        </View>
                        {group.expenses.length > 0 && (
                            <TouchableOpacity onPress={() => router.push({ pathname: '/group/all-expenses', params: { groupId: id } })}>
                                <Text style={styles.showAllText}>Show All</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    {group.expenses.length === 0 ? (
                        <Text style={styles.noExpenses}>No expenses yet</Text>
                    ) : (
                        group.expenses.slice().reverse().slice(0, 5).map((expense) => {
                            const createdById = typeof expense.createdBy === 'string'
                                ? expense.createdBy
                                : expense.createdBy?._id;
                            const isCreator = createdById === user?.id;

                            return (
                                <TouchableOpacity
                                    key={expense._id}
                                    style={styles.expenseItem}
                                    onPress={() => isCreator && handleEditExpense(expense._id)}
                                    activeOpacity={isCreator ? 0.7 : 1}
                                >
                                    <Avatar name={expense.description} size={40} fontSize={16} rounded={true} />
                                    <View style={styles.expenseInfo}>
                                        <Text style={styles.expenseDescription}>{expense.description}</Text>
                                        <Text style={styles.expensePaidBy}>Paid by {expense.paidBy?.name || 'Unknown'}</Text>
                                    </View>
                                    <View style={styles.expenseRight}>
                                        <Text style={styles.expenseAmount}>₹{expense.amount}</Text>
                                        {isCreator && (
                                            <View style={styles.expenseActions}>
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteExpense(expense._id)}
                                                    style={styles.expenseActionButton}
                                                >
                                                    <Ionicons name="trash" size={16} color={Colors.dark.danger} />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>
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
                            <TouchableOpacity style={styles.modalButton} onPress={handleInvite}>
                                <Text style={styles.modalButtonText}>Add Member</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Pay Modal */}
            <Modal visible={showPayModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Settle Up</Text>
                        <Text style={styles.payModalSubtitle}>
                            Paying <Text style={{ fontWeight: '600' }}>{selectedTx?.to.name}</Text>
                        </Text>
                        <Text style={styles.payModalAmount}>₹{selectedTx?.amount.toFixed(2)}</Text>

                        {selectedTx?.to.upiId && (
                            <View style={styles.upiSection}>
                                <View style={styles.upiBox}>
                                    <Text style={styles.upiLabel}>UPI ID</Text>
                                    <Text style={styles.upiId}>{selectedTx.to.upiId}</Text>
                                </View>

                                <View style={styles.upiActions}>
                                    <TouchableOpacity
                                        style={styles.upiActionButton}
                                        onPress={() => {
                                            Clipboard.setStringAsync(selectedTx.to.upiId || '');
                                            Alert.alert('Copied!', 'UPI ID copied to clipboard');
                                        }}
                                    >
                                        <Ionicons name="copy-outline" size={18} color={Colors.dark.primary} />
                                        <Text style={styles.upiActionText}>Copy UPI</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.upiPayButton}
                                        onPress={() => {
                                            const upiUrl = `upi://pay?pa=${selectedTx.to.upiId}&pn=${encodeURIComponent(selectedTx.to.name)}&am=${selectedTx.amount.toFixed(2)}&cu=INR`;
                                            Linking.openURL(upiUrl).catch(() => {
                                                Alert.alert('Error', 'No UPI app found on this device');
                                            });
                                        }}
                                    >
                                        <Ionicons name="open-outline" size={18} color={Colors.dark.background} />
                                        <Text style={styles.upiPayButtonText}>Pay via UPI</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalButtonOutline}
                                onPress={() => setShowPayModal(false)}
                            >
                                <Text style={styles.modalButtonOutlineText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalButton} onPress={handleMarkAsPaid}>
                                <Text style={styles.modalButtonText}>Mark as Paid</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    errorText: {
        color: Colors.dark.textSecondary,
    },
    scrollContent: {
        padding: 16,
        paddingTop: 20, // Reduced padding since header is no longer transparent
        paddingBottom: 100,
    },
    summaryScroll: {
        paddingRight: 16,
        gap: 16,
        marginBottom: 24,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        paddingVertical: 12,
    },
    actionButtonText: {
        color: Colors.dark.background,
        fontWeight: '600',
        fontSize: 14,
    },
    actionButtonOutline: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.dark.primary,
        borderRadius: 8,
        paddingVertical: 12,
    },
    actionButtonOutlineText: {
        color: Colors.dark.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    summaryCard: {
        width: 280,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    totalCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    totalCardTitle: {
        fontSize: 13,
        color: Colors.dark.primary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    totalAmount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    totalSubtext: {
        fontSize: 12,
        color: Colors.dark.primary,
        opacity: 0.8,
        marginTop: 4,
    },
    section: {
        backgroundColor: 'rgba(18, 18, 18, 0.8)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.borderLight,
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.dark.primaryFaded,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    memberAvatarText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.primary,
    },
    memberInfo: {
        flex: 1,
        marginLeft: 16,
    },
    memberName: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.dark.text,
    },
    memberBalance: {
        fontSize: 13,
        marginTop: 2,
    },
    emptySettlements: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    emptyIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.primary,
    },
    emptySubtext: {
        fontSize: 13,
        color: Colors.dark.textMuted,
        marginTop: 4,
    },
    settlementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        padding: 14,
        marginBottom: 10,
    },
    settlementInfo: {
        flex: 1,
    },
    settlementText: {
        fontSize: 14,
        color: Colors.dark.text,
    },
    settlementAmount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginTop: 4,
    },
    payButton: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    payButtonText: {
        color: Colors.dark.background,
        fontWeight: '600',
        fontSize: 13,
    },
    noExpenses: {
        color: Colors.dark.textMuted,
        textAlign: 'center',
        paddingVertical: 16,
    },
    expenseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        padding: 14,
        marginBottom: 8,
    },
    expenseInfo: {
        flex: 1,
        marginLeft: 16,
    },
    expenseDescription: {
        fontSize: 15,
        fontWeight: '500',
        color: Colors.dark.text,
    },
    expensePaidBy: {
        fontSize: 12,
        color: Colors.dark.textMuted,
        marginTop: 2,
    },
    expenseAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.text,
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
    },
    modalButtonText: {
        color: Colors.dark.background,
        fontWeight: '600',
    },
    payModalSubtitle: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        textAlign: 'center',
    },
    payModalAmount: {
        fontSize: 36,
        fontWeight: 'bold',
        color: Colors.dark.primary,
        textAlign: 'center',
        marginVertical: 20,
    },
    upiBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        marginBottom: 20,
        alignItems: 'center',
    },
    upiLabel: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
        marginBottom: 4,
    },
    upiId: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    upiSection: {
        marginBottom: 20,
    },
    upiActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    upiActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        paddingVertical: 10,
    },
    upiActionText: {
        color: Colors.dark.text,
        fontSize: 13,
        fontWeight: '500',
    },
    upiPayButton: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        paddingVertical: 10,
    },
    upiPayButtonText: {
        color: Colors.dark.background,
        fontSize: 13,
        fontWeight: '600',
    },
    expenseRight: {
        alignItems: 'flex-end',
    },
    expenseActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    expenseActionButton: {
        padding: 4,
    },
    showAllText: {
        fontSize: 13,
        color: Colors.dark.primary,
        fontWeight: '600',
    },
});

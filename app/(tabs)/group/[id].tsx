import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../../components/Avatar';
import { CustomAlert, AlertType } from '../../../components/CustomAlert';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import AdBanner from '../../../components/AdBanner';

interface Member {
    _id: string;
    name: string;
    email: string;
    phone?: string;
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
    const insets = useSafeAreaInsets();
    const [group, setGroup] = useState<Group | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [balances, setBalances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);
    const [showMemberPicker, setShowMemberPicker] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(user?.id || null);
    const [suggestions, setSuggestions] = useState<Member[]>([]);
    const [selectedInvites, setSelectedInvites] = useState<Member[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

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

    const fetchData = async () => {
        setLoading(true);
        setGroup(null);
        try {
            const [groupRes, balanceRes, suggestionsRes] = await Promise.all([
                api.getGroup(id!),
                api.getGroupBalances(id!),
                api.getUserSuggestions(),
            ]);
            setGroup(groupRes.data);
            setTransactions(balanceRes.data.transactions || []);
            setBalances(balanceRes.data.balances || []);
            console.log('Suggestions fetched:', suggestionsRes.data?.length || 0);
            setSuggestions(suggestionsRes.data || []);
        } catch (err) {
            console.error('Failed to fetch group:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (id) {
                setLoading(true);
                setGroup(null);
                fetchData();
            }
        }, [id])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleInvite = async () => {
        const emails = selectedInvites.map(s => s.email);

        if (emails.length === 0) return;

        try {
            await api.addMembers(id!, emails);
            setSelectedInvites([]);
            setSearchQuery('');
            setShowInviteModal(false);
            fetchData();
            showAlert('Success', 'Invitations processed successfully', 'success');
        } catch (err: any) {
            showAlert('Error', err.response?.data?.message || 'Failed to send invitations', 'error');
        }
    };

    const toggleInvite = (member: Member) => {
        if (selectedInvites.some(s => s._id === member._id)) {
            setSelectedInvites(selectedInvites.filter(s => s._id !== member._id));
        } else {
            setSelectedInvites([...selectedInvites, member]);
        }
    };

    const filteredSuggestions = suggestions.filter(s => {
        if (!group) return false;

        // Safety check for required fields
        if (!s.email) return false;

        const isAlreadyMember = group.members.some(m => m.email === s.email);
        const filtered = !isAlreadyMember;

        if (searchQuery.length === 0) return filtered;

        const query = searchQuery.toLowerCase();
        return (
            (s.name && s.name.toLowerCase().includes(query)) ||
            (s.email && s.email.toLowerCase().includes(query)) ||
            (s.phone && s.phone.includes(query))
        );
    });

    console.log('Filtered suggestions:', filteredSuggestions.length, 'query:', searchQuery);

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
            showAlert('Error', 'Failed to mark as paid', 'error');
        }
    };

    const handleDeleteExpense = async (expenseId: string) => {
        showAlert(
            'Delete Expense',
            'Are you sure you want to delete this expense?',
            'warning',
            async () => {
                try {
                    await api.deleteExpense(id!, expenseId);
                    fetchData();
                    hideAlert();
                } catch (err) {
                    showAlert('Error', 'Failed to delete expense', 'error');
                }
            },
            'Cancel',
            () => hideAlert()
        );
    };

    const handleEditExpense = (expenseId: string) => {
        router.push({ pathname: '/group/add-expense', params: { groupId: id, expenseId } });
    };

    if (loading || !group) {
        return (
            <LinearGradient
                colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
                style={styles.container}
            >
                <Stack.Screen
                    options={{
                        headerTitle: 'Loading...',
                        headerShadowVisible: false,
                        headerStyle: { backgroundColor: Colors.dark.background },
                        headerTransparent: false,
                        headerTintColor: Colors.dark.text,
                        headerLeft: () => (
                            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                                <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                            </TouchableOpacity>
                        ),
                    }}
                />
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Skeleton Actions */}
                    <View style={styles.actionsRow}>
                        <View style={[styles.skeleton, { width: 120, height: 40, borderRadius: 10 }]} />
                        <View style={[styles.skeleton, { width: 80, height: 40, borderRadius: 10 }]} />
                    </View>

                    {/* Skeleton Summary */}
                    <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
                        <View style={[styles.skeleton, { width: 200, height: 120, borderRadius: 20 }]} />
                        <View style={[styles.skeleton, { width: 200, height: 120, borderRadius: 20 }]} />
                    </View>

                    {/* Skeleton Section */}
                    <View style={styles.sectionHeader}>
                        <View style={[styles.skeleton, { width: 150, height: 24, borderRadius: 4 }]} />
                    </View>
                    {[1, 2].map(i => (
                        <View key={i} style={[styles.memberItem, { opacity: 0.5 }]}>
                            <View style={[styles.skeleton, { width: 40, height: 40, borderRadius: 20 }]} />
                            <View style={[styles.memberInfo, { gap: 8 }]}>
                                <View style={[styles.skeleton, { width: '60%', height: 16, borderRadius: 4 }]} />
                                <View style={[styles.skeleton, { width: '40%', height: 14, borderRadius: 4 }]} />
                            </View>
                        </View>
                    ))}

                    <View style={[styles.sectionHeader, { marginTop: 24 }]}>
                        <View style={[styles.skeleton, { width: 120, height: 24, borderRadius: 4 }]} />
                    </View>
                    {[1, 2, 3].map(i => (
                        <View key={i} style={[styles.expenseItem, { opacity: 0.5 }]}>
                            <View style={[styles.skeleton, { width: 40, height: 40, borderRadius: 20 }]} />
                            <View style={[styles.expenseInfo, { gap: 8 }]}>
                                <View style={[styles.skeleton, { width: '70%', height: 16, borderRadius: 4 }]} />
                                <View style={[styles.skeleton, { width: '30%', height: 12, borderRadius: 4 }]} />
                            </View>
                            <View style={[styles.skeleton, { width: 60, height: 20, borderRadius: 4 }]} />
                        </View>
                    ))}
                </ScrollView>
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
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 10 }}>
                            <Ionicons name="arrow-back" size={24} color={Colors.dark.text} />
                        </TouchableOpacity>
                    ),
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
                contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
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

                {/* Balances Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                            <Ionicons name="people" size={20} color={Colors.dark.primary} />
                            <Text style={styles.sectionTitle}>Balances</Text>
                        </View>

                        {/* Member Picker as Badge */}
                        {(() => {
                            const selectedMember = group?.members.find(m => m._id === selectedMemberId);
                            return (
                                <>
                                    <TouchableOpacity
                                        style={styles.pickerBadge}
                                        onPress={() => setShowMemberPicker(true)}
                                    >
                                        <Text style={styles.pickerBadgeText}>
                                            {selectedMember?._id === user?.id ? 'Me' : selectedMember?.name}
                                        </Text>
                                        <Ionicons name="chevron-down" size={14} color={Colors.dark.primary} />
                                    </TouchableOpacity>

                                    {/* Custom Themed Member Picker Modal */}
                                    <Modal
                                        visible={showMemberPicker}
                                        transparent={true}
                                        animationType="fade"
                                        onRequestClose={() => setShowMemberPicker(false)}
                                    >
                                        <TouchableOpacity
                                            style={styles.modalOverlay}
                                            activeOpacity={1}
                                            onPress={() => setShowMemberPicker(false)}
                                        >
                                            <View style={[styles.modalContent, { maxHeight: '60%' }]}>
                                                <Text style={styles.modalTitle}>Select Member</Text>
                                                <ScrollView>
                                                    {group?.members.map((member) => (
                                                        <TouchableOpacity
                                                            key={member._id}
                                                            style={[
                                                                styles.memberSelectItem,
                                                                selectedMemberId === member._id && styles.memberSelected
                                                            ]}
                                                            onPress={() => {
                                                                setSelectedMemberId(member._id);
                                                                setShowMemberPicker(false);
                                                            }}
                                                        >
                                                            <Avatar name={member.name} size={32} fontSize={14} rounded={true} />
                                                            <Text style={[
                                                                styles.memberSelectName,
                                                                selectedMemberId === member._id && { color: Colors.dark.primary }
                                                            ]}>
                                                                {member._id === user?.id ? `Me (${member.name})` : member.name}
                                                            </Text>
                                                            {selectedMemberId === member._id && (
                                                                <Ionicons name="checkmark-circle" size={20} color={Colors.dark.primary} />
                                                            )}
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        </TouchableOpacity>
                                    </Modal>
                                </>
                            );
                        })()}
                    </View>

                    {(() => {
                        const isMe = selectedMemberId === user?.id;
                        const selectedMember = group.members.find(m => m._id === selectedMemberId);

                        const myOutgoing = transactions.filter(tx => tx.from?._id === selectedMemberId);
                        const myIncoming = transactions.filter(tx => tx.to?._id === selectedMemberId);

                        return (
                            <>
                                {/* What you/they owe */}
                                {myOutgoing.length > 0 ? (
                                    myOutgoing.map((tx, idx) => (
                                        <View key={`owe-${idx}`} style={styles.memberItem}>
                                            <Avatar name={tx.to?.name || 'Unknown'} size={40} fontSize={16} rounded={true} />
                                            <View style={styles.memberInfo}>
                                                <Text style={styles.memberName}>
                                                    {isMe ? 'You owe' : `${selectedMember?.name} owes`} {tx.to?.name}
                                                </Text>
                                                <Text style={[styles.memberBalance, { color: Colors.dark.danger }]}>
                                                    ₹{tx.amount.toFixed(2)}
                                                </Text>
                                            </View>
                                            {isMe && (
                                                <TouchableOpacity
                                                    style={styles.payButton}
                                                    onPress={() => {
                                                        setSelectedTx(tx);
                                                        setShowPayModal(true);
                                                    }}
                                                >
                                                    <Text style={styles.payButtonText}>Pay Now</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))
                                ) : null}

                                {/* What you/they are owed */}
                                {myIncoming.length > 0 ? (
                                    myIncoming.map((tx, idx) => (
                                        <View key={`owed-${idx}`} style={styles.memberItem}>
                                            <Avatar name={tx.from?.name || 'Unknown'} size={40} fontSize={16} rounded={true} />
                                            <View style={styles.memberInfo}>
                                                <Text style={styles.memberName}>
                                                    {tx.from?.name} owes {isMe ? 'you' : selectedMember?.name}
                                                </Text>
                                                <Text style={[styles.memberBalance, { color: Colors.dark.primary }]}>
                                                    ₹{tx.amount.toFixed(2)}
                                                </Text>
                                            </View>
                                            {isMe && tx.from?.upiId && (
                                                <TouchableOpacity
                                                    style={[styles.payButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.dark.primary }]}
                                                    onPress={() => {
                                                        Clipboard.setStringAsync(tx.from?.upiId || '');
                                                        showAlert('Copied!', 'UPI ID copied to clipboard', 'info');
                                                    }}
                                                >
                                                    <Text style={[styles.payButtonText, { color: Colors.dark.primary }]}>Copy UPI</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))
                                ) : null}

                                {myOutgoing.length === 0 && myIncoming.length === 0 && (
                                    <Text style={styles.noExpenses}>No pending balances for {isMe ? 'you' : selectedMember?.name}</Text>
                                )}
                            </>
                        );
                    })()}
                </View>


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

                {/* Advertisement */}
                <AdBanner />
            </ScrollView>

            {/* Invite Modal */}
            <Modal visible={showInviteModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '85%', padding: 0, overflow: 'hidden' }]}>
                        <View style={{ paddingHorizontal: 24, paddingTop: 24, marginBottom: 16 }}>
                            <Text style={styles.modalTitle}>Invite Friends</Text>

                            {/* Selected Badges */}
                            {selectedInvites.length > 0 && (
                                <View style={styles.selectedBadges}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                        {selectedInvites.map(s => (
                                            <TouchableOpacity
                                                key={s._id}
                                                style={styles.badge}
                                                onPress={() => toggleInvite(s)}
                                            >
                                                <Text style={styles.badgeText}>{s.name || s.email}</Text>
                                                <Ionicons name="close-circle" size={14} color={Colors.dark.primary} />
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <TextInput
                                style={styles.modalInput}
                                placeholder="Search by name, email or phone..."
                                placeholderTextColor={Colors.dark.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                            />
                        </View>

                        <ScrollView
                            style={{ flexGrow: 0 }}
                            contentContainerStyle={{ paddingHorizontal: 24 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View>
                                <Text style={styles.sectionTitleSmall}>
                                    {searchQuery.length > 0 ? 'Search Results' : 'Suggestions'}
                                </Text>
                                {filteredSuggestions.length === 0 ? (
                                    <Text style={styles.emptyTextSmall}>
                                        {searchQuery.length > 0 ? 'No friends found' : 'No suggestions available'}
                                    </Text>
                                ) : (
                                    filteredSuggestions.map(s => (
                                        <TouchableOpacity
                                            key={s._id}
                                            style={styles.suggestionItem}
                                            onPress={() => toggleInvite(s)}
                                        >
                                            <Avatar name={s.name || s.email} size={36} fontSize={14} rounded />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.suggestionName}>{s.name || 'Unknown'}</Text>
                                                <Text style={styles.suggestionEmail}>{s.email}</Text>
                                            </View>
                                            <Ionicons
                                                name={selectedInvites.some(si => si._id === s._id) ? "checkbox" : "square-outline"}
                                                size={22}
                                                color={Colors.dark.primary}
                                            />
                                        </TouchableOpacity>
                                    ))
                                )}

                                {/* Direct Email Invite if query looks like email */}
                                {searchQuery.includes('@') && !suggestions.some(s => s.email === searchQuery.toLowerCase()) && (
                                    <TouchableOpacity
                                        style={styles.suggestionItem}
                                        onPress={() => {
                                            const email = searchQuery.toLowerCase().trim();
                                            if (!selectedInvites.some(s => s.email === email)) {
                                                setSelectedInvites([...selectedInvites, { _id: Date.now().toString(), name: email.split('@')[0], email }]);
                                                setSearchQuery('');
                                            }
                                        }}
                                    >
                                        <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                                            <Ionicons name="mail-outline" size={20} color={Colors.dark.textSecondary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.suggestionName}>Invite "{searchQuery}"</Text>
                                            <Text style={styles.suggestionEmail}>Add new email address</Text>
                                        </View>
                                        <Ionicons name="add-circle" size={24} color={Colors.dark.primary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </ScrollView>

                        <View style={[styles.modalActions, { paddingHorizontal: 24, paddingBottom: 24, marginTop: 16 }]}>
                            <TouchableOpacity
                                style={styles.modalButtonOutline}
                                onPress={() => {
                                    setShowInviteModal(false);
                                    setSearchQuery('');
                                    setSelectedInvites([]);
                                }}
                            >
                                <Text style={styles.modalButtonOutlineText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, (selectedInvites.length === 0 && !searchQuery.includes('@')) && { opacity: 0.5 }]}
                                onPress={handleInvite}
                                disabled={selectedInvites.length === 0 && !searchQuery.includes('@')}
                            >
                                <Text style={styles.modalButtonText}>
                                    Invite {selectedInvites.length > 0 ? `(${selectedInvites.length})` : ''}
                                </Text>
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
                                            showAlert('Copied!', 'UPI ID copied to clipboard', 'info');
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
                                                showAlert('Error', 'No UPI app found on this device', 'error');
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
    skeleton: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    pickerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 6,
        minWidth: 60,
        justifyContent: 'center',
    },
    pickerBadgeText: {
        color: Colors.dark.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    memberSelectItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 10,
        gap: 12,
        marginBottom: 4,
    },
    memberSelected: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    memberSelectName: {
        flex: 1,
        fontSize: 16,
        color: Colors.dark.text,
        fontWeight: '500',
    },
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
        paddingBottom: 40,
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
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    toggleLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.dark.primary,
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
    selectedBadges: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    badgeText: {
        color: Colors.dark.primary,
        fontSize: 12,
        fontWeight: '600',
    },
    sectionTitleSmall: {
        fontSize: 12,
        color: Colors.dark.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    emptyTextSmall: {
        color: Colors.dark.textMuted,
        fontSize: 14,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 10,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    suggestionName: {
        color: Colors.dark.text,
        fontSize: 15,
        fontWeight: '500',
    },
    suggestionEmail: {
        color: Colors.dark.textMuted,
        fontSize: 12,
    },
    avatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

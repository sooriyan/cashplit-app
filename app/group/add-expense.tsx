import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Avatar, getAvatarColor } from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

type SplitType = 'equal' | 'percentage';

interface Member {
    _id: string;
    name: string;
    email: string;
}

export default function AddExpenseScreen() {
    const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId?: string }>();
    const { user } = useAuth();

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [paidBy, setPaidBy] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [splitType, setSplitType] = useState<SplitType>('equal');
    const [percentages, setPercentages] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [fetchingGroup, setFetchingGroup] = useState(true);
    const [showPayerPicker, setShowPayerPicker] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!groupId) return;

            try {
                const res = await api.getGroup(groupId);
                const group = res.data;
                setMembers(group.members);

                if (expenseId) {
                    setIsEditing(true);
                    const expenseRes = await api.getExpense(groupId, expenseId);
                    const expense = expenseRes.data;

                    setDescription(expense.description);
                    setAmount(expense.amount.toString());
                    setPaidBy(typeof expense.paidBy === 'string' ? expense.paidBy : expense.paidBy._id);
                    setSplitType(expense.splitType);

                    const participantIds = expense.splitDetails.map((sd: any) => sd.user._id || sd.user);
                    setSelectedMembers(participantIds);

                    const initialPercentages: Record<string, string> = {};
                    expense.splitDetails.forEach((sd: any) => {
                        const uid = sd.user._id || sd.user;
                        initialPercentages[uid] = sd.percentage ? sd.percentage.toString() : '';
                    });
                    setPercentages(initialPercentages);
                } else {
                    // Select all members by default for new expense
                    const allIds = group.members.map((m: Member) => m._id);
                    setSelectedMembers(allIds);

                    // Set current user as default payer
                    if (user?.id) {
                        setPaidBy(user.id);
                    }

                    // Initialize empty percentages
                    const initialPercentages: Record<string, string> = {};
                    group.members.forEach((m: Member) => {
                        initialPercentages[m._id] = '';
                    });
                    setPercentages(initialPercentages);
                }
            } catch (err) {
                console.error('Failed to fetch data:', err);
                Alert.alert('Error', 'Failed to load data');
            } finally {
                setFetchingGroup(false);
            }
        };

        fetchInitialData();
    }, [groupId, expenseId, user?.id]);

    const toggleMember = (memberId: string) => {
        if (selectedMembers.includes(memberId)) {
            setSelectedMembers(selectedMembers.filter((m) => m !== memberId));
        } else {
            setSelectedMembers([...selectedMembers, memberId]);
        }
    };

    const updatePercentage = (memberId: string, value: string) => {
        setPercentages({ ...percentages, [memberId]: value });
    };

    const getTotalPercentage = () => {
        return selectedMembers.reduce((sum, id) => sum + parseFloat(percentages[id] || '0'), 0);
    };

    const distributeEqually = () => {
        if (selectedMembers.length === 0) return;
        const equalPercent = (100 / selectedMembers.length).toFixed(2);
        const newPercentages: Record<string, string> = {};
        selectedMembers.forEach((id) => {
            newPercentages[id] = equalPercent;
        });
        setPercentages(newPercentages);
    };

    const handleSubmit = async () => {
        if (!description.trim()) {
            Alert.alert('Error', 'Please enter a description');
            return;
        }

        if (!amount || parseFloat(amount) <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        if (!paidBy) {
            Alert.alert('Error', 'Please select who paid');
            return;
        }

        if (selectedMembers.length === 0) {
            Alert.alert('Error', 'Please select at least one person to split with');
            return;
        }

        if (splitType === 'percentage') {
            const total = getTotalPercentage();
            if (Math.abs(total - 100) > 0.01) {
                Alert.alert('Error', `Percentages must sum to 100% (currently ${total.toFixed(2)}%)`);
                return;
            }
        }

        setLoading(true);

        try {
            const payload: any = {
                description,
                amount: parseFloat(amount),
                paidBy,
                splitBetween: selectedMembers,
                splitType,
            };

            if (splitType === 'percentage') {
                const percentageValues: Record<string, number> = {};
                selectedMembers.forEach((id) => {
                    percentageValues[id] = parseFloat(percentages[id] || '0');
                });
                payload.percentages = percentageValues;
            }

            if (isEditing && expenseId) {
                await api.updateExpense(groupId!, expenseId, payload);
            } else {
                await api.addExpense(groupId!, payload);
            }
            router.back();
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || `Failed to ${isEditing ? 'update' : 'add'} expense`);
        } finally {
            setLoading(false);
        }
    };

    if (fetchingGroup) {
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
            <Stack.Screen
                options={{
                    headerTitle: isEditing ? 'Edit Expense' : 'Add Expense',
                    headerShadowVisible: false,
                    headerStyle: { backgroundColor: Colors.dark.background },
                    headerTintColor: Colors.dark.text,
                }}
            />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Amount Display */}
                <View style={styles.amountContainer}>
                    <Text style={styles.amountLabel}>Amount</Text>
                    <View style={styles.amountRow}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <TextInput
                            style={styles.amountInput}
                            placeholder="0"
                            placeholderTextColor={Colors.dark.primary + '50'}
                            keyboardType="decimal-pad"
                            value={amount}
                            onChangeText={setAmount}
                        />
                    </View>
                </View>

                {/* Description */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Dinner, Taxi, Groceries..."
                        placeholderTextColor={Colors.dark.textMuted}
                        value={description}
                        onChangeText={setDescription}
                    />
                </View>

                {/* Paid By */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Paid By</Text>
                    <TouchableOpacity
                        style={styles.dropdownButton}
                        onPress={() => setShowPayerPicker(true)}
                    >
                        <Text style={paidBy ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                            {paidBy
                                ? (members.find(m => m._id === paidBy)?.name + (paidBy === user?.id ? ' (You)' : ''))
                                : 'Select who paid'
                            }
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={Colors.dark.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Payer Picker Modal */}
                <Modal
                    visible={showPayerPicker}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowPayerPicker(false)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowPayerPicker(false)}
                    >
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Who paid?</Text>
                            <FlatList
                                data={members}
                                keyExtractor={(item) => item._id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.modalItem,
                                            paidBy === item._id && styles.modalItemSelected
                                        ]}
                                        onPress={() => {
                                            setPaidBy(item._id);
                                            setShowPayerPicker(false);
                                        }}
                                    >
                                        <Text style={[
                                            styles.modalItemText,
                                            paidBy === item._id && styles.modalItemTextSelected
                                        ]}>
                                            {item._id === user?.id ? `${item.name} (You)` : item.name}
                                        </Text>
                                        {paidBy === item._id && (
                                            <Ionicons name="checkmark" size={20} color={Colors.dark.primary} />
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Split Type */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Split Type</Text>
                    <View style={styles.splitTypeRow}>
                        <TouchableOpacity
                            style={[
                                styles.splitTypeButton,
                                splitType === 'equal' && styles.splitTypeButtonActive
                            ]}
                            onPress={() => setSplitType('equal')}
                        >
                            <Text style={[
                                styles.splitTypeText,
                                splitType === 'equal' && styles.splitTypeTextActive
                            ]}>Equal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.splitTypeButton,
                                splitType === 'percentage' && styles.splitTypeButtonActive
                            ]}
                            onPress={() => setSplitType('percentage')}
                        >
                            <Text style={[
                                styles.splitTypeText,
                                splitType === 'percentage' && styles.splitTypeTextActive
                            ]}>Percentage</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Split With */}
                <View style={styles.inputGroup}>
                    <View style={styles.splitWithHeader}>
                        <Text style={styles.label}>Split With</Text>
                        {splitType === 'percentage' && (
                            <Text style={[
                                styles.percentageTotal,
                                { color: Math.abs(getTotalPercentage() - 100) < 0.01 ? Colors.dark.primary : Colors.dark.danger }
                            ]}>
                                Total: {getTotalPercentage().toFixed(1)}%
                            </Text>
                        )}
                    </View>

                    {/* Equal split - Badge UI */}
                    {splitType === 'equal' && (
                        <View style={styles.badgeContainer}>
                            {members.map((member) => {
                                const isSelected = selectedMembers.includes(member._id);
                                return (
                                    <View key={member._id} style={styles.memberBadgeWrapper}>
                                        <TouchableOpacity
                                            style={[
                                                styles.avatarBadge,
                                                { borderColor: getAvatarColor(member.name) },
                                                isSelected && styles.avatarBadgeSelected
                                            ]}
                                            onPress={() => toggleMember(member._id)}
                                        >
                                            <Avatar name={member.name} size={40} fontSize={14} borderWidth={0} />
                                            <Text
                                                style={[styles.badgeName, isSelected && styles.badgeNameSelected]}
                                                numberOfLines={1}
                                            >
                                                {member.name.split(' ')[0]}
                                            </Text>
                                            {isSelected && (
                                                <View style={styles.badgeCheck}>
                                                    <Ionicons name="checkmark-circle" size={16} color={Colors.dark.primary} />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    {/* Percentage split - List UI with checkboxes */}
                    {splitType === 'percentage' && (
                        <View style={styles.percentageListContainer}>
                            {members.map((member) => {
                                const isSelected = selectedMembers.includes(member._id);
                                return (
                                    <View key={member._id} style={styles.percentageListRow}>
                                        <TouchableOpacity
                                            style={styles.percentageCheckboxArea}
                                            onPress={() => toggleMember(member._id)}
                                        >
                                            <View style={[
                                                styles.checkbox,
                                                isSelected && styles.checkboxSelected
                                            ]}>
                                                {isSelected && (
                                                    <Ionicons name="checkmark" size={14} color={Colors.dark.background} />
                                                )}
                                            </View>
                                            <Avatar name={member.name} size={36} fontSize={12} borderWidth={0} />
                                            <Text
                                                style={[styles.percentageListName, isSelected && styles.percentageListNameSelected]}
                                                numberOfLines={1}
                                            >
                                                {member.name}{member._id === user?.id ? ' (You)' : ''}
                                            </Text>
                                        </TouchableOpacity>
                                        <View style={styles.percentageInputContainer}>
                                            <TextInput
                                                style={[
                                                    styles.percentageListInput,
                                                    !isSelected && styles.percentageListInputDisabled
                                                ]}
                                                keyboardType="decimal-pad"
                                                placeholder="0"
                                                placeholderTextColor={Colors.dark.textMuted}
                                                value={percentages[member._id] || ''}
                                                onChangeText={(value) => updatePercentage(member._id, value)}
                                                editable={isSelected}
                                            />
                                            <Text style={[
                                                styles.percentageListSymbol,
                                                !isSelected && styles.percentageListSymbolDisabled
                                            ]}>%</Text>
                                        </View>
                                    </View>
                                );
                            })}
                            <TouchableOpacity style={styles.distributeButton} onPress={distributeEqually}>
                                <Text style={styles.distributeButtonText}>Distribute Equally</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitButton, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={Colors.dark.background} />
                    ) : (
                        <Text style={styles.submitButtonText}>{isEditing ? 'Update Expense' : 'Add Expense'}</Text>
                    )}
                </TouchableOpacity>
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
    amountContainer: {
        alignItems: 'center',
        paddingVertical: 24,
        marginBottom: 20,
    },
    amountLabel: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        marginBottom: 8,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    currencySymbol: {
        fontSize: 36,
        fontWeight: 'bold',
        color: Colors.dark.primary,
        marginRight: 4,
    },
    amountInput: {
        fontSize: 48,
        fontWeight: 'bold',
        color: Colors.dark.primary,
        minWidth: 100,
        textAlign: 'center',
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
    pickerContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        overflow: 'hidden',
    },
    picker: {
        color: Colors.dark.text,
        height: 50,
    },
    splitTypeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    splitTypeButton: {
        flex: 1,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        alignItems: 'center',
    },
    splitTypeButtonActive: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primary,
    },
    splitTypeText: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.dark.textSecondary,
    },
    splitTypeTextActive: {
        color: Colors.dark.background,
    },
    splitWithHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    percentageTotal: {
        fontSize: 12,
        fontWeight: '500',
    },
    membersContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        padding: 12,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
    },
    memberCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    memberName: {
        fontSize: 15,
        color: Colors.dark.text,
    },
    percentageInput: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    percentageTextInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 6,
        width: 60,
        height: 36,
        textAlign: 'center',
        fontSize: 14,
        color: Colors.dark.text,
    },
    percentageSymbol: {
        fontSize: 12,
        color: Colors.dark.textMuted,
    },
    perPersonAmount: {
        fontSize: 14,
        color: Colors.dark.primary,
        fontWeight: '500',
    },
    badgeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 10,
    },
    memberBadgeWrapper: {
        marginBottom: 12,
    },
    avatarBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 30,
        padding: 4,
        paddingRight: 12,
        gap: 8,
        borderWidth: 1.5,
    },
    avatarBadgeSelected: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: Colors.dark.primary, // This might be overridden by inline style, but good for default
    },
    badgeCheck: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: Colors.dark.background,
        borderRadius: 10,
    },
    badgeName: {
        fontSize: 13,
        color: Colors.dark.textSecondary,
    },
    badgeNameSelected: {
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    badgePercentageInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 6,
        paddingHorizontal: 6,
        marginTop: 4,
    },
    badgePercentageTextInput: {
        color: Colors.dark.text,
        fontSize: 12,
        paddingVertical: 2,
        width: 30,
        textAlign: 'center',
    },
    badgePercentageSymbol: {
        color: Colors.dark.textSecondary,
        fontSize: 10,
    },
    distributeButton: {
        marginTop: 12,
    },
    distributeButtonText: {
        fontSize: 13,
        color: Colors.dark.primary,
        fontWeight: '500',
    },
    submitButton: {
        backgroundColor: Colors.dark.primary,
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: Colors.dark.background,
        fontSize: 16,
        fontWeight: '600',
    },
    // Custom dropdown styles
    dropdownButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        padding: 14,
    },
    dropdownButtonText: {
        fontSize: 16,
        color: Colors.dark.text,
    },
    dropdownButtonPlaceholder: {
        fontSize: 16,
        color: Colors.dark.textMuted,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: Colors.dark.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.dark.border,
        width: '100%',
        maxHeight: 400,
        padding: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: Colors.dark.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    modalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    modalItemSelected: {
        backgroundColor: Colors.dark.primaryFaded,
    },
    modalItemText: {
        fontSize: 16,
        color: Colors.dark.text,
    },
    modalItemTextSelected: {
        color: Colors.dark.primary,
        fontWeight: '600',
    },
    // Percentage list styles
    percentageListContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 8,
        padding: 12,
    },
    percentageListRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.dark.border + '40',
    },
    percentageCheckboxArea: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: Colors.dark.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: Colors.dark.primary,
        borderColor: Colors.dark.primary,
    },
    percentageListName: {
        fontSize: 15,
        color: Colors.dark.textSecondary,
        flex: 1,
    },
    percentageListNameSelected: {
        color: Colors.dark.text,
        fontWeight: '500',
    },
    percentageInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    percentageListInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: Colors.dark.border,
        borderRadius: 6,
        width: 60,
        height: 36,
        textAlign: 'center',
        fontSize: 14,
        color: Colors.dark.text,
    },
    percentageListInputDisabled: {
        opacity: 0.4,
    },
    percentageListSymbol: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
    },
    percentageListSymbolDisabled: {
        opacity: 0.4,
    },
});

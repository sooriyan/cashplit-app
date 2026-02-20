import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { CustomAlert, AlertType } from '../../../components/CustomAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../../components/Avatar';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';

interface Expense {
    _id: string;
    description: string;
    amount: number;
    paidBy: { name: string };
    createdBy: string | { _id: string };
    date: string;
}

export default function AllExpensesScreen() {
    const { groupId } = useLocalSearchParams<{ groupId: string }>();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

    const fetchExpenses = async () => {
        try {
            const res = await api.getGroup(groupId!);
            setExpenses(res.data.expenses || []);
        } catch (err) {
            console.error('Failed to fetch expenses:', err);
            showAlert('Error', 'Failed to load expenses', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useCallback(() => {
        if (groupId) fetchExpenses();
    }, [groupId]);

    React.useEffect(() => {
        fetchExpenses();
    }, [groupId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchExpenses();
    };

    const handleDeleteExpense = async (expenseId: string) => {
        showAlert(
            'Delete Expense',
            'Are you sure you want to delete this expense?',
            'warning',
            async () => {
                try {
                    await api.deleteExpense(groupId!, expenseId);
                    fetchExpenses();
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
        router.push({ pathname: '/group/add-expense', params: { groupId, expenseId } });
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
            <Stack.Screen
                options={{
                    headerTitle: 'All Expenses',
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
                {expenses.length === 0 ? (
                    <Text style={styles.noExpenses}>No expenses yet</Text>
                ) : (
                    expenses.slice().reverse().map((expense) => {
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
            </ScrollView>

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
        padding: 16,
        paddingBottom: 40,
    },
    expenseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    expenseInfo: {
        flex: 1,
        marginLeft: 16,
    },
    expenseDescription: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.dark.text,
    },
    expensePaidBy: {
        fontSize: 12,
        color: Colors.dark.textSecondary,
        marginTop: 2,
    },
    expenseRight: {
        alignItems: 'flex-end',
    },
    expenseAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    expenseActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 6,
    },
    expenseActionButton: {
        padding: 4,
    },
    noExpenses: {
        color: Colors.dark.textMuted,
        textAlign: 'center',
        paddingVertical: 32,
        fontSize: 16,
    },
});

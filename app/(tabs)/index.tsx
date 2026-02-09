import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import api from '../../services/api';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Group {
  _id: string;
  name: string;
  members: any[];
}

interface GroupBalance {
  groupId: string;
  balance: number;
}

export default function DashboardScreen() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const res = await api.getGroups();
      const sortedGroups = res.data.sort((a: Group, b: Group) => b._id.localeCompare(a._id));
      setGroups(sortedGroups);

      // Fetch balances for each group
      const balancePromises = res.data.map(async (group: Group) => {
        try {
          const balanceRes = await api.getGroupBalances(group._id);
          const userBalance = balanceRes.data.balances?.find((b: any) => b.isCurrentUser);
          return { groupId: group._id, balance: userBalance?.balance || 0 };
        } catch {
          return { groupId: group._id, balance: 0 };
        }
      });

      const balanceResults = await Promise.all(balancePromises);
      const balanceMap: Record<string, number> = {};
      balanceResults.forEach((b: GroupBalance) => {
        balanceMap[b.groupId] = b.balance;
      });
      setBalances(balanceMap);
    } catch (err) {
      console.error('Failed to fetch groups', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const totalOwed = Object.values(balances).filter(b => b > 0).reduce((sum, b) => sum + b, 0);
  const totalOwing = Object.values(balances).filter(b => b < 0).reduce((sum, b) => sum + Math.abs(b), 0);
  const netBalance = totalOwed - totalOwing;

  const renderGroupCard = ({ item }: { item: Group }) => {
    const groupBalance = balances[item._id] || 0;

    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => router.push(`/group/${item._id}`)}
        activeOpacity={0.7}
      >
        <Avatar name={item.name} size={50} fontSize={20} rounded={true} />
        <View style={styles.groupCardContent}>
          <View style={styles.groupCardHeader}>
            <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
            {groupBalance !== 0 && (
              <View style={[
                styles.balanceBadge,
                { backgroundColor: groupBalance > 0 ? Colors.dark.primaryFaded : Colors.dark.dangerFaded }
              ]}>
                <Text style={[
                  styles.balanceBadgeText,
                  { color: groupBalance > 0 ? Colors.dark.primary : Colors.dark.danger }
                ]}>
                  {groupBalance > 0 ? '+' : '-'}₹{Math.abs(groupBalance).toFixed(0)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.groupCardMeta}>
            <Ionicons name="people-outline" size={14} color={Colors.dark.textSecondary} />
            <Text style={styles.memberCount}>{item.members.length} members</Text>
          </View>
          {groupBalance !== 0 ? (
            <Text style={[
              styles.balanceText,
              { color: groupBalance > 0 ? Colors.dark.primary : Colors.dark.danger }
            ]}>
              {groupBalance > 0 ? 'You are owed' : 'You owe'} ₹{Math.abs(groupBalance).toFixed(2)}
            </Text>
          ) : (
            <Text style={styles.settledText}>All settled up ✓</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => {
    const totalPos = totalOwed;
    const totalNeg = totalOwing;

    return (
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.logoContainer}>
              <Ionicons name="leaf" size={24} color={Colors.dark.primary} />
            </View>
            <View>
              <Text style={styles.title}>Dashboard</Text>
              <Text style={styles.subtitle}>Net Balance: {netBalance >= 0 ? '+' : '-'}₹{Math.abs(netBalance).toFixed(0)}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/group/create')}
          >
            <Ionicons name="add" size={20} color={Colors.dark.background} />
            <Text style={styles.createButtonText}>New Group</Text>
          </TouchableOpacity>
        </View>

        {groups.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContent}
            style={styles.horizontalScrollView}
            decelerationRate="fast"
          >
            {/* Card 1: You're Owed */}
            <View style={[styles.summaryCard, { borderLeftColor: Colors.dark.primary, borderLeftWidth: 4 }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="arrow-up-circle" size={24} color={Colors.dark.primary} />
                <Text style={styles.cardTitle}>You're owed</Text>
              </View>
              <Text style={[styles.cardValue, { color: Colors.dark.primary }]}>₹{totalPos.toFixed(0)}</Text>
              <Text style={styles.cardSubtext}>Across all groups</Text>
            </View>

            {/* Card 2: You Owe */}
            <View style={[styles.summaryCard, { borderLeftColor: Colors.dark.danger, borderLeftWidth: 4 }]}>
              <View style={styles.cardHeader}>
                <Ionicons name="arrow-down-circle" size={24} color={Colors.dark.danger} />
                <Text style={styles.cardTitle}>You owe</Text>
              </View>
              <Text style={[styles.cardValue, { color: Colors.dark.danger }]}>₹{totalNeg.toFixed(0)}</Text>
              <Text style={styles.cardSubtext}>Pending settlements</Text>
            </View>
          </ScrollView>
        )}

        <Text style={styles.sectionTitle}>Recent Groups</Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="add" size={32} color={Colors.dark.primary} />
      </View>
      <Text style={styles.emptyTitle}>No groups yet</Text>
      <Text style={styles.emptySubtitle}>Create a group to start splitting expenses</Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/group/create')}
      >
        <Text style={styles.emptyButtonText}>Create a Group</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <LinearGradient
        colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color={Colors.dark.primary} />
        <Text style={styles.loadingText}>Loading your groups...</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[Colors.dark.backgroundGradientStart, Colors.dark.backgroundGradientEnd]}
      style={styles.container}
    >
      <FlatList
        data={groups}
        renderItem={renderGroupCard}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        numColumns={1}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
          />
        }
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
  loadingText: {
    marginTop: 12,
    color: Colors.dark.textSecondary,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginTop: 4,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  createButtonText: {
    color: Colors.dark.background,
    fontWeight: '600',
    fontSize: 14,
  },
  graphSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  horizontalScrollView: {
    marginHorizontal: -16,
    marginBottom: 24,
  },
  horizontalScrollContent: {
    paddingHorizontal: 8,
  },
  summaryCard: {
    width: SCREEN_WIDTH * 0.7,
    marginHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtext: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  groupCard: {
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  groupCardContent: {
    flex: 1,
  },
  groupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.dark.text,
    flex: 1,
    marginRight: 8,
  },
  balanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  balanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  groupCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  balanceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  settledText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.primaryFaded,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: Colors.dark.background,
    fontWeight: '600',
    fontSize: 16,
  },
});

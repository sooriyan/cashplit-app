import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { TodoItem, PriorityLevel, RecurrenceFrequency } from '../../types/todo';
import { todoStorage } from '../../services/todoStorage';
import { formatReminderDisplay, getHumanReadableRecurrence } from '../../services/recurrenceEngine';
import { todoNotificationService } from '../../services/todoNotificationService';

type FilterType = 'all' | 'pending' | 'recurring' | 'completed';

const CATEGORIES = ['General', 'Bills', 'Group Split', 'Personal', 'Work'];

export default function TodosScreen() {
  const insets = useSafeAreaInsets();

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState('Syncing...');
  const [syncing, setSyncing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('pending');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [category, setCategory] = useState('General');
  const [hasReminder, setHasReminder] = useState(true);
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>('none');
  const [reminderDate, setReminderDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(0, 0, 0);
    return d;
  });

  // Load To-Dos and trigger sync
  const loadTodos = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const items = await todoStorage.getAll();
      setTodos(items);

      // Trigger cloud sync
      setSyncing(true);
      const syncResult = await todoStorage.syncWithCloud();
      setSyncStatusText(syncResult.message);
      
      // Reload in case cloud sync pulled new items
      const updated = await todoStorage.getAll();
      setTodos(updated);
    } catch (error) {
      console.warn('Error loading todos:', error);
      setSyncStatusText('Offline');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    todoNotificationService.init();
    loadTodos();
  }, [loadTodos]);

  // Quick Preset Helper for Reminder Time
  const applyPreset = (type: '1h' | 'today_evening' | 'tomorrow_morning' | 'next_week') => {
    const now = new Date();
    const d = new Date();

    switch (type) {
      case '1h':
        d.setHours(now.getHours() + 1);
        break;
      case 'today_evening':
        d.setHours(19, 0, 0, 0);
        if (d.getTime() <= now.getTime()) {
          d.setDate(d.getDate() + 1);
        }
        break;
      case 'tomorrow_morning':
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        break;
      case 'next_week':
        d.setDate(d.getDate() + 7);
        d.setHours(9, 0, 0, 0);
        break;
    }
    setReminderDate(d);
    setHasReminder(true);
  };

  const openCreateModal = () => {
    setEditingTodo(null);
    setTitle('');
    setNotes('');
    setPriority('medium');
    setCategory('General');
    setHasReminder(true);
    setRecurrence('none');
    const defaultDate = new Date();
    defaultDate.setHours(defaultDate.getHours() + 2, 0, 0, 0);
    setReminderDate(defaultDate);
    setModalVisible(true);
  };

  const openEditModal = (item: TodoItem) => {
    setEditingTodo(item);
    setTitle(item.title);
    setNotes(item.notes || '');
    setPriority(item.priority);
    setCategory(item.category || 'General');
    setHasReminder(item.hasReminder);
    setRecurrence(item.recurrence);
    setReminderDate(item.reminderDateTime ? new Date(item.reminderDateTime) : new Date());
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a task title');
      return;
    }

    try {
      if (editingTodo) {
        await todoStorage.update(editingTodo.id, {
          title,
          notes,
          priority,
          category,
          hasReminder,
          reminderDateTime: hasReminder ? reminderDate.toISOString() : null,
          recurrence,
        });
      } else {
        await todoStorage.create({
          title,
          notes,
          priority,
          category,
          hasReminder,
          reminderDateTime: hasReminder ? reminderDate.toISOString() : null,
          recurrence,
        });
      }

      setModalVisible(false);
      loadTodos();
    } catch (error) {
      console.error('Failed to save todo:', error);
      Alert.alert('Error', 'Could not save task. Please try again.');
    }
  };

  const handleToggleComplete = async (item: TodoItem) => {
    try {
      const result = await todoStorage.toggleComplete(item.id);
      if (result) {
        if (result.wasRecurringAdvanced) {
          const next = formatReminderDisplay(result.todo.reminderDateTime);
          Alert.alert(
            '🔁 Recurring Task Advanced',
            `Marked current occurrence complete!\nNext reminder scheduled for ${next.label}.`
          );
        }
        // Optimistically update list
        setTodos((prev) =>
          prev.map((t) => (t.id === item.id ? result.todo : t))
        );
      }
    } catch (error) {
      console.error('Error toggling complete:', error);
    }
  };

  const handleDelete = (item: TodoItem) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await todoStorage.delete(item.id);
          setTodos((prev) => prev.filter((t) => t.id !== item.id));
        },
      },
    ]);
  };

  // Filtered Items
  const filteredTodos = useMemo(() => {
    switch (activeFilter) {
      case 'pending':
        return todos.filter((t) => !t.isCompleted);
      case 'completed':
        return todos.filter((t) => t.isCompleted);
      case 'recurring':
        return todos.filter((t) => t.recurrence !== 'none');
      case 'all':
      default:
        return todos;
    }
  }, [todos, activeFilter]);

  // Statistics
  const stats = useMemo(() => {
    const pending = todos.filter((t) => !t.isCompleted).length;
    const completed = todos.filter((t) => t.isCompleted).length;
    const recurring = todos.filter((t) => t.recurrence !== 'none' && !t.isCompleted).length;
    return { pending, completed, recurring, total: todos.length };
  }, [todos]);

  // Priority color helper
  const getPriorityColor = (p: PriorityLevel) => {
    switch (p) {
      case 'high':
        return Colors.dark.danger;
      case 'medium':
        return Colors.dark.warning;
      case 'low':
      default:
        return Colors.dark.primary;
    }
  };

  const renderTodoCard = ({ item }: { item: TodoItem }) => {
    const reminderInfo = formatReminderDisplay(item.reminderDateTime);
    const priorityColor = getPriorityColor(item.priority);

    return (
      <View style={[styles.card, item.isCompleted && styles.cardCompleted]}>
        <View style={styles.cardHeader}>
          {/* Checkbox */}
          <TouchableOpacity
            style={[
              styles.checkbox,
              item.isCompleted && styles.checkboxChecked,
            ]}
            onPress={() => handleToggleComplete(item)}
            activeOpacity={0.7}
          >
            {item.isCompleted && <Ionicons name="checkmark" size={16} color="#0D0D0D" />}
          </TouchableOpacity>

          {/* Title & Notes */}
          <View style={styles.cardBody}>
            <Text
              style={[
                styles.cardTitle,
                item.isCompleted && styles.cardTitleCompleted,
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>

            {item.notes ? (
              <Text style={styles.cardNotes} numberOfLines={2}>
                {item.notes}
              </Text>
            ) : null}

            {/* Badges Row */}
            <View style={styles.badgesRow}>
              {/* Priority Badge */}
              <View style={[styles.priorityBadge, { borderColor: priorityColor }]}>
                <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                <Text style={[styles.priorityText, { color: priorityColor }]}>
                  {item.priority.toUpperCase()}
                </Text>
              </View>

              {/* Recurrence Badge */}
              {item.recurrence !== 'none' && (
                <View style={styles.recurrenceBadge}>
                  <Ionicons name="repeat" size={12} color="#60A5FA" />
                  <Text style={styles.recurrenceText}>
                    {getHumanReadableRecurrence(item.recurrence).replace('Repeats ', '')}
                  </Text>
                </View>
              )}

              {/* Category */}
              {item.category ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
              ) : null}
            </View>

            {/* Reminder Date / Time Pill */}
            {item.hasReminder && item.reminderDateTime && !item.isCompleted && (
              <View
                style={[
                  styles.reminderPill,
                  reminderInfo.isOverdue && styles.reminderPillOverdue,
                ]}
              >
                <Ionicons
                  name={reminderInfo.isOverdue ? 'alert-circle' : 'alarm-outline'}
                  size={13}
                  color={reminderInfo.isOverdue ? Colors.dark.danger : Colors.dark.primary}
                />
                <Text
                  style={[
                    styles.reminderText,
                    reminderInfo.isOverdue && styles.reminderTextOverdue,
                  ]}
                >
                  {reminderInfo.isOverdue ? 'Overdue: ' : 'Remind: '}
                  {reminderInfo.label}
                </Text>
              </View>
            )}
          </View>

          {/* Actions Menu */}
          <View style={styles.cardActions}>
            <TouchableOpacity
              onPress={() => openEditModal(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.actionBtn}
            >
              <Ionicons name="pencil-outline" size={17} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.actionBtn}
            >
              <Ionicons name="trash-outline" size={17} color={Colors.dark.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Navigation & Cloud Status */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>To-Dos & Reminders</Text>
          <Text style={styles.headerSubtitle}>Stay on top of splits, bills & tasks</Text>
        </View>

        {/* Cloud Sync Status Indicator */}
        <TouchableOpacity
          style={styles.syncPill}
          onPress={() => loadTodos(true)}
          activeOpacity={0.7}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={Colors.dark.primary} style={{ marginRight: 6 }} />
          ) : (
            <Ionicons
              name={syncStatusText.includes('✓') ? 'cloud-done-outline' : 'cloud-outline'}
              size={15}
              color={syncStatusText.includes('✓') ? Colors.dark.primary : Colors.dark.textSecondary}
              style={{ marginRight: 6 }}
            />
          )}
          <Text style={styles.syncText}>{syncStatusText}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Summary Bar */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#60A5FA' }]}>{stats.recurring}</Text>
          <Text style={styles.statLabel}>Recurring</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: Colors.dark.primary }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Segmented Filter Control */}
      <View style={styles.filterBar}>
        {(['pending', 'recurring', 'completed', 'all'] as FilterType[]).map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Task List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTodos}
          keyExtractor={(item) => item.id}
          renderItem={renderTodoCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTodos(true)}
              tintColor={Colors.dark.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkbox-outline" size={54} color={Colors.dark.textMuted} />
              <Text style={styles.emptyTitle}>
                {activeFilter === 'completed'
                  ? 'No completed tasks yet'
                  : activeFilter === 'recurring'
                  ? 'No recurring tasks scheduled'
                  : 'All caught up!'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter === 'pending'
                  ? 'Tap the button below to add your first reminder or task.'
                  : 'Tasks with recurrence will automatically cycle here.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={openCreateModal}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#13ec6d', '#0da84e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#0D0D0D" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Create / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTodo ? 'Edit Task' : 'New Task & Reminder'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {/* Title Input */}
              <Text style={styles.inputLabel}>Task Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Settle electricity bill / Pay Alex"
                placeholderTextColor={Colors.dark.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              {/* Notes Input */}
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                placeholder="Add details, split amounts, or reference..."
                placeholderTextColor={Colors.dark.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />

              {/* Priority Selector */}
              <Text style={styles.inputLabel}>Priority Level</Text>
              <View style={styles.selectorRow}>
                {(['low', 'medium', 'high'] as PriorityLevel[]).map((p) => {
                  const isSelected = priority === p;
                  const pColor = getPriorityColor(p);
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityChoice,
                        isSelected && { backgroundColor: pColor + '20', borderColor: pColor },
                      ]}
                      onPress={() => setPriority(p)}
                    >
                      <View style={[styles.priorityDot, { backgroundColor: pColor }]} />
                      <Text
                        style={[
                          styles.selectorChoiceText,
                          isSelected && { color: pColor, fontWeight: '700' },
                        ]}
                      >
                        {p.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Category Selector */}
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChoice, isSelected && styles.categoryChoiceSelected]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.categoryChoiceText,
                          isSelected && styles.categoryChoiceTextSelected,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Reminder Switch */}
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchLabel}>Enable Reminder</Text>
                  <Text style={styles.switchSublabel}>Receive device alarm & notification</Text>
                </View>
                <Switch
                  value={hasReminder}
                  onValueChange={setHasReminder}
                  trackColor={{ false: '#333333', true: Colors.dark.primaryFaded }}
                  thumbColor={hasReminder ? Colors.dark.primary : '#888888'}
                />
              </View>

              {/* Reminder Details */}
              {hasReminder && (
                <View style={styles.reminderSection}>
                  <Text style={styles.inputLabel}>Quick Presets</Text>
                  <View style={styles.presetRow}>
                    <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset('1h')}>
                      <Text style={styles.presetText}>+1 Hour</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset('today_evening')}>
                      <Text style={styles.presetText}>Today 7 PM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset('tomorrow_morning')}>
                      <Text style={styles.presetText}>Tomorrow 9 AM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset('next_week')}>
                      <Text style={styles.presetText}>Next Week</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.dateDisplayPill}>
                    <Ionicons name="calendar-outline" size={16} color={Colors.dark.primary} />
                    <Text style={styles.dateDisplayText}>
                      {formatReminderDisplay(reminderDate.toISOString()).label}
                    </Text>
                  </View>

                  {/* Recurrence Selector */}
                  <Text style={[styles.inputLabel, { marginTop: 16 }]}>Recurrence</Text>
                  <View style={styles.recurrenceContainer}>
                    {(['none', 'daily', 'weekly', 'monthly', 'yearly'] as RecurrenceFrequency[]).map(
                      (freq) => {
                        const isSelected = recurrence === freq;
                        return (
                          <TouchableOpacity
                            key={freq}
                            style={[
                              styles.recurrenceChoice,
                              isSelected && styles.recurrenceChoiceSelected,
                            ]}
                            onPress={() => setRecurrence(freq)}
                          >
                            <Text
                              style={[
                                styles.recurrenceChoiceText,
                                isSelected && styles.recurrenceChoiceTextSelected,
                              ]}
                            >
                              {freq === 'none' ? 'Once' : freq.charAt(0).toUpperCase() + freq.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        );
                      }
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#13ec6d', '#0da84e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.saveBtnGradient}
                >
                  <Text style={styles.saveBtnText}>
                    {editingTodo ? 'Update Task' : 'Create Task'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.cardHover,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  syncText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginVertical: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.dark.textMuted,
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  filterBar: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.card,
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: Colors.dark.cardHover,
  },
  filterTabText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: Colors.dark.primary,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardCompleted: {
    opacity: 0.6,
    borderColor: Colors.dark.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: Colors.dark.primary,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
    lineHeight: 20,
  },
  cardTitleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.dark.textMuted,
  },
  cardNotes: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  recurrenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  recurrenceText: {
    fontSize: 10,
    color: '#60A5FA',
    fontWeight: '600',
  },
  categoryBadge: {
    backgroundColor: Colors.dark.cardHover,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  reminderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primaryFaded,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    gap: 5,
  },
  reminderPillOverdue: {
    backgroundColor: Colors.dark.dangerFaded,
  },
  reminderText: {
    fontSize: 11,
    color: Colors.dark.primary,
    fontWeight: '600',
  },
  reminderTextOverdue: {
    color: Colors.dark.danger,
  },
  cardActions: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 10,
  },
  actionBtn: {
    padding: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    borderRadius: 28,
    elevation: 8,
    shadowColor: Colors.dark.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    marginTop: 12,
    fontSize: 13,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.dark.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.dark.text,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChoice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
    gap: 5,
  },
  selectorChoiceText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: '600',
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryChoice: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginRight: 8,
  },
  categoryChoiceSelected: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryFaded,
  },
  categoryChoiceText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  categoryChoiceTextSelected: {
    color: Colors.dark.primary,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  switchSublabel: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    marginTop: 2,
  },
  reminderSection: {
    marginTop: 10,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    backgroundColor: Colors.dark.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  presetText: {
    fontSize: 12,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  dateDisplayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primaryFaded,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  dateDisplayText: {
    fontSize: 13,
    color: Colors.dark.primary,
    fontWeight: '700',
  },
  recurrenceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recurrenceChoice: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  recurrenceChoiceSelected: {
    borderColor: '#60A5FA',
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
  },
  recurrenceChoiceText: {
    fontSize: 12,
    color: Colors.dark.textMuted,
    fontWeight: '500',
  },
  recurrenceChoiceTextSelected: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#0D0D0D',
    fontSize: 15,
    fontWeight: '800',
  },
});

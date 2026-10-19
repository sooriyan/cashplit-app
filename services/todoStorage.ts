import * as SecureStore from 'expo-secure-store';
import { CreateTodoInput, TodoItem, UpdateTodoInput } from '../types/todo';
import { todoNotificationService } from './todoNotificationService';
import { calculateNextOccurrence, calculateNextIntraDaySlot } from './recurrenceEngine';
import api from './api';

const TODOS_STORAGE_KEY = 'cashplit_todos_storage_v2';
const LAST_SYNC_KEY = 'cashplit_todos_last_synced_at';

class TodoStorageService {
  /**
   * Retrieves all local To-Do items
   */
  async getAll(): Promise<TodoItem[]> {
    try {
      const raw = await SecureStore.getItemAsync(TODOS_STORAGE_KEY);
      if (!raw) return [];
      const items: TodoItem[] = JSON.parse(raw);
      const todayStr = new Date().toISOString().slice(0, 10);

      // Filter out permanently deleted items & perform date-rollover reset for multiple_daily
      return items
        .filter((item) => !item.deletedAt)
        .map((item) => {
          if (item.recurrence === 'multiple_daily' && item.lastSlotCompletedDate !== todayStr) {
            return {
              ...item,
              completedSlotsToday: 0,
            };
          }
          return item;
        });
    } catch (error) {
      console.warn('[TodoStorageService] Failed to read local todos:', error);
      return [];
    }
  }

  /**
   * Helper to write raw list including tombstones
   */
  private async writeRaw(items: TodoItem[]): Promise<void> {
    try {
      await SecureStore.setItemAsync(TODOS_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('[TodoStorageService] Failed to persist todos:', error);
    }
  }

  /**
   * Reads raw list including tombstones for sync reconciliation
   */
  private async getRaw(): Promise<TodoItem[]> {
    try {
      const raw = await SecureStore.getItemAsync(TODOS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Create a new Todo item with optional reminder and recurrence
   */
  async create(input: CreateTodoInput): Promise<TodoItem> {
    const rawItems = await this.getRaw();
    const id = 'todo_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const nowIso = new Date().toISOString();

    const isMultiDaily = input.recurrence === 'multiple_daily' && input.dailyTimes && input.dailyTimes.length > 0;
    let initialReminderTime = input.reminderDateTime || null;
    let initialSlotIndex = 0;

    if (isMultiDaily) {
      const slotResult = calculateNextIntraDaySlot(input.dailyTimes!, new Date());
      initialReminderTime = slotResult.nextIso;
      initialSlotIndex = slotResult.slotIndex;
    }

    const newTodo: TodoItem = {
      id,
      title: input.title.trim(),
      notes: input.notes?.trim(),
      priority: input.priority || 'medium',
      category: input.category || 'General',
      isCompleted: false,
      completedAt: null,
      hasReminder: Boolean(input.hasReminder && initialReminderTime),
      reminderDateTime: initialReminderTime,
      notificationId: null,
      recurrence: input.recurrence || 'none',
      recurrenceCount: 0,
      dailyTimes: input.dailyTimes || [],
      currentSlotIndex: initialSlotIndex,
      completedSlotsToday: 0,
      lastSlotCompletedDate: nowIso.slice(0, 10),
      syncStatus: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Schedule notification if reminder set
    if (newTodo.hasReminder && newTodo.reminderDateTime) {
      const notifId = await todoNotificationService.scheduleReminder(newTodo);
      newTodo.notificationId = notifId;
    }

    rawItems.unshift(newTodo);
    await this.writeRaw(rawItems);

    // Trigger cloud sync asynchronously
    this.syncWithCloud().catch(() => {});

    return newTodo;
  }

  /**
   * Update an existing Todo item
   */
  async update(id: string, input: UpdateTodoInput): Promise<TodoItem | null> {
    const rawItems = await this.getRaw();
    const index = rawItems.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const current = rawItems[index];
    const nowIso = new Date().toISOString();

    const updatedTodo: TodoItem = {
      ...current,
      ...input,
      title: input.title !== undefined ? input.title.trim() : current.title,
      notes: input.notes !== undefined ? input.notes?.trim() : current.notes,
      updatedAt: nowIso,
      syncStatus: 'pending',
    };

    // If recurrence or dailyTimes changed to multiple_daily, recalculate next slot
    if (input.recurrence === 'multiple_daily' && input.dailyTimes && input.dailyTimes.length > 0) {
      const slotResult = calculateNextIntraDaySlot(input.dailyTimes, new Date());
      updatedTodo.reminderDateTime = slotResult.nextIso;
      updatedTodo.currentSlotIndex = slotResult.slotIndex;
      updatedTodo.dailyTimes = input.dailyTimes;
    }

    // Check if reminder parameters changed
    const reminderChanged =
      input.hasReminder !== undefined ||
      input.reminderDateTime !== undefined ||
      input.recurrence !== undefined ||
      input.dailyTimes !== undefined;

    if (reminderChanged) {
      if (updatedTodo.hasReminder && updatedTodo.reminderDateTime && !updatedTodo.isCompleted) {
        const notifId = await todoNotificationService.scheduleReminder(updatedTodo);
        updatedTodo.notificationId = notifId;
      } else if (updatedTodo.notificationId) {
        await todoNotificationService.cancelReminder(updatedTodo.notificationId);
        updatedTodo.notificationId = null;
      }
    }

    rawItems[index] = updatedTodo;
    await this.writeRaw(rawItems);

    this.syncWithCloud().catch(() => {});
    return updatedTodo;
  }

  /**
   * Toggle completion state.
   * If task is recurring, advances the reminder to the next recurrence interval!
   */
  async toggleComplete(id: string): Promise<{ todo: TodoItem; wasRecurringAdvanced: boolean } | null> {
    const rawItems = await this.getRaw();
    const index = rawItems.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const current = rawItems[index];
    const nowIso = new Date().toISOString();

    let wasRecurringAdvanced = false;

    if (!current.isCompleted) {
      // User is completing the task
      if (current.recurrence === 'multiple_daily' && current.dailyTimes && current.dailyTimes.length > 0) {
        const todayStr = nowIso.slice(0, 10);
        if (current.lastSlotCompletedDate !== todayStr) {
          current.completedSlotsToday = 0;
        }
        current.completedSlotsToday = (current.completedSlotsToday || 0) + 1;
        current.lastSlotCompletedDate = todayStr;
        current.recurrenceCount += 1;
        current.updatedAt = nowIso;
        current.syncStatus = 'pending';

        // Advance to next intra-day slot
        const nextSlot = calculateNextIntraDaySlot(current.dailyTimes, new Date());
        current.reminderDateTime = nextSlot.nextIso;
        current.currentSlotIndex = nextSlot.slotIndex;

        // Reschedule notification for next slot
        const notifId = await todoNotificationService.scheduleReminder(current);
        current.notificationId = notifId;
        wasRecurringAdvanced = true;
      } else if (current.recurrence !== 'none' && current.reminderDateTime) {
        // Standard recurring task: advance reminder date to the next cycle
        const nextIso = calculateNextOccurrence(
          current.reminderDateTime,
          current.recurrence,
          new Date(),
          current.dailyTimes
        );
        current.reminderDateTime = nextIso;
        current.recurrenceCount += 1;
        current.updatedAt = nowIso;
        current.syncStatus = 'pending';

        // Reschedule reminder notification for next cycle
        const notifId = await todoNotificationService.scheduleReminder(current);
        current.notificationId = notifId;
        wasRecurringAdvanced = true;
      } else {
        // One-time task: mark complete and cancel notification
        current.isCompleted = true;
        current.completedAt = nowIso;
        current.updatedAt = nowIso;
        current.syncStatus = 'pending';

        if (current.notificationId) {
          await todoNotificationService.cancelReminder(current.notificationId);
          current.notificationId = null;
        }
      }
    } else {
      // User is unchecking a completed task
      current.isCompleted = false;
      current.completedAt = null;
      current.updatedAt = nowIso;
      current.syncStatus = 'pending';

      if (current.hasReminder && current.reminderDateTime) {
        const notifId = await todoNotificationService.scheduleReminder(current);
        current.notificationId = notifId;
      }
    }

    rawItems[index] = current;
    await this.writeRaw(rawItems);

    this.syncWithCloud().catch(() => {});
    return { todo: current, wasRecurringAdvanced };
  }

  /**
   * Snooze a task reminder by N minutes (e.g. 15, 30, 60 minutes)
   */
  async snoozeTodo(id: string, minutes: number): Promise<TodoItem | null> {
    const rawItems = await this.getRaw();
    const index = rawItems.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const current = rawItems[index];
    const now = new Date();
    const newReminderTime = new Date(now.getTime() + minutes * 60 * 1000).toISOString();

    current.hasReminder = true;
    current.reminderDateTime = newReminderTime;
    current.isCompleted = false;
    current.completedAt = null;
    current.updatedAt = now.toISOString();
    current.syncStatus = 'pending';

    // Reschedule device alarm for the new snoozed time
    const notifId = await todoNotificationService.scheduleReminder(current);
    current.notificationId = notifId;

    rawItems[index] = current;
    await this.writeRaw(rawItems);

    this.syncWithCloud().catch(() => {});
    return current;
  }

  /**
   * Soft-delete for cloud sync tombstoning and cancel notification
   */
  async delete(id: string): Promise<void> {
    const rawItems = await this.getRaw();
    const index = rawItems.findIndex((t) => t.id === id);
    if (index === -1) return;

    const target = rawItems[index];
    if (target.notificationId) {
      await todoNotificationService.cancelReminder(target.notificationId);
    }

    // Mark tombstone for cloud sync
    target.deletedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    target.syncStatus = 'pending';

    rawItems[index] = target;
    await this.writeRaw(rawItems);

    this.syncWithCloud().catch(() => {});
  }

  /**
   * Cloud Synchronization Engine
   * Merges local state with cloud API using Last-Write-Wins and tombstone reconciliation.
   * Gracefully falls back if offline or if backend endpoint is not yet present.
   */
  async syncWithCloud(): Promise<{ success: boolean; message: string; syncedCount: number }> {
    const userId = api.getUserId();
    if (!userId) {
      return { success: false, message: 'Saved locally (Not signed in)', syncedCount: 0 };
    }

    const rawItems = await this.getRaw();
    const lastSyncedAt = await SecureStore.getItemAsync(LAST_SYNC_KEY);

    try {
      // Attempt two-way delta sync with backend
      const res = await api.syncTodos({
        todos: rawItems,
        lastSyncedAt: lastSyncedAt || null,
      });

      if (res.status >= 200 && res.status < 300 && res.data) {
        const serverTodos: TodoItem[] = res.data.todos || res.data;
        const serverSyncedAt = res.data.syncedAt || new Date().toISOString();

        // Merge server and local records:
        const mergedMap = new Map<string, TodoItem>();

        // Index local items
        for (const item of rawItems) {
          mergedMap.set(item.id, { ...item, syncStatus: 'synced' });
        }

        // Apply server updates with timestamp comparison
        for (const serverItem of serverTodos) {
          const local = mergedMap.get(serverItem.id);
          if (!local) {
            mergedMap.set(serverItem.id, { ...serverItem, syncStatus: 'synced' });
          } else {
            const localTime = new Date(local.updatedAt).getTime();
            const serverTime = new Date(serverItem.updatedAt).getTime();
            if (serverTime >= localTime) {
              mergedMap.set(serverItem.id, {
                ...serverItem,
                notificationId: local.notificationId, // preserve device-local notification id
                syncStatus: 'synced',
              });
            }
          }
        }

        const mergedList = Array.from(mergedMap.values());

        // Update notifications for active items that need reminders
        for (const item of mergedList) {
          if (!item.deletedAt && !item.isCompleted && item.hasReminder && item.reminderDateTime) {
            if (!item.notificationId) {
              const notifId = await todoNotificationService.scheduleReminder(item);
              item.notificationId = notifId;
            }
          }
        }

        // Clean up purged tombstones older than 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const cleaned = mergedList.filter(
          (t) => !t.deletedAt || new Date(t.deletedAt).getTime() > sevenDaysAgo
        );

        await this.writeRaw(cleaned);
        await SecureStore.setItemAsync(LAST_SYNC_KEY, serverSyncedAt);

        const activeCount = cleaned.filter((t) => !t.deletedAt).length;
        return { success: true, message: 'Cloud Synced ✓', syncedCount: activeCount };
      }
    } catch (error: any) {
      // If endpoint doesn't exist yet (404) or offline, mark items as pending and continue smoothly
      const status = error.response?.status;
      if (status === 404) {
        console.log('[TodoStorageService] Cloud endpoint /api/todos/sync not active; operating in offline-first mode.');
        return { success: true, message: 'Saved locally', syncedCount: rawItems.filter((t) => !t.deletedAt).length };
      }
      console.warn('[TodoStorageService] Cloud sync error:', error.message || error);
    }

    const activeCount = rawItems.filter((t) => !t.deletedAt).length;
    return { success: false, message: 'Offline (Saved locally)', syncedCount: activeCount };
  }
}

export const todoStorage = new TodoStorageService();

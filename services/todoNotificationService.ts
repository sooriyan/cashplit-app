import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TodoItem } from '../types/todo';
import { calculateUpcomingOccurrences } from './recurrenceEngine';

export const TODO_NOTIFICATION_CATEGORY = 'TODO_REMINDER_ACTIONS';

export const TODO_ACTIONS = {
  MARK_DONE: 'ACTION_MARK_DONE',
  SNOOZE_15: 'ACTION_SNOOZE_15',
  SNOOZE_30: 'ACTION_SNOOZE_30',
  SNOOZE_60: 'ACTION_SNOOZE_60',
} as const;

const REMINDER_CHANNEL_ID = 'cashplit-todo-reminders';

class TodoNotificationService {
  private isInitialized = false;

  /**
   * Initializes notification channels, action categories, and foreground presentation rules
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'To-Do Reminders',
        description: 'Time-critical alarms and notifications for scheduled tasks and recurring bills',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        lightColor: '#13ec6d',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });
    }

    // Register interactive notification action buttons
    // opensAppToForeground: true ensures actions awaken the app to execute state update when phone is locked/killed
    try {
      await Notifications.setNotificationCategoryAsync(TODO_NOTIFICATION_CATEGORY, [
        {
          identifier: TODO_ACTIONS.MARK_DONE,
          buttonTitle: '✓ Mark Done',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: TODO_ACTIONS.SNOOZE_15,
          buttonTitle: '⏰ Snooze 15m',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: TODO_ACTIONS.SNOOZE_30,
          buttonTitle: '⏰ Snooze 30m',
          options: {
            opensAppToForeground: true,
          },
        },
        {
          identifier: TODO_ACTIONS.SNOOZE_60,
          buttonTitle: '⏰ Snooze 1h',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
    } catch (catError) {
      console.warn('[TodoNotificationService] Failed to set notification category:', catError);
    }

    this.isInitialized = true;
  }

  /**
   * Request push/local notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.warn('[TodoNotificationService] Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Schedules a rolling lookahead buffer of notifications for a TodoItem (next 7 days / up to 14 occurrences).
   * Guarantees notifications continue to fire even if the app remains closed for days.
   */
  async scheduleReminder(todo: TodoItem): Promise<{ primaryId: string | null; allIds: string[] }> {
    if (!todo.hasReminder || !todo.reminderDateTime) {
      return { primaryId: null, allIds: [] };
    }

    // Cancel existing notifications (both single and buffer array)
    const existingIds = [
      ...(todo.notificationIds || []),
      ...(todo.notificationId ? [todo.notificationId] : []),
    ];
    if (existingIds.length > 0) {
      await this.cancelReminder(existingIds);
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('[TodoNotificationService] Cannot schedule: permissions not granted');
      return { primaryId: null, allIds: [] };
    }

    try {
      await this.init();

      // Calculate upcoming occurrences for the 7-day rolling lookahead buffer
      const upcoming = calculateUpcomingOccurrences(
        todo.reminderDateTime,
        todo.recurrence,
        new Date(),
        todo.dailyTimes,
        14, // max 14 upcoming slots in OS queue (well within iOS 64 limit)
        7   // 7 days ahead rolling lookahead window
      );

      if (upcoming.length === 0) {
        console.log(`[TodoNotificationService] No future occurrences for task: "${todo.title}"`);
        return { primaryId: null, allIds: [] };
      }

      const body = todo.notes ? todo.notes.slice(0, 120) : 'Tap to open your task';
      const scheduledIds: string[] = [];

      for (const occ of upcoming) {
        try {
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `📌 Task: ${todo.title}`,
              subtitle: occ.subtitle,
              body,
              data: {
                todoId: todo.id,
                recurrence: todo.recurrence,
                type: 'todo_reminder',
                slotIndex: occ.slotIndex,
                scheduledFor: occ.triggerDate.toISOString(),
              },
              categoryIdentifier: TODO_NOTIFICATION_CATEGORY,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: occ.triggerDate,
              channelId: REMINDER_CHANNEL_ID,
            },
          });
          scheduledIds.push(notificationId);
        } catch (slotError) {
          console.warn('[TodoNotificationService] Failed to schedule buffer slot:', slotError);
        }
      }

      return {
        primaryId: scheduledIds[0] || null,
        allIds: scheduledIds,
      };
    } catch (error) {
      console.error('[TodoNotificationService] Failed to schedule reminder buffer:', error);
      return { primaryId: null, allIds: [] };
    }
  }

  /**
   * Cancel an existing notification by its ID or array of IDs
   */
  async cancelReminder(target?: string | string[] | null): Promise<void> {
    if (!target) return;
    const ids = Array.isArray(target) ? target : [target];
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

    await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (error) {
          console.warn(`[TodoNotificationService] Could not cancel notification ${id}:`, error);
        }
      })
    );
  }

  /**
   * Cancel all notifications for all tasks
   */
  async cancelAll(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('[TodoNotificationService] Error canceling all notifications:', error);
    }
  }
}

export const todoNotificationService = new TodoNotificationService();

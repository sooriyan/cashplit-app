import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TodoItem } from '../types/todo';
import { calculateNextOccurrence } from './recurrenceEngine';

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
      });
    }

    // Register interactive notification action buttons (Mark Done, Snooze 15m, Snooze 30m, Snooze 1h)
    try {
      await Notifications.setNotificationCategoryAsync(TODO_NOTIFICATION_CATEGORY, [
        {
          identifier: TODO_ACTIONS.MARK_DONE,
          buttonTitle: '✓ Mark Done',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: TODO_ACTIONS.SNOOZE_15,
          buttonTitle: '⏰ Snooze 15m',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: TODO_ACTIONS.SNOOZE_30,
          buttonTitle: '⏰ Snooze 30m',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: TODO_ACTIONS.SNOOZE_60,
          buttonTitle: '⏰ Snooze 1h',
          options: {
            opensAppToForeground: false,
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
   * Schedule or update a reminder for a TodoItem
   */
  async scheduleReminder(todo: TodoItem): Promise<string | null> {
    if (!todo.hasReminder || !todo.reminderDateTime) {
      return null;
    }

    let triggerDate = new Date(todo.reminderDateTime);
    const now = new Date();

    // If date is in the past and item has recurrence, advance it to next occurrence
    if (triggerDate.getTime() <= now.getTime()) {
      if (todo.recurrence !== 'none') {
        const nextIso = calculateNextOccurrence(
          todo.reminderDateTime,
          todo.recurrence,
          now,
          todo.dailyTimes
        );
        triggerDate = new Date(nextIso);
      } else {
        console.log(`[TodoNotificationService] Reminder is in the past for task: "${todo.title}"`);
        return null;
      }
    }

    // Cancel existing notification if one was previously scheduled
    if (todo.notificationId) {
      await this.cancelReminder(todo.notificationId);
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('[TodoNotificationService] Cannot schedule: permissions not granted');
      return null;
    }

    try {
      await this.init();

      let subtitle: string | undefined = undefined;
      if (todo.recurrence === 'multiple_daily' && todo.dailyTimes && todo.dailyTimes.length > 0) {
        const slotNum = (todo.currentSlotIndex ?? 0) + 1;
        subtitle = `🔁 ${todo.dailyTimes.length}× Daily (Slot ${slotNum}/${todo.dailyTimes.length})`;
      } else if (todo.recurrence !== 'none') {
        subtitle = `🔁 Repeat: ${todo.recurrence}`;
      }

      const body = todo.notes ? todo.notes.slice(0, 120) : 'Tap to open your task';

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `📌 Task: ${todo.title}`,
          subtitle,
          body,
          data: {
            todoId: todo.id,
            recurrence: todo.recurrence,
            type: 'todo_reminder',
          },
          categoryIdentifier: TODO_NOTIFICATION_CATEGORY,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: REMINDER_CHANNEL_ID,
        },
      });

      return notificationId;
    } catch (error) {
      console.error('[TodoNotificationService] Failed to schedule reminder:', error);
      return null;
    }
  }

  /**
   * Cancel an existing notification by its ID
   */
  async cancelReminder(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.warn(`[TodoNotificationService] Could not cancel notification ${notificationId}:`, error);
    }
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

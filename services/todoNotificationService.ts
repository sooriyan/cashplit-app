import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TodoItem } from '../types/todo';
import { calculateNextOccurrence } from './recurrenceEngine';

const REMINDER_CHANNEL_ID = 'cashplit-todo-reminders';

class TodoNotificationService {
  private isInitialized = false;

  /**
   * Initializes notification channels and foreground presentation rules
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
        const nextIso = calculateNextOccurrence(todo.reminderDateTime, todo.recurrence, now);
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

      const subtitle = todo.recurrence !== 'none' ? `🔁 Repeat: ${todo.recurrence}` : undefined;
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

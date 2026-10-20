export type PriorityLevel = 'low' | 'medium' | 'high';

export type RecurrenceFrequency =
  | 'none'
  | 'daily'
  | 'multiple_daily'
  | 'weekly'
  | 'monthly'
  | 'yearly';

export type SyncStatus = 'synced' | 'pending' | 'failed';

export interface TodoItem {
  id: string;
  title: string;
  notes?: string;
  priority: PriorityLevel;
  isCompleted: boolean;
  completedAt?: string | null;

  // Reminder & Scheduling
  hasReminder: boolean;
  reminderDateTime?: string | null; // ISO 8601 string for the currently scheduled occurrence
  notificationId?: string | null;   // Device local notification trigger ID (primary next slot)
  notificationIds?: string[];      // Array of scheduled notification IDs for rolling buffer window

  // Recurrence
  recurrence: RecurrenceFrequency;
  recurrenceCount: number;         // Counter for total occurrences completed
  
  // Intra-Day Multiple Recurrence
  dailyTimes?: string[];           // Array of "HH:mm" 24-hour strings, e.g. ["09:00", "14:00", "20:00"]
  currentSlotIndex?: number;       // Index of currently active slot in dailyTimes
  completedSlotsToday?: number;    // Counter for slots finished today (e.g. 2 of 3)
  lastSlotCompletedDate?: string | null; // "YYYY-MM-DD" used to reset daily slot progress

  // Category & Metadata
  category?: string;              // e.g. 'General', 'Bills', 'Group'
  syncStatus: SyncStatus;
  createdAt: string;              // ISO 8601 string
  updatedAt: string;              // ISO 8601 string
  deletedAt?: string | null;      // Soft delete for tombstoning during cloud sync
}

export interface CreateTodoInput {
  title: string;
  notes?: string;
  priority?: PriorityLevel;
  category?: string;
  hasReminder?: boolean;
  reminderDateTime?: string | null;
  recurrence?: RecurrenceFrequency;
  dailyTimes?: string[];
}

export interface UpdateTodoInput {
  title?: string;
  notes?: string;
  priority?: PriorityLevel;
  category?: string;
  isCompleted?: boolean;
  hasReminder?: boolean;
  reminderDateTime?: string | null;
  recurrence?: RecurrenceFrequency;
  dailyTimes?: string[];
  currentSlotIndex?: number;
  completedSlotsToday?: number;
}

export interface TodoItem {
  id: string;
  /** A day list id ("YYYY-MM-DD") or a custom list id (uuid). */
  listId: string;
  index: number;
  /** Ordered tag names WITHOUT '#', case preserved as entered (e.g. ["for me","recur"]). */
  tags: string[];
  /** The body sentence; may contain inline time like "13:30". */
  text: string;
  done: boolean;
  /**
   * ISO timestamp of when the item was last marked done (cleared when undone).
   * Drives time-based archiving of old completed items.
   */
  completedAt?: string;
  /** Items added to a past day are "fixed" and don't roll over to today. */
  fixed: boolean;
  /** Optional deadline (date-only, "YYYY-MM-DD"). Independent of which day list the item sits in. */
  due?: string;
  /**
   * Follow-up queue membership. Followers point at the original/root task;
   * roots and ordinary standalone tasks leave this unset.
   */
  queueRootId?: string;
  /** Stable execution order within a follow-up queue (followers start at 1). */
  queueIndex?: number;
}

/** A list row resolved for rendering. The anchor stays stable as the queue head advances. */
export interface ResolvedTodoItem extends TodoItem {
  anchorId: string;
}

export interface TodoQueue {
  rootId: string;
  items: TodoItem[];
  current: TodoItem;
  completed: number;
  total: number;
}

export interface CustomList {
  id: string;
  index: number;
  title: string;
}

export interface TodoData {
  items: TodoItem[];
  customLists: CustomList[];
  /** The currently focused day, as a "YYYY-MM-DD" id. */
  at: string;
  /** Index of the leftmost visible custom list. */
  customAt: number;
}

/** A day list resolved for rendering. */
export interface DayList {
  id: string;
  date: Date;
  items: ResolvedTodoItem[];
  isToday: boolean;
  isPast: boolean;
}

/** A custom list resolved (with its items) for rendering. */
export interface ResolvedCustomList extends CustomList {
  items: ResolvedTodoItem[];
}

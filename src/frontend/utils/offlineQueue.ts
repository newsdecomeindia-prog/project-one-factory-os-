export interface QueuedAction {
  id: string;
  url: string;
  method: string;
  body: any;
  timestamp: number;
}

class OfflineQueueManager {
  private queue: QueuedAction[] = [];

  constructor() {
    const saved = localStorage.getItem('p1_offline_queue');
    if (saved) {
      try {
        this.queue = JSON.parse(saved);
      } catch (e) {
        this.queue = [];
      }
    }
  }

  enqueue(url: string, method: string, body: any) {
    const item: QueuedAction = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      url,
      method,
      body,
      timestamp: Date.now(),
    };
    this.queue.push(item);
    this.persist();
  }

  getQueue(): QueuedAction[] {
    return this.queue;
  }

  clear() {
    this.queue = [];
    this.persist();
  }

  private persist() {
    localStorage.setItem('p1_offline_queue', JSON.stringify(this.queue));
  }
}

export const offlineQueue = new OfflineQueueManager();

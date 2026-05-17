export class KeyedMutex {
  private queues = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    const queued = previous.then(() => current);
    this.queues.set(key, queued);
    await previous;

    try {
      return await task();
    } finally {
      release();
      if (this.queues.get(key) === queued) {
        this.queues.delete(key);
      }
    }
  }
}

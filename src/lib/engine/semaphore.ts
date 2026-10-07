/**
 * Tiny counting semaphore used to cap how many agent executions run
 * simultaneously. Prevents fan-out from saturating the API or local CPU.
 */
export class Semaphore {
  private slots: number;
  private queue: Array<() => void> = [];

  constructor(slots: number) {
    this.slots = Math.max(1, slots);
  }

  async acquire(): Promise<() => void> {
    if (this.slots > 0) {
      this.slots -= 1;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => resolve(() => this.release()));
    });
  }

  private release() {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.slots += 1;
    }
  }
}

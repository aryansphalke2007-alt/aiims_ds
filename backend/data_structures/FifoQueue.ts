/**
 * First-In-First-Out (FIFO) Queue Implementation from Scratch
 * 
 * Used for the First-Come-First-Served (FCFS) baseline triage policy.
 * Implemented using a dual-pointer or dynamic array with head index
 * to guarantee amortized O(1) enqueue and dequeue operations.
 * 
 * Time Complexities:
 * - enqueue: O(1)
 * - dequeue: O(1) amortized
 * - peek: O(1)
 * - size / isEmpty: O(1)
 */

export class FifoQueue<T> {
  private items: T[] = [];
  private head: number = 0;

  /**
   * Appends an item to the back of the queue.
   * Time Complexity: O(1) amortized
   */
  public enqueue(item: T): void {
    this.items.push(item);
  }

  /**
   * Removes and returns the item from the front of the queue.
   * Periodically cleans up dead space to prevent unbounded memory growth.
   * Time Complexity: O(1) amortized
   */
  public dequeue(): T | undefined {
    if (this.head >= this.items.length) {
      return undefined;
    }
    const item = this.items[this.head];
    this.head++;

    // Reclaim memory when dead items exceed half the array
    if (this.head > 100 && this.head > this.items.length / 2) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }

    return item;
  }

  /**
   * Returns the item at the front of the queue without removing it.
   * Time Complexity: O(1)
   */
  public peek(): T | undefined {
    if (this.head >= this.items.length) {
      return undefined;
    }
    return this.items[this.head];
  }

  /**
   * Returns the number of items currently in the queue.
   * Time Complexity: O(1)
   */
  public size(): number {
    return this.items.length - this.head;
  }

  /**
   * Checks if the queue is empty.
   * Time Complexity: O(1)
   */
  public isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * Clears all items.
   * Time Complexity: O(1)
   */
  public clear(): void {
    this.items = [];
    this.head = 0;
  }

  /**
   * Returns an array of items in queue order (front to back).
   * Time Complexity: O(n)
   */
  public toArray(): T[] {
    return this.items.slice(this.head);
  }

  /**
   * Removes an item matching the predicate.
   * Time Complexity: O(n)
   */
  public removeWhere(predicate: (item: T) => boolean): boolean {
    const active = this.toArray();
    const idx = active.findIndex(predicate);
    if (idx === -1) return false;
    active.splice(idx, 1);
    this.items = active;
    this.head = 0;
    return true;
  }
}

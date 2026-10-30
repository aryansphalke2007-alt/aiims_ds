/**
 * Naive List with Linear Scan Priority Queue Implementation
 * 
 * Used for direct algorithmic comparison and benchmarking against the Binary Min-Heap.
 * Maintains an unsorted array where insertion is O(1), but extraction requires
 * scanning every element to locate the minimum (O(n)).
 * 
 * Time Complexities:
 * - push (insert): O(1)
 * - pop (extract-min): O(n) - linear scan over all n items + O(n) array splice
 * - peek: O(n) - linear scan over all n items
 * - size / isEmpty: O(1)
 */

import { Comparator } from './MinHeap.js';

export class LinearScanQueue<T> {
  private items: T[] = [];
  private comparator: Comparator<T>;

  constructor(comparator: Comparator<T>) {
    this.comparator = comparator;
  }

  /**
   * Appends item to the end of the array.
   * Time Complexity: O(1)
   */
  public push(item: T): void {
    this.items.push(item);
  }

  /**
   * Finds the minimum element by scanning all elements linearly,
   * then removes it from the array.
   * Time Complexity: O(n)
   */
  public pop(): T | undefined {
    if (this.items.length === 0) return undefined;

    let bestIdx = 0;
    for (let i = 1; i < this.items.length; i++) {
      if (this.comparator(this.items[i], this.items[bestIdx]) < 0) {
        bestIdx = i;
      }
    }

    const [bestItem] = this.items.splice(bestIdx, 1);
    return bestItem;
  }

  /**
   * Scans all elements linearly to find the minimum without removing it.
   * Time Complexity: O(n)
   */
  public peek(): T | undefined {
    if (this.items.length === 0) return undefined;

    let bestIdx = 0;
    for (let i = 1; i < this.items.length; i++) {
      if (this.comparator(this.items[i], this.items[bestIdx]) < 0) {
        bestIdx = i;
      }
    }

    return this.items[bestIdx];
  }

  /**
   * Returns current count.
   * Time Complexity: O(1)
   */
  public size(): number {
    return this.items.length;
  }

  /**
   * Checks if queue is empty.
   * Time Complexity: O(1)
   */
  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Clears all items.
   * Time Complexity: O(1)
   */
  public clear(): void {
    this.items = [];
  }

  /**
   * Returns a copy of the items.
   * Time Complexity: O(n)
   */
  public toArray(): T[] {
    return [...this.items];
  }
}

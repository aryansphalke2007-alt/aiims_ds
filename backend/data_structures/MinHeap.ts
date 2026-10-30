/**
 * Binary Min-Heap Implementation from Scratch
 * 
 * Used as the primary triage priority queue in the Emergency Department.
 * Stores elements in a complete binary tree backed by a dynamic array.
 * 
 * Time Complexities:
 * - push (insert): O(log n)
 * - pop (extract-min): O(log n)
 * - peek: O(1)
 * - heapify (build-heap): O(n) using Floyd's bottom-up algorithm
 * - size / isEmpty: O(1)
 * - toSortedArray: O(n log n)
 */

export type Comparator<T> = (a: T, b: T) => number;

export class MinHeap<T> {
  private heap: T[] = [];
  private comparator: Comparator<T>;

  /**
   * Initializes an empty Min-Heap with a custom comparison function.
   * @param comparator - Returns < 0 if 'a' has higher priority than 'b' (min element first),
   *                     0 if equal, and > 0 if 'b' has higher priority.
   */
  constructor(comparator: Comparator<T>) {
    this.comparator = comparator;
  }

  /**
   * Returns the parent index of a node at index i.
   * Time Complexity: O(1)
   */
  private parentIndex(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  /**
   * Returns the left child index of a node at index i.
   * Time Complexity: O(1)
   */
  private leftChildIndex(i: number): number {
    return 2 * i + 1;
  }

  /**
   * Returns the right child index of a node at index i.
   * Time Complexity: O(1)
   */
  private rightChildIndex(i: number): number {
    return 2 * i + 2;
  }

  /**
   * Swaps elements at index i and j.
   * Time Complexity: O(1)
   */
  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }

  /**
   * Restores the heap invariant by bubbling up the element at index i.
   * Continues until parent <= current or root is reached.
   * Time Complexity: O(log n) - traverses tree height at most.
   */
  private heapifyUp(index: number): void {
    let curr = index;
    while (curr > 0) {
      const parent = this.parentIndex(curr);
      if (this.comparator(this.heap[curr], this.heap[parent]) < 0) {
        this.swap(curr, parent);
        curr = parent;
      } else {
        break;
      }
    }
  }

  /**
   * Restores the heap invariant by bubbling down the element at index i.
   * Compares with both children and swaps with the smallest.
   * Time Complexity: O(log n) - traverses tree height at most.
   */
  private heapifyDown(index: number): void {
    let curr = index;
    const length = this.heap.length;

    while (this.leftChildIndex(curr) < length) {
      let smallest = curr;
      const left = this.leftChildIndex(curr);
      const right = this.rightChildIndex(curr);

      if (left < length && this.comparator(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }

      if (right < length && this.comparator(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== curr) {
        this.swap(curr, smallest);
        curr = smallest;
      } else {
        break;
      }
    }
  }

  /**
   * Inserts an element into the min-heap.
   * Element is appended to the underlying array, then heapifyUp restores order.
   * Time Complexity: O(log n)
   */
  public push(item: T): void {
    this.heap.push(item);
    this.heapifyUp(this.heap.length - 1);
  }

  /**
   * Removes and returns the highest priority element (minimum) from the heap.
   * Root is swapped with the last element, popped, and heapifyDown restores order.
   * Time Complexity: O(log n)
   */
  public pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const root = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.heapifyDown(0);
    return root;
  }

  /**
   * Returns the highest priority element without removing it.
   * Time Complexity: O(1)
   */
  public peek(): T | undefined {
    return this.heap.length > 0 ? this.heap[0] : undefined;
  }

  /**
   * Returns the current number of elements in the heap.
   * Time Complexity: O(1)
   */
  public size(): number {
    return this.heap.length;
  }

  /**
   * Checks whether the heap has no elements.
   * Time Complexity: O(1)
   */
  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Clears all elements from the heap.
   * Time Complexity: O(1)
   */
  public clear(): void {
    this.heap = [];
  }

  /**
   * Returns a copy of the underlying array (not necessarily sorted).
   * Time Complexity: O(n)
   */
  public toArray(): T[] {
    return [...this.heap];
  }

  /**
   * Removes a specific item matching a predicate and restores heap order.
   * Time Complexity: O(n) search + O(log n) heap fix = O(n)
   */
  public removeWhere(predicate: (item: T) => boolean): boolean {
    const idx = this.heap.findIndex(predicate);
    if (idx === -1) return false;

    if (idx === this.heap.length - 1) {
      this.heap.pop();
      return true;
    }

    this.heap[idx] = this.heap.pop()!;
    // Either sift up or sift down depending on value
    this.heapifyDown(idx);
    this.heapifyUp(idx);
    return true;
  }

  /**
   * Returns all elements sorted in priority order (min to max) by creating
   * a shallow clone and extracting all items.
   * Time Complexity: O(n log n)
   */
  public toSortedArray(): T[] {
    const clone = new MinHeap<T>(this.comparator);
    clone.heap = [...this.heap];
    const sorted: T[] = [];
    while (!clone.isEmpty()) {
      sorted.push(clone.pop()!);
    }
    return sorted;
  }

  /**
   * Bottom-up Floyd's Heap Construction from an arbitrary array of items.
   * Starts at the last non-leaf parent index and sifts down.
   * Time Complexity: O(n) (rigorous mathematical sum of heights)
   */
  public static buildHeap<T>(items: T[], comparator: Comparator<T>): MinHeap<T> {
    const heapInstance = new MinHeap<T>(comparator);
    heapInstance.heap = [...items];
    const n = heapInstance.heap.length;
    // Last non-leaf node index = Math.floor(n / 2) - 1
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      heapInstance.heapifyDown(i);
    }
    return heapInstance;
  }
}

/**
 * Discrete-Event Simulator Event Queue
 * 
 * Powered by a specialized Binary Min-Heap ordered by event timestamp.
 * Guarantees simulation events are processed strictly chronologically.
 * 
 * Time Complexities:
 * - schedule (push): O(log E) where E is scheduled event count
 * - nextEvent (pop): O(log E)
 * - peekNextTime: O(1)
 */

import { MinHeap } from './MinHeap.js';

export type SimEventType = 'ARRIVAL' | 'COMPLETION';

export interface SimEvent {
  id: number;
  time: number; // in simulation minutes
  type: SimEventType;
  patientId: number;
  doctorId?: number;
  patient?: any;
}

export class EventQueue {
  private heap: MinHeap<SimEvent>;
  private nextEventId: number = 1;

  constructor() {
    this.heap = new MinHeap<SimEvent>((a, b) => {
      // Primary order: minimum timestamp first
      if (a.time !== b.time) {
        return a.time - b.time;
      }
      // Tie breaker: event creation order (ID)
      return a.id - b.id;
    });
  }

  /**
   * Schedules a new simulation event.
   * Time Complexity: O(log E)
   */
  public schedule(time: number, type: SimEventType, patientId: number, doctorId?: number, patient?: any): SimEvent {
    const event: SimEvent = {
      id: this.nextEventId++,
      time,
      type,
      patientId,
      doctorId,
      patient
    };
    this.heap.push(event);
    return event;
  }

  /**
   * Extracts the chronologically earliest event.
   * Time Complexity: O(log E)
   */
  public nextEvent(): SimEvent | undefined {
    return this.heap.pop();
  }

  /**
   * Peeks at the next scheduled event without removing it.
   * Time Complexity: O(1)
   */
  public peek(): SimEvent | undefined {
    return this.heap.peek();
  }

  /**
   * Returns current pending event count.
   * Time Complexity: O(1)
   */
  public size(): number {
    return this.heap.size();
  }

  /**
   * Checks if no events remain.
   * Time Complexity: O(1)
   */
  public isEmpty(): boolean {
    return this.heap.isEmpty();
  }

  /**
   * Resets the event queue.
   */
  public clear(): void {
    this.heap.clear();
    this.nextEventId = 1;
  }
}

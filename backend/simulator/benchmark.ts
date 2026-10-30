/**
 * Algorithmic Benchmark Engine
 * 
 * Compares the scratch-built Binary Min-Heap (O(log n) push & pop) against
 * the Naive List with Linear Scan (O(1) push, O(n) pop with scan + splice).
 * 
 * Benchmarks sequence of n insertions followed by n extractions for:
 * n = 100, 500, 1000, 2500, 5000, 10000.
 */

import { MinHeap } from '../data_structures/MinHeap.js';
import { LinearScanQueue } from '../data_structures/LinearScanQueue.js';
import { SeededRNG } from './rng.js';

export interface BenchmarkPoint {
  n: number;
  heapPushTimeMs: number;
  heapPopTimeMs: number;
  heapTotalTimeMs: number;
  listPushTimeMs: number;
  listPopTimeMs: number;
  listTotalTimeMs: number;
  speedupFactor: number; // listTotalTime / heapTotalTime
}

export interface BenchmarkReport {
  timestamp: string;
  testSizes: number[];
  results: BenchmarkPoint[];
  theoreticalComplexity: {
    heap: string;
    linearScan: string;
  };
}

export function runBenchmark(customSizes?: number[]): BenchmarkReport {
  const sizes = customSizes || [100, 500, 1000, 2500, 5000, 10000];
  const rng = new SeededRNG(1337);
  const results: BenchmarkPoint[] = [];

  const comparator = (a: { priority: number; id: number }, b: { priority: number; id: number }) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.id - b.id;
  };

  for (const n of sizes) {
    // Generate identical random datasets
    const dataset: { priority: number; id: number }[] = [];
    for (let i = 0; i < n; i++) {
      dataset.push({
        priority: rng.next() * 100,
        id: i + 1,
      });
    }

    // 1. MinHeap Benchmark
    const heap = new MinHeap<{ priority: number; id: number }>(comparator);

    const heapPushStart = process.hrtime.bigint();
    for (let i = 0; i < n; i++) {
      heap.push(dataset[i]);
    }
    const heapPushEnd = process.hrtime.bigint();

    const heapPopStart = process.hrtime.bigint();
    for (let i = 0; i < n; i++) {
      heap.pop();
    }
    const heapPopEnd = process.hrtime.bigint();

    const heapPushMs = Number(heapPushEnd - heapPushStart) / 1_000_000;
    const heapPopMs = Number(heapPopEnd - heapPopStart) / 1_000_000;
    const heapTotalMs = Number((heapPushMs + heapPopMs).toFixed(4));

    // 2. Linear Scan Queue Benchmark
    const listQueue = new LinearScanQueue<{ priority: number; id: number }>(comparator);

    const listPushStart = process.hrtime.bigint();
    for (let i = 0; i < n; i++) {
      listQueue.push(dataset[i]);
    }
    const listPushEnd = process.hrtime.bigint();

    const listPopStart = process.hrtime.bigint();
    for (let i = 0; i < n; i++) {
      listQueue.pop();
    }
    const listPopEnd = process.hrtime.bigint();

    const listPushMs = Number(listPushEnd - listPushStart) / 1_000_000;
    const listPopMs = Number(listPopEnd - listPopStart) / 1_000_000;
    const listTotalMs = Number((listPushMs + listPopMs).toFixed(4));

    const speedup = heapTotalMs > 0 ? Number((listTotalMs / heapTotalMs).toFixed(1)) : 1;

    results.push({
      n,
      heapPushTimeMs: Number(heapPushMs.toFixed(4)),
      heapPopTimeMs: Number(heapPopMs.toFixed(4)),
      heapTotalTimeMs: heapTotalMs,
      listPushTimeMs: Number(listPushMs.toFixed(4)),
      listPopTimeMs: Number(listPopMs.toFixed(4)),
      listTotalTimeMs: listTotalMs,
      speedupFactor: speedup,
    });
  }

  return {
    timestamp: new Date().toISOString(),
    testSizes: sizes,
    results,
    theoreticalComplexity: {
      heap: 'Insert: O(log n), Extract-Min: O(log n), Total for n operations: O(n log n)',
      linearScan: 'Insert: O(1), Extract-Min: O(n), Total for n operations: O(n²)',
    },
  };
}

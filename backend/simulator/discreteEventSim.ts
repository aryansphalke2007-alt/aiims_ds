/**
 * Discrete-Event Simulation Engine for Emergency Department Triage
 * 
 * Employs two scratch-built Binary Min-Heaps:
 * 1. EventQueue (Min-Heap): Chronologically orders future arrival & departure events.
 * 2. TriageQueue (Min-Heap / FIFO): Prioritizes waiting patients according to the active policy.
 */

import { MinHeap } from '../data_structures/MinHeap.js';
import { FifoQueue } from '../data_structures/FifoQueue.js';
import { EventQueue } from '../data_structures/EventQueue.js';
import { SeededRNG } from './rng.js';

export type SimPolicy = 'fcfs' | 'strict_priority' | 'priority_linear_aging' | 'priority_threshold_aging';

export interface SimParams {
  policy: SimPolicy;
  alpha?: number; // default 0.05
  thresholdMinutes?: number; // default 30
  arrivalRatePerHour: number; // patients per hour (e.g. 12)
  numDoctors: number; // e.g. 3
  durationHours: number; // e.g. 24
  seed: number; // deterministic seed
  severityDistribution?: number[]; // [p1, p2, p3, p4, p5]
  starvationThresholdMinutes?: number; // default 120
  replications?: number; // default 1 (or up to 30)
}

export interface SimPatient {
  id: number;
  severity: number;
  arrivalTime: number; // in simulation minutes
  startTime?: number;
  finishTime?: number;
  waitTime: number; // minutes
  serviceDuration: number;
}

export interface AcuityMetrics {
  count: number;
  meanWait: number;
  medianWait: number;
  p95Wait: number;
  p99Wait: number;
  maxWait: number;
}

export interface SingleRunResult {
  policy: SimPolicy;
  alpha: number;
  thresholdMinutes: number;
  seed: number;
  totalPatients: number;
  completedPatients: number;
  averageWait: number;
  maxWait: number;
  utilization: number; // 0 to 1
  starvationPercent: number; // % of ESI 4-5 waiting > threshold
  fairnessRatio: number; // std dev / mean wait or max/min
  bySeverity: Record<number, AcuityMetrics>;
  queueLengthOverTime: { time: number; length: number }[];
  waitTimesCDF: { wait: number; percentile: number }[];
}

export interface AggregatedResult {
  policy: SimPolicy;
  replicationsCount: number;
  meanAverageWait: number;
  ci95AverageWait: [number, number];
  meanMaxWait: number;
  meanUtilization: number;
  meanStarvationPercent: number;
  bySeverity: Record<number, { meanWait: number; p95Wait: number; maxWait: number }>;
  sampleRun: SingleRunResult;
}

export class DiscreteEventSimulator {
  /**
   * Runs a single replication of the discrete-event simulation.
   */
  public runSingle(params: SimParams): SingleRunResult {
    const alpha = params.alpha ?? 0.05;
    const threshold = params.thresholdMinutes ?? 30;
    const starvationThreshold = params.starvationThresholdMinutes ?? 120;
    const totalSimMinutes = params.durationHours * 60;
    const arrivalRatePerMinute = params.arrivalRatePerHour / 60;
    const severityDist = params.severityDistribution || [0.05, 0.15, 0.40, 0.30, 0.10];

    const rng = new SeededRNG(params.seed);
    const eventQueue = new EventQueue();

    // Setup Triage Queue
    const minHeapComparator = (a: SimPatient, b: SimPatient) => {
      if (params.policy === 'fcfs') {
        return a.arrivalTime - b.arrivalTime || a.id - b.id;
      }
      if (params.policy === 'strict_priority') {
        if (a.severity !== b.severity) return a.severity - b.severity;
        return a.arrivalTime - b.arrivalTime || a.id - b.id;
      }
      if (params.policy === 'priority_linear_aging') {
        // Time-Invariant Key Trick: key = severity + alpha * arrivalTime
        const keyA = a.severity + alpha * a.arrivalTime;
        const keyB = b.severity + alpha * b.arrivalTime;
        const diff = keyA - keyB;
        if (Math.abs(diff) > 1e-9) return diff;
        return a.arrivalTime - b.arrivalTime || a.id - b.id;
      }
      // Threshold aging fallback comparator (dynamic)
      return a.severity - b.severity || a.arrivalTime - b.arrivalTime || a.id - b.id;
    };

    const minHeap = new MinHeap<SimPatient>(minHeapComparator);
    const fifo = new FifoQueue<SimPatient>();

    // Doctors state
    const freeDoctorIds: number[] = [];
    for (let d = 1; d <= params.numDoctors; d++) {
      freeDoctorIds.push(d);
    }
    const busyDoctors = new Map<number, { patientId: number; finishTime: number }>();

    // Pre-generate patient arrival stream using Poisson process (exponential inter-arrivals)
    let nextArrival = rng.exponential(arrivalRatePerMinute);
    let patientCounter = 1;
    const allPatients = new Map<number, SimPatient>();

    while (nextArrival < totalSimMinutes) {
      const severity = rng.sampleSeverity(severityDist);
      const serviceDuration = rng.serviceDuration(severity);
      const patient: SimPatient = {
        id: patientCounter++,
        severity,
        arrivalTime: nextArrival,
        waitTime: 0,
        serviceDuration,
      };
      allPatients.set(patient.id, patient);
      eventQueue.schedule(nextArrival, 'ARRIVAL', patient.id, undefined, patient);

      nextArrival += rng.exponential(arrivalRatePerMinute);
    }

    // Tracking metrics
    const completedList: SimPatient[] = [];
    let totalDoctorBusyMinutes = 0;
    const queueSamples: { time: number; length: number }[] = [];
    let lastSampleTime = 0;

    const recordQueueLength = (t: number) => {
      if (t - lastSampleTime >= 15 || queueSamples.length === 0) {
        const curLength = params.policy === 'fcfs' ? fifo.size() : minHeap.size();
        queueSamples.push({ time: Number(t.toFixed(1)), length: curLength });
        lastSampleTime = t;
      }
    };

    // Main discrete-event loop
    while (!eventQueue.isEmpty()) {
      const event = eventQueue.nextEvent()!;
      const simTime = event.time;

      recordQueueLength(simTime);

      if (event.type === 'ARRIVAL') {
        const patient = allPatients.get(event.patientId)!;

        if (freeDoctorIds.length > 0) {
          // Serve immediately
          const docId = freeDoctorIds.shift()!;
          patient.startTime = simTime;
          patient.waitTime = 0;
          patient.finishTime = simTime + patient.serviceDuration;
          totalDoctorBusyMinutes += patient.serviceDuration;

          busyDoctors.set(docId, { patientId: patient.id, finishTime: patient.finishTime });
          eventQueue.schedule(patient.finishTime, 'COMPLETION', patient.id, docId);
        } else {
          // Queue patient
          if (params.policy === 'fcfs') {
            fifo.enqueue(patient);
          } else {
            minHeap.push(patient);
          }
        }
      } else if (event.type === 'COMPLETION') {
        const patient = allPatients.get(event.patientId)!;
        completedList.push(patient);

        const docId = event.doctorId!;
        busyDoctors.delete(docId);

        // Check if patients are waiting
        let nextPatient: SimPatient | undefined;

        if (params.policy === 'fcfs') {
          nextPatient = fifo.dequeue();
        } else if (params.policy === 'priority_threshold_aging') {
          // Dynamic threshold priority selection
          const waiting = minHeap.toArray();
          if (waiting.length > 0) {
            waiting.sort((a, b) => {
              const waitA = simTime - a.arrivalTime;
              const waitB = simTime - b.arrivalTime;
              const effA = Math.max(1, a.severity - Math.floor(waitA / threshold));
              const effB = Math.max(1, b.severity - Math.floor(waitB / threshold));
              if (effA !== effB) return effA - effB;
              return a.arrivalTime - b.arrivalTime || a.id - b.id;
            });
            nextPatient = waiting[0];
            minHeap.removeWhere((p) => p.id === nextPatient!.id);
          }
        } else {
          nextPatient = minHeap.pop();
        }

        if (nextPatient) {
          nextPatient.startTime = simTime;
          nextPatient.waitTime = Math.max(0, simTime - nextPatient.arrivalTime);
          nextPatient.finishTime = simTime + nextPatient.serviceDuration;
          totalDoctorBusyMinutes += nextPatient.serviceDuration;

          busyDoctors.set(docId, { patientId: nextPatient.id, finishTime: nextPatient.finishTime });
          eventQueue.schedule(nextPatient.finishTime, 'COMPLETION', nextPatient.id, docId);
        } else {
          // Doctor becomes idle
          freeDoctorIds.push(docId);
        }
      }
    }

    // Compute statistics across completed patients
    const waits = completedList.map((p) => p.waitTime).sort((a, b) => a - b);
    const avgWait = waits.length > 0 ? waits.reduce((s, w) => s + w, 0) / waits.length : 0;
    const maxWait = waits.length > 0 ? waits[waits.length - 1] : 0;

    // Severity breakdown
    const bySeverity: Record<number, AcuityMetrics> = {};
    for (let s = 1; s <= 5; s++) {
      const sPatients = completedList.filter((p) => p.severity === s);
      const sWaits = sPatients.map((p) => p.waitTime).sort((a, b) => a - b);
      const sCount = sWaits.length;
      const sMean = sCount > 0 ? sWaits.reduce((acc, v) => acc + v, 0) / sCount : 0;
      const sMedian = sCount > 0 ? sWaits[Math.floor(sCount * 0.5)] : 0;
      const sP95 = sCount > 0 ? sWaits[Math.floor(sCount * 0.95)] : 0;
      const sP99 = sCount > 0 ? sWaits[Math.floor(sCount * 0.99)] : 0;
      const sMax = sCount > 0 ? sWaits[sCount - 1] : 0;

      bySeverity[s] = {
        count: sCount,
        meanWait: Number(sMean.toFixed(1)),
        medianWait: Number(sMedian.toFixed(1)),
        p95Wait: Number(sP95.toFixed(1)),
        p99Wait: Number(sP99.toFixed(1)),
        maxWait: Number(sMax.toFixed(1)),
      };
    }

    // Starvation Risk: % of ESI 4-5 patients waiting longer than threshold
    const lowAcuityPatients = completedList.filter((p) => p.severity >= 4);
    const starvedCount = lowAcuityPatients.filter((p) => p.waitTime > starvationThreshold).length;
    const starvationPercent =
      lowAcuityPatients.length > 0 ? Number(((starvedCount / lowAcuityPatients.length) * 100).toFixed(1)) : 0;

    // Doctor utilization: total service time / (numDoctors * durationMinutes)
    const utilization = Math.min(
      1,
      Number((totalDoctorBusyMinutes / (params.numDoctors * totalSimMinutes)).toFixed(3))
    );

    // Cumulative Distribution Function (CDF) for wait times
    const waitTimesCDF: { wait: number; percentile: number }[] = [];
    if (waits.length > 0) {
      const step = Math.max(1, Math.floor(waits.length / 40));
      for (let i = 0; i < waits.length; i += step) {
        waitTimesCDF.push({
          wait: Number(waits[i].toFixed(1)),
          percentile: Number(((i / waits.length) * 100).toFixed(1)),
        });
      }
      waitTimesCDF.push({
        wait: Number(waits[waits.length - 1].toFixed(1)),
        percentile: 100,
      });
    }

    // Fairness ratio (standard deviation of wait / mean wait)
    let variance = 0;
    for (const w of waits) {
      variance += Math.pow(w - avgWait, 2);
    }
    const stdDev = waits.length > 1 ? Math.sqrt(variance / (waits.length - 1)) : 0;
    const fairnessRatio = avgWait > 0 ? Number((stdDev / avgWait).toFixed(2)) : 1;

    return {
      policy: params.policy,
      alpha,
      thresholdMinutes: threshold,
      seed: params.seed,
      totalPatients: allPatients.size,
      completedPatients: completedList.length,
      averageWait: Number(avgWait.toFixed(1)),
      maxWait: Number(maxWait.toFixed(1)),
      utilization,
      starvationPercent,
      fairnessRatio,
      bySeverity,
      queueLengthOverTime: queueSamples,
      waitTimesCDF,
    };
  }

  /**
   * Runs multiple replications and aggregates statistics with 95% Confidence Interval.
   */
  public runReplications(params: SimParams): AggregatedResult {
    const reps = Math.max(1, Math.min(30, params.replications || 1));
    const runResults: SingleRunResult[] = [];

    for (let r = 0; r < reps; r++) {
      const repSeed = params.seed + r * 1013904223; // distinct deterministic seed per rep
      const res = this.runSingle({ ...params, seed: repSeed });
      runResults.push(res);
    }

    const avgWaits = runResults.map((r) => r.averageWait);
    const meanAvgWait = avgWaits.reduce((s, v) => s + v, 0) / reps;
    const stdErr = reps > 1
      ? Math.sqrt(avgWaits.reduce((s, v) => s + Math.pow(v - meanAvgWait, 2), 0) / (reps - 1)) / Math.sqrt(reps)
      : 0;
    const tCrit = 2.045; // ~ t-value for 95% CI with 29 degrees of freedom
    const ciLow = Number(Math.max(0, meanAvgWait - tCrit * stdErr).toFixed(1));
    const ciHigh = Number((meanAvgWait + tCrit * stdErr).toFixed(1));

    const meanMaxWait = Number((runResults.reduce((s, r) => s + r.maxWait, 0) / reps).toFixed(1));
    const meanUtil = Number((runResults.reduce((s, r) => s + r.utilization, 0) / reps).toFixed(3));
    const meanStarve = Number((runResults.reduce((s, r) => s + r.starvationPercent, 0) / reps).toFixed(1));

    const bySeverityAgg: Record<number, { meanWait: number; p95Wait: number; maxWait: number }> = {};
    for (let s = 1; s <= 5; s++) {
      const sMeans = runResults.map((r) => r.bySeverity[s]?.meanWait || 0);
      const sP95s = runResults.map((r) => r.bySeverity[s]?.p95Wait || 0);
      const sMaxes = runResults.map((r) => r.bySeverity[s]?.maxWait || 0);
      bySeverityAgg[s] = {
        meanWait: Number((sMeans.reduce((a, b) => a + b, 0) / reps).toFixed(1)),
        p95Wait: Number((sP95s.reduce((a, b) => a + b, 0) / reps).toFixed(1)),
        maxWait: Number((sMaxes.reduce((a, b) => a + b, 0) / reps).toFixed(1)),
      };
    }

    return {
      policy: params.policy,
      replicationsCount: reps,
      meanAverageWait: Number(meanAvgWait.toFixed(1)),
      ci95AverageWait: [ciLow, ciHigh],
      meanMaxWait,
      meanUtilization: meanUtil,
      meanStarvationPercent: meanStarve,
      bySeverity: bySeverityAgg,
      sampleRun: runResults[0],
    };
  }

  /**
   * Compares all 4 triage policies on the exact same seed stream!
   */
  public compareAllPolicies(params: Omit<SimParams, 'policy'>): Record<SimPolicy, AggregatedResult> {
    const policies: SimPolicy[] = ['fcfs', 'strict_priority', 'priority_linear_aging', 'priority_threshold_aging'];
    const results: any = {};
    for (const p of policies) {
      results[p] = this.runReplications({ ...params, policy: p });
    }
    return results;
  }
}

export const simulator = new DiscreteEventSimulator();

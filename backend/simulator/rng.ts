/**
 * Seedable Deterministic Pseudo-Random Number Generator (Mulberry32)
 * 
 * Ensures all simulation policies and replications can run on exact identical
 * patient arrival and service streams for scientifically rigorous A/B comparisons.
 */

export class SeededRNG {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed >>> 0;
  }

  /**
   * Generates a deterministic uniform random float in [0, 1).
   */
  public next(): number {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generates an exponential random variate with rate parameter lambda.
   * Inter-arrival times for Poisson processes follow this distribution.
   * E[X] = 1 / lambda
   */
  public exponential(lambda: number): number {
    const u = Math.max(1e-10, this.next());
    return -Math.log(u) / lambda;
  }

  /**
   * Samples a discrete category (ESI 1..5) given an array of normalized probabilities.
   */
  public sampleSeverity(probabilities: number[] = [0.05, 0.15, 0.40, 0.30, 0.10]): number {
    const r = this.next();
    let cumulative = 0;
    for (let i = 0; i < probabilities.length; i++) {
      cumulative += probabilities[i];
      if (r <= cumulative) return i + 1; // 1-indexed ESI 1 to 5
    }
    return probabilities.length;
  }

  /**
   * Generates realistic medical service times (in minutes) based on ESI acuity.
   * Uses Box-Muller transform for log-normal / Gaussian clinical duration.
   */
  public serviceDuration(severity: number): number {
    // ESI 1: Resuscitation/trauma ~40 min
    // ESI 2: Emergent ~30 min
    // ESI 3: Urgent ~20 min
    // ESI 4: Less Urgent ~12 min
    // ESI 5: Non-urgent ~8 min
    const means = [40, 30, 20, 12, 8];
    const mean = means[severity - 1] || 15;
    const stdDev = mean * 0.3;

    // Box-Muller transform
    const u1 = Math.max(1e-10, this.next());
    const u2 = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const sample = mean + z * stdDev;

    return Math.max(3, Number(sample.toFixed(2)));
  }
}

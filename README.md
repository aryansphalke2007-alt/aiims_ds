# Hospital Emergency Triage Queue Simulator
### Data Structures & Algorithms Capstone Project

A complete full-stack web application and discrete-event simulation workbench modeling Emergency Department (ED) triage queuing dynamics under stochastic Poisson arrival streams.

Built with **Node.js, Express, SQLite (persistent file storage), React, Tailwind CSS, and Chart.js**.

---

## 1. Core Data Structures Implemented From Scratch

This system avoids all third-party priority queue libraries and implements foundational data structures directly in TypeScript with strict asymptotic efficiency:

1. **Binary Min-Heap (`backend/data_structures/MinHeap.ts`)**:
   - Primary data structure powering the hospital emergency triage waiting room.
   - **`push(item)`**: $O(\log n)$ via bottom-up sift (`heapifyUp`).
   - **`pop()`**: $O(\log n)$ via root replacement and top-down sift (`heapifyDown`).
   - **`peek()`**: $O(1)$ constant-time root access.
   - **`buildHeap(items)`**: $O(n)$ bottom-up heap construction using Floyd’s algorithm.
   - **`toSortedArray()`**: $O(n \log n)$ priority extraction.
   - **`removeWhere(predicate)`**: $O(n)$ search followed by $O(\log n)$ sift.

2. **Discrete-Event Simulation Event Queue (`backend/data_structures/EventQueue.ts`)**:
   - Secondary Binary Min-Heap chronologically ordering future `ARRIVAL` and `COMPLETION` simulation events.
   - Guarantees $O(\log E)$ event insertion and dispatch without event-sorting overhead.

3. **FIFO Queue (`backend/data_structures/FifoQueue.ts`)**:
   - Array/deque implementation with memory reclamation providing amortized $O(1)$ `enqueue` and `dequeue` for the First-Come-First-Served (FCFS) baseline policy.

4. **Naive Linear Scan Queue (`backend/data_structures/LinearScanQueue.ts`)**:
   - Unsorted array implementation requiring $O(1)$ insertion but $O(n)$ linear scan and splice on extraction.
   - Used for direct empirical benchmarking against the Binary Min-Heap across $n = 100 \dots 10,000$.

---

## 2. Priority Logic & The Time-Invariant Key Trick

### Severity Levels (Emergency Severity Index - ESI)
- **ESI 1 (Resuscitation)**: Immediate life-saving intervention needed (Critical).
- **ESI 2 (Emergent)**: High risk, severe pain, or confusion.
- **ESI 3 (Urgent)**: Multiple diagnostic resources required, stable vitals.
- **ESI 4 (Less Urgent)**: One diagnostic resource required (e.g. simple X-ray).
- **ESI 5 (Non-Urgent)**: No diagnostic resources needed (e.g. prescription refill).

Lower effective priority value = served first.

### Mathematical Proof of Time-Invariant Heap Sorting
In standard linear aging priority queues, effective priority decreases as waiting time grows:
$$P_{\text{eff}}(t) = \text{Severity} - \alpha \times (t - t_{\text{arr}})$$

Comparing any two patients $A$ and $B$ at current time $t$:
$$P_{\text{eff}, A}(t) < P_{\text{eff}, B}(t)$$
$$\iff \text{Sev}_A - \alpha(t - t_{\text{arr}, A}) < \text{Sev}_B - \alpha(t - t_{\text{arr}, B})$$
$$\iff \text{Sev}_A - \alpha t + \alpha t_{\text{arr}, A} < \text{Sev}_B - \alpha t + \alpha t_{\text{arr}, B}$$
$$\iff \text{Sev}_A + \alpha t_{\text{arr}, A} < \text{Sev}_B + \alpha t_{\text{arr}, B} \quad (\text{adding } \alpha t \text{ to both sides})$$

Therefore, the key:
$$K = \text{Severity} + \alpha \times t_{\text{arr}}$$
is **completely invariant with respect to time $t$**! The relative order between any two patients never shifts as clock time elapses, enabling the Min-Heap to maintain exact priority without costly $O(n)$ re-heapifying every minute!

### Triage Policies Selectable in UI
1. **FCFS**: First-Come-First-Served baseline.
2. **Strict Priority**: Severity first (no aging). Low acuity patients risk starvation.
3. **Priority + Linear Aging**: $K = \text{Severity} + \alpha \times t_{\text{arr}}$. Prevents starvation.
4. **Priority + Threshold Aging**: Step promotion: acuity increases 1 level for each $T$ minutes waited.

---

## 3. Persistent Database Architecture (SQLite)

Located at `./data/triage.db` (auto-created with WAL mode enabled):

- **`patients`**: Stores all admissions, triage classifications, timestamps, assigned doctor, wait times, and service times.
- **`doctors`**: Tracks physician names, specializations, statuses (`available`, `busy`, `off_duty`), and current patient.
- **`simulation_runs`**: Stores historical Monte Carlo simulation parameters, replications, and results JSON.
- **`settings`**: Persists active triage policy, $\alpha$, threshold $T$, and starvation limits.

On server boot, the backend automatically queries SQLite for all patients with `status = 'waiting'` and rebuilds the in-memory Binary Min-Heap!

---

## 4. REST API Documentation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/patients` | Enqueues a new patient into Min-Heap and writes to SQLite |
| `GET` | `/api/patients` | Queries patient registry (filters: `status`, `severity`, `search`) |
| `GET` | `/api/patients/:id` | Detailed patient record |
| `DELETE` | `/api/patients/:id` | Removes patient from queue and database |
| `POST` | `/api/doctors` | Registers new emergency physician |
| `GET` | `/api/doctors` | Lists all physicians and active patient assignments |
| `PATCH` | `/api/doctors/:id` | Toggles physician status (`available`, `off_duty`) |
| `DELETE` | `/api/doctors/:id` | Removes physician |
| `GET` | `/api/queue` | Returns live queue in served order with effective priorities |
| `POST` | `/api/dispatch` | Pops heap root and assigns to first available doctor |
| `POST` | `/api/complete/:patientId` | Marks treatment complete, frees physician, logs service time |
| `GET` | `/api/settings` | Retrieves active triage policy and parameters |
| `PUT` | `/api/settings` | Updates active policy and re-heapifies queue |
| `POST` | `/api/simulate` | Executes discrete-event simulation (supports 4-policy comparison) |
| `GET` | `/api/simulations` | Retrieves past simulation runs |
| `DELETE` | `/api/simulations/:id` | Deletes a simulation run |
| `GET` | `/api/metrics` | Live patient statistics and wait times |
| `GET` | `/api/benchmark` | High-precision $O(n \log n)$ vs $O(n^2)$ benchmark for $n=100 \dots 10000$ |
| `POST` | `/api/seed` | Resets SQLite with 10 sample patients and 3 emergency doctors |

---

## 5. Setup & Running Instructions

### Prerequisites
- Node.js (v18+)
- npm

### 1. Installation
```bash
npm install
```

### 2. Seed Database (Optional CLI)
```bash
npm run seed
```
*(Note: The server also auto-seeds initial data on first launch if the database is empty)*

### 3. Start Development Server (Full-Stack Express + Vite)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build & Production Start
```bash
npm run build
npm start
```

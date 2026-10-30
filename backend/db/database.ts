import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data folder exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'triage.db');
export const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

// Initialize schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      complaint TEXT NOT NULL,
      severity INTEGER NOT NULL,
      arrival_time REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      assigned_doctor_id INTEGER,
      start_time REAL,
      finish_time REAL,
      wait_minutes REAL,
      service_minutes REAL
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      current_patient_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS simulation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy TEXT NOT NULL,
      alpha REAL,
      arrival_rate REAL,
      num_doctors INTEGER,
      seed INTEGER,
      duration REAL,
      created_at TEXT NOT NULL,
      results_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patient_medical_records (
      patient_id INTEGER PRIMARY KEY,
      blood_group TEXT,
      blood_pressure TEXT,
      heart_rate INTEGER,
      spo2 INTEGER,
      temperature REAL,
      respiratory_rate INTEGER,
      allergies TEXT,
      past_history TEXT,
      tests_json TEXT NOT NULL DEFAULT '[]',
      reports_json TEXT NOT NULL DEFAULT '[]',
      prescriptions_json TEXT NOT NULL DEFAULT '[]',
      doctor_notes TEXT,
      FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Initialize default settings if not already present
  const initSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  initSetting.run('active_policy', 'priority_linear_aging');
  initSetting.run('alpha', '0.05');
  initSetting.run('threshold_minutes', '30');
  initSetting.run('auto_dispatch', 'false');
  initSetting.run('starvation_threshold', '120');

  // Check if we need to seed initial demo data
  const docCount = (db.prepare('SELECT COUNT(*) as count FROM doctors').get() as { count: number }).count;
  if (docCount === 0) {
    seedInitialData();
  }
}

export function seedInitialData() {
  // Clear existing active queue patients, doctors, and medical records for clean seed
  db.exec(`
    DELETE FROM patient_medical_records;
    DELETE FROM doctors;
    DELETE FROM patients;
  `);
  
  // Insert 3 Indian emergency doctors
  const insertDoctor = db.prepare(`
    INSERT INTO doctors (name, specialization, status, current_patient_id)
    VALUES (?, ?, ?, ?)
  `);

  insertDoctor.run('Dr. Rajeshwar Sharma, MD', 'Emergency Medicine & Trauma', 'available', null);
  insertDoctor.run('Dr. Priya Sundaram, MD', 'Critical Care & Resuscitation', 'available', null);
  insertDoctor.run('Dr. Arjun Deshmukh, DNB', 'Pediatric Emergency Medicine', 'available', null);

  // Seed 10 sample Indian patients with realistic emergency complaints
  const insertPatient = db.prepare(`
    INSERT INTO patients (name, age, gender, complaint, severity, arrival_time, status, assigned_doctor_id, start_time, finish_time, wait_minutes, service_minutes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMedicalRecord = db.prepare(`
    INSERT INTO patient_medical_records (patient_id, blood_group, blood_pressure, heart_rate, spo2, temperature, respiratory_rate, allergies, past_history, tests_json, reports_json, prescriptions_json, doctor_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  // 10 realistic Indian emergency patient presentations with clinical records
  const samples = [
    {
      name: 'Rameshwar Patel',
      age: 67,
      gender: 'Male',
      complaint: 'Unresponsive, sudden cardiac arrest, CPR in progress',
      severity: 1,
      arrivalOffset: 12,
      medical: {
        blood_group: 'B+',
        blood_pressure: '65/40 mmHg',
        heart_rate: 142,
        spo2: 81,
        temperature: 98.4,
        respiratory_rate: 28,
        allergies: 'Sulfa Drugs, Aspirin hypersensitivity in 2012',
        past_history: 'Known Coronary Artery Disease (CAD) s/p PTCA (2018), Type 2 Diabetes Mellitus x 14 yrs on Metformin',
        tests: [
          { id: 'T-101', name: '12-Lead Emergency ECG', category: 'Cardiology', status: 'done', suggestedAt: '12m ago', completedAt: '8m ago', result: 'Hyperacute ST elevation V1-V4 (Anterior STEMI)', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-102', name: 'Cardiac Troponin-I (STAT)', category: 'Biochemistry', status: 'done', suggestedAt: '10m ago', completedAt: '5m ago', result: '7.82 ng/mL (Reference: < 0.04 ng/mL - Severely Elevated)', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-103', name: 'Arterial Blood Gas (ABG)', category: 'Biochemistry', status: 'done', suggestedAt: '10m ago', completedAt: '4m ago', result: 'pH 7.19, pO2 62, pCO2 51, Lactate 4.8 mmol/L (Severe Metabolic Acidosis)', doctorName: 'Dr. Priya Sundaram' },
          { id: 'T-104', name: 'Bedside 2D Echocardiography', category: 'Cardiology', status: 'suggested', suggestedAt: '4m ago', result: 'Pending portable probe setup', doctorName: 'Dr. Priya Sundaram' },
          { id: 'T-105', name: 'Emergency Coronary Angiography (Primary PCI)', category: 'Interventional', status: 'suggested', suggestedAt: '3m ago', result: 'Cath lab activated, transfer on ROSC stabilization', doctorName: 'Dr. Rajeshwar Sharma' }
        ],
        reports: [
          { id: 'R-101', title: 'Emergency 12-Lead Electrocardiogram', department: 'Cardiology', date: 'Today (Stat)', findings: 'Sinus tachycardia, 4.5mm ST-segment elevation in leads V1 to V4 with reciprocal ST depressions in inferior leads II, III, aVF.', normalRange: 'Normal sinus rhythm', conclusion: 'Acute Extensive Anterior Myocardial Infarction', status: 'Final Verified' },
          { id: 'R-102', title: 'Point-of-Care Cardiac Enzymes & Lactate', department: 'Pathology Lab', date: 'Today (Stat)', findings: 'High-sensitivity Troponin-I: 7.82 ng/mL, CK-MB: 88 U/L, Serum Lactate: 4.8 mmol/L.', normalRange: 'cTnI: <0.04 ng/mL, CK-MB: <25 U/L', conclusion: 'Marked myocardial necrosis with tissue hypoperfusion', status: 'Final Verified' }
        ],
        prescriptions: [
          { id: 'P-101', medicine: 'Tab Ticagrelor', dosage: '180 mg', route: 'Oral / NG tube', frequency: 'STAT loading dose', instructions: 'Crush and administer via Ryle\'s tube immediately', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-102', medicine: 'Inj Heparin Sodium', dosage: '5000 IU', route: 'IV Bolus', frequency: 'STAT', instructions: 'Administer slow IV push for acute STEMI anticoagulation', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-103', medicine: 'Inj Noradrenaline', dosage: '4 mg in 50ml NS', route: 'IV Infusion', frequency: 'Continuous titrated', instructions: 'Maintain Mean Arterial Pressure (MAP) >= 65 mmHg', prescribedBy: 'Dr. Priya Sundaram', date: 'Today' },
          { id: 'P-104', medicine: 'Inj Pantoprazole', dosage: '40 mg', route: 'IV Push', frequency: 'OD', instructions: 'Stress ulcer prophylaxis', prescribedBy: 'Dr. Priya Sundaram', date: 'Today' }
        ],
        doctor_notes: 'Patient was brought in cardiac arrest with bystander CPR. Achieved ROSC after 6 minutes of ACLS, endotracheal intubation, and 1 direct counter-shock at 200J. Critical care bed and primary PCI team on standby.'
      }
    },
    {
      name: 'Sunita Sharma',
      age: 42,
      gender: 'Female',
      complaint: 'Severe crushing retrosternal chest pain radiating to left arm, diaphoretic',
      severity: 2,
      arrivalOffset: 18,
      medical: {
        blood_group: 'O+',
        blood_pressure: '158/98 mmHg',
        heart_rate: 96,
        spo2: 97,
        temperature: 98.6,
        respiratory_rate: 20,
        allergies: 'No Known Drug Allergies (NKDA)',
        past_history: 'Essential Hypertension x 6 years on Tab Telmisartan 40mg OD, Dyslipidemia',
        tests: [
          { id: 'T-201', name: '12-Lead ECG', category: 'Cardiology', status: 'done', suggestedAt: '18m ago', completedAt: '12m ago', result: 'T-wave inversions in leads V4-V6 and aVL, no acute ST-elevation', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-202', name: 'High-Sensitivity Troponin-T', category: 'Biochemistry', status: 'done', suggestedAt: '15m ago', completedAt: '6m ago', result: '0.088 ng/mL (Reference: < 0.014 ng/mL - Elevated)', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-203', name: 'Serum Electrolytes & Renal Function', category: 'Pathology', status: 'done', suggestedAt: '15m ago', completedAt: '5m ago', result: 'Creatinine 0.9 mg/dL, Urea 24 mg/dL, Na+ 140, K+ 4.1', doctorName: 'Dr. Priya Sundaram' },
          { id: 'T-204', name: 'Digital Chest Radiograph (CXR PA)', category: 'Radiology', status: 'done', suggestedAt: '14m ago', completedAt: '4m ago', result: 'Normal cardiac size, clear lung fields, no pulmonary venous congestion', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-205', name: '2D Echocardiogram with Doppler', category: 'Cardiology', status: 'suggested', suggestedAt: '5m ago', result: 'Awaiting cardiology technician', doctorName: 'Dr. Rajeshwar Sharma' }
        ],
        reports: [
          { id: 'R-201', title: 'Cardiac Biomarker hs-cTnT Report', department: 'Biochemistry Lab', date: 'Today', findings: 'hs-Troponin T level: 0.088 ng/mL. Repeat testing scheduled at 3 hours to evaluate delta.', normalRange: '< 0.014 ng/mL', conclusion: 'Acute Non-ST Elevation Myocardial Infarction (NSTEMI) / Unstable Angina', status: 'Final Verified' },
          { id: 'R-202', title: 'Emergency Chest Radiograph (Portable)', department: 'Diagnostic Radiology', date: 'Today', findings: 'Bronchovascular markings within normal limits. Costophrenic angles sharp. No evidence of aortic dissection flap.', normalRange: 'Normal', conclusion: 'Cardiopulmonary silhouette normal', status: 'Final Verified' }
        ],
        prescriptions: [
          { id: 'P-201', medicine: 'Tab Ecosprin (Aspirin)', dosage: '300 mg', route: 'Oral', frequency: 'STAT chewable', instructions: 'Chew immediately with water', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-202', medicine: 'Tab Clopidogrel', dosage: '300 mg', route: 'Oral', frequency: 'STAT loading', instructions: 'Dual antiplatelet therapy protocol', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-203', medicine: 'Tab Atorvastatin', dosage: '80 mg', route: 'Oral', frequency: 'STAT at bedtime', instructions: 'High-intensity statin therapy', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-204', medicine: 'Inj Fondaparinux', dosage: '2.5 mg', route: 'Subcutaneous', frequency: 'OD', instructions: 'Inject in periumbilical subcutaneous tissue', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-205', medicine: 'Sorbitrate', dosage: '5 mg', route: 'Sublingual', frequency: 'SOS', instructions: 'Keep under tongue if chest tightness recurs', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' }
        ],
        doctor_notes: 'Crushing chest pain radiating to jaw and left arm. ECG demonstrates dynamic lateral ischemia; hs-cTnT positive. Patient moved to cardiac telemetry monitoring. Vital signs stable.'
      }
    },
    {
      name: 'Vikramaditya Joshi',
      age: 29,
      gender: 'Male',
      complaint: 'Compound fracture of left tibia following highway motorcycle collision, acute hemorrhage',
      severity: 2,
      arrivalOffset: 25,
      medical: {
        blood_group: 'A+',
        blood_pressure: '112/74 mmHg',
        heart_rate: 110,
        spo2: 98,
        temperature: 98.2,
        respiratory_rate: 22,
        allergies: 'Ciprofloxacin (developed urticarial rash in 2020)',
        past_history: 'Nil significant. No prior surgeries or chronic medical history.',
        tests: [
          { id: 'T-301', name: 'Digital X-Ray Left Leg (AP & Lateral)', category: 'Radiology', status: 'done', suggestedAt: '24m ago', completedAt: '15m ago', result: 'Comminuted mid-shaft left tibia fracture with displaced fibula', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-302', name: 'Complete Blood Count (CBC) with Platelets', category: 'Hematology', status: 'done', suggestedAt: '22m ago', completedAt: '10m ago', result: 'Hb 11.8 g/dL, TLC 12,400/uL, Platelets 2.45 lakhs/uL', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-303', name: 'Blood Grouping & Cross Matching', category: 'Blood Bank', status: 'done', suggestedAt: '20m ago', completedAt: '8m ago', result: 'A Rh Positive confirmed, 2 units PRBC cross-matched & reserved', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-304', name: 'NCCT Pelvis & Abdomen Fast Scan', category: 'Radiology', status: 'suggested', suggestedAt: '10m ago', result: 'FAST ultrasound negative, CT pending post stabilization', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-305', name: 'Emergency Orthopedic OR Clearance', category: 'Surgical', status: 'suggested', suggestedAt: '8m ago', result: 'Call sent to Orthopedic Registrar on duty', doctorName: 'Dr. Rajeshwar Sharma' }
        ],
        reports: [
          { id: 'R-301', title: 'Orthopedic Digital Radiograph - Left Lower Extremity', department: 'Radiology', date: 'Today', findings: 'Comminuted displaced fracture of middle third of tibial diaphysis with 3cm bone spike piercing anterior skin. Accompanying oblique fracture of proximal fibular shaft. No knee joint dislocation.', normalRange: 'Intact skeletal architecture', conclusion: 'Gustilo-Anderson Grade II Open Tibia-Fibula Fracture', status: 'Final Verified' }
        ],
        prescriptions: [
          { id: 'P-301', medicine: 'Inj Tetanus Toxoid', dosage: '0.5 mL', route: 'Intramuscular', frequency: 'STAT', instructions: 'Wound contamination prophylaxis', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-302', medicine: 'Inj Ceftriaxone', dosage: '1 g', route: 'IV in 100ml NS', frequency: 'BD x 5 days', instructions: 'Infuse over 20 minutes', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-303', medicine: 'Inj Amikacin', dosage: '500 mg', route: 'IV Push in NS', frequency: 'OD', instructions: 'Gram negative coverage for open fracture', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-304', medicine: 'Inj Tramadol + Paracetamol', dosage: '50mg/1000mg', route: 'IV Infusion', frequency: 'TDS SOS', instructions: 'For acute post-traumatic pain', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' }
        ],
        doctor_notes: 'Open fracture debrided with 3 liters of warm normal saline in resuscitation bay. Distal dorsal pedis and posterior tibial pulses palpable (neurovascularly intact). Sterile dressing and posterior above-knee slab applied. OT booked for wound debridement and external fixator application.'
      }
    },
    {
      name: 'Kavita Sen',
      age: 74,
      gender: 'Female',
      complaint: 'Acute onset dyspnea, SpO2 87% on room air, exacerbation of COPD',
      severity: 3,
      arrivalOffset: 35,
      medical: {
        blood_group: 'AB+',
        blood_pressure: '142/88 mmHg',
        heart_rate: 104,
        spo2: 91,
        temperature: 99.1,
        respiratory_rate: 26,
        allergies: 'Penicillin (severe wheezing & rash)',
        past_history: 'Chronic Obstructive Pulmonary Disease (COPD Gold Stage III) x 10 yrs, Cor Pulmonale, Type 2 DM',
        tests: [
          { id: 'T-401', name: 'Arterial Blood Gas (ABG)', category: 'Biochemistry', status: 'done', suggestedAt: '30m ago', completedAt: '20m ago', result: 'pH 7.32, pCO2 56 mmHg, pO2 58 mmHg, HCO3 28 mEq/L (Type II Respiratory Failure)', doctorName: 'Dr. Priya Sundaram' },
          { id: 'T-402', name: 'Digital Chest X-Ray PA View', category: 'Radiology', status: 'done', suggestedAt: '28m ago', completedAt: '18m ago', result: 'Hyperinflated lung fields, flattened diaphragms, right lower zone haziness', doctorName: 'Dr. Priya Sundaram' },
          { id: 'T-403', name: 'Complete Blood Count & Inflammatory Markers', category: 'Hematology', status: 'done', suggestedAt: '25m ago', completedAt: '12m ago', result: 'TLC 14,200/uL with 82% neutrophils (Infective exacerbation), CRP 38 mg/L', doctorName: 'Dr. Priya Sundaram' },
          { id: 'T-404', name: 'Sputum for Gram Stain & Culture', category: 'Microbiology', status: 'suggested', suggestedAt: '15m ago', result: 'Sample collected, awaiting 48h microbiology report', doctorName: 'Dr. Priya Sundaram' }
        ],
        reports: [
          { id: 'R-401', title: 'Chest Radiograph Report', department: 'Radiology', date: 'Today', findings: 'Bilateral hyperlucent lung fields with tubular heart shape. Patchy consolidation in right middle and lower lung zones suggestive of bronchopneumonia trigger.', normalRange: 'Clear lung fields', conclusion: 'Infective Exacerbation of COPD with subsegmental right consolidation', status: 'Final Verified' }
        ],
        prescriptions: [
          { id: 'P-401', medicine: 'Nebulization Levosalbutamol + Ipratropium', dosage: '1.25mg / 500mcg', route: 'Nebulization with O2', frequency: 'Q4H', instructions: 'Administer with 4 L/min oxygen flow via Venturi mask', prescribedBy: 'Dr. Priya Sundaram', date: 'Today' },
          { id: 'P-402', medicine: 'Inj Hydrocortisone', dosage: '100 mg', route: 'IV Push', frequency: 'TDS', instructions: 'Systemic corticosteroid for bronchospasm control', prescribedBy: 'Dr. Priya Sundaram', date: 'Today' },
          { id: 'P-403', medicine: 'Inj Azithromycin', dosage: '500 mg', route: 'IV in 250ml D5W', frequency: 'OD', instructions: 'Atypical coverage for acute infective trigger', prescribedBy: 'Dr. Priya Sundaram', date: 'Today' },
          { id: 'P-404', medicine: 'Non-Invasive Ventilation (NIV / BiPAP)', dosage: 'IPAP 12 / EPAP 5', route: 'Face Mask', frequency: 'Continuous', instructions: 'Monitor for CO2 retention and repeat ABG in 2 hours', prescribedBy: 'Dr. Priya Sundaram', date: 'Today' }
        ],
        doctor_notes: 'Patient placed on Venturi mask (FiO2 28%) and initiated on BiPAP. SpO2 improved to 92%. Breath sounds reveal bilateral expiratory polyphonic rhonchi. Admitted to Respiratory HDU.'
      }
    },
    {
      name: 'Rohan Mukherjee',
      age: 19,
      gender: 'Male',
      complaint: 'Deep laceration on right forearm with active venous bleed from glass injury',
      severity: 3,
      arrivalOffset: 45,
      medical: {
        blood_group: 'B+',
        blood_pressure: '122/80 mmHg',
        heart_rate: 88,
        spo2: 99,
        temperature: 98.4,
        respiratory_rate: 18,
        allergies: 'No Known Drug Allergies (NKDA)',
        past_history: 'Nil medical history.',
        tests: [
          { id: 'T-501', name: 'Right Forearm Digital X-Ray (AP/Lat)', category: 'Radiology', status: 'done', suggestedAt: '40m ago', completedAt: '25m ago', result: 'No radiopaque glass foreign bodies identified, bony cortex intact', doctorName: 'Dr. Arjun Deshmukh' },
          { id: 'T-502', name: 'Coagulation Profile (PT/INR/aPTT)', category: 'Hematology', status: 'done', suggestedAt: '35m ago', completedAt: '15m ago', result: 'INR 1.02, aPTT 28.4 sec (Normal)', doctorName: 'Dr. Arjun Deshmukh' }
        ],
        reports: [
          { id: 'R-501', title: 'Plain Radiograph - Right Forearm Soft Tissue', department: 'Radiology', date: 'Today', findings: 'Soft tissue defect on volar aspect. No glass radio-densities or cortical fractures visible.', normalRange: 'Normal', conclusion: 'Soft tissue laceration without foreign body retention', status: 'Final Verified' }
        ],
        prescriptions: [
          { id: 'P-501', medicine: 'Inj Tetanus Toxoid', dosage: '0.5 mL', route: 'IM', frequency: 'STAT', instructions: 'Administer in left deltoid', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' },
          { id: 'P-502', medicine: 'Tab Augmentin (Amoxicillin + Clavulanate)', dosage: '625 mg', route: 'Oral', frequency: 'BD x 5 days', instructions: 'Take after meals', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' },
          { id: 'P-503', medicine: 'Tab Zerodol-P (Aceclofenac + Paracetamol)', dosage: '100mg/325mg', route: 'Oral', frequency: 'BD x 3 days', instructions: 'Pain relief after food', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' }
        ],
        doctor_notes: 'Laceration measures 6cm along right volar forearm. Flexor tendons and median/ulnar nerves tested intact. Primary wound closure performed under 2% Lignocaine local anesthesia with 3-0 Ethilon sutures. Suture removal advised in 10 days.'
      }
    },
    {
      name: 'Ananya Iyer',
      age: 31,
      gender: 'Female',
      complaint: 'Severe right lower quadrant abdominal pain, rebound tenderness, suspected appendicitis',
      severity: 3,
      arrivalOffset: 55,
      medical: {
        blood_group: 'O-',
        blood_pressure: '118/76 mmHg',
        heart_rate: 98,
        spo2: 99,
        temperature: 100.8,
        respiratory_rate: 20,
        allergies: 'Metronidazole (severe nausea and metallic taste)',
        past_history: 'Polycystic Ovarian Syndrome (PCOS).',
        tests: [
          { id: 'T-601', name: 'USG Whole Abdomen & Pelvis', category: 'Radiology', status: 'done', suggestedAt: '45m ago', completedAt: '20m ago', result: 'Non-compressible blind-ended tubular structure in RIF measuring 8.4mm in caliber with surrounding fat stranding (Acute Appendicitis)', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-602', name: 'Complete Blood Count (CBC) & CRP', category: 'Hematology', status: 'done', suggestedAt: '48m ago', completedAt: '25m ago', result: 'TLC 15,600/uL with 88% neutrophils, CRP 42 mg/L', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-603', name: 'Serum Beta-hCG (Urine/Blood)', category: 'Biochemistry', status: 'done', suggestedAt: '50m ago', completedAt: '35m ago', result: 'Negative (< 2 mIU/mL - Ectopic pregnancy ruled out)', doctorName: 'Dr. Rajeshwar Sharma' },
          { id: 'T-604', name: 'Emergency Laparoscopic Appendectomy Evaluation', category: 'Surgical', status: 'suggested', suggestedAt: '15m ago', result: 'General Surgery team consultation initiated', doctorName: 'Dr. Rajeshwar Sharma' }
        ],
        reports: [
          { id: 'R-601', title: 'High-Resolution Abdominal Ultrasound Report', department: 'Ultrasound', date: 'Today', findings: 'Aperistaltic, non-compressible appendix identified at McBurney\'s point, outer diameter 8.4 mm (>6 mm is diagnostic). Minimal free fluid in the right iliac fossa. Both ovaries appear normal with no adnexal mass.', normalRange: 'Appendix diameter < 6 mm', conclusion: 'Sonographic findings definitive for Acute Appendicitis', status: 'Final Verified' }
        ],
        prescriptions: [
          { id: 'P-601', medicine: 'Inj Cefoperazone + Sulbactam (Magnex)', dosage: '1.5 g', route: 'IV in 100ml NS', frequency: 'BD', instructions: 'Pre-operative antibiotic coverage', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-602', medicine: 'Inj Ondansetron', dosage: '4 mg', route: 'IV Slow', frequency: 'TDS SOS', instructions: 'For anti-emetic control', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-603', medicine: 'Inj Paracetamol', dosage: '1 g / 100ml', route: 'IV Infusion', frequency: 'TDS', instructions: 'Antipyretic and visceral pain relief', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' },
          { id: 'P-604', medicine: 'NPO (Nil by Mouth)', dosage: 'Strict', route: 'Enteral', frequency: 'Continuous', instructions: 'Keep nil per oral in preparation for emergency surgery', prescribedBy: 'Dr. Rajeshwar Sharma', date: 'Today' }
        ],
        doctor_notes: 'Positive McBurney\'s sign, Rovsing\'s sign positive, Alvarado score 8/10. Ultrasound confirmed acute inflamed appendix. Patient kept NPO; surgical consent in progress.'
      }
    },
    {
      name: 'Deepak Verma',
      age: 53,
      gender: 'Male',
      complaint: 'Suspected closed Colles wrist fracture after slip and fall on wet tiles',
      severity: 4,
      arrivalOffset: 70,
      medical: {
        blood_group: 'B+',
        blood_pressure: '136/84 mmHg',
        heart_rate: 80,
        spo2: 98,
        temperature: 98.4,
        respiratory_rate: 16,
        allergies: 'No Known Drug Allergies (NKDA)',
        past_history: 'Mild Osteopenia diagnosed in 2023 on Calcium supplements.',
        tests: [
          { id: 'T-701', name: 'Digital Radiograph Right Wrist & Hand (AP & Lateral)', category: 'Radiology', status: 'done', suggestedAt: '60m ago', completedAt: '40m ago', result: 'Extra-articular transverse fracture of distal radial metaphysis with dorsal angulation (Colles fracture)', doctorName: 'Dr. Arjun Deshmukh' },
          { id: 'T-702', name: 'Blood Glucose (RBS)', category: 'Biochemistry', status: 'done', suggestedAt: '50m ago', completedAt: '35m ago', result: '112 mg/dL (Normal)', doctorName: 'Dr. Arjun Deshmukh' }
        ],
        reports: [
          { id: 'R-701', title: 'Right Wrist Radiographic Evaluation', department: 'Radiology', date: 'Today', findings: 'Transverse fracture line noted 2cm proximal to radiocarpal joint with 15-degree dorsal tilt. Ulnar styloid intact. No carpal bone dislocation.', normalRange: 'Intact cortex', conclusion: 'Closed Distal Radial Metaphyseal Fracture (Colles type)', status: 'Final Verified' }
        ],
        prescriptions: [
          { id: 'P-701', medicine: 'Tab Combiflam (Ibuprofen + Paracetamol)', dosage: '400mg/325mg', route: 'Oral', frequency: 'BD x 5 days', instructions: 'Take after meals', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' },
          { id: 'P-702', medicine: 'Tab Pantoprazole', dosage: '40 mg', route: 'Oral', frequency: 'OD before breakfast', instructions: 'Gastric protection', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' },
          { id: 'P-703', medicine: 'Sling & Plaster of Paris Cast', dosage: 'Below Elbow POP', route: 'External', frequency: 'Continuous x 4 wks', instructions: 'Keep elevated, avoid wetting plaster', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' }
        ],
        doctor_notes: 'Closed hematoma block with 1% lignocaine performed. Traction and gentle manipulation applied with wrist immobilized in slight flexion and ulnar deviation. Post-reduction check film confirms anatomic alignment.'
      }
    },
    {
      name: 'Pooja Kulkarni',
      age: 23,
      gender: 'Female',
      complaint: 'Severe unilateral pulsating migraine with intense photophobia and nausea',
      severity: 4,
      arrivalOffset: 85,
      medical: {
        blood_group: 'A+',
        blood_pressure: '110/70 mmHg',
        heart_rate: 76,
        spo2: 100,
        temperature: 98.2,
        respiratory_rate: 16,
        allergies: 'Aspirin (triggers gastric acidity & bronchospasm)',
        past_history: 'Episodic Migraine without aura since age 17.',
        tests: [
          { id: 'T-801', name: 'Fundus Examination (Direct Ophthalmoscopy)', category: 'Ophthalmology', status: 'done', suggestedAt: '70m ago', completedAt: '50m ago', result: 'Normal optic disc margins, no papilledema observed', doctorName: 'Dr. Arjun Deshmukh' },
          { id: 'T-802', name: 'NCCT Brain (Non-Contrast)', category: 'Radiology', status: 'suggested', suggestedAt: '40m ago', result: 'Deferred as neurological exam is strictly normal', doctorName: 'Dr. Arjun Deshmukh' }
        ],
        reports: [
          { id: 'R-801', title: 'Neurological Bedside Assessment Report', department: 'Emergency Medicine', date: 'Today', findings: 'Pupils equal, round and reactive to light. Cranial nerves II-XII grossly intact. Meningeal signs (Kernig/Brudzinski) absent. Plantars flexor.', normalRange: 'Normal', conclusion: 'Acute Migraine Exacerbation with autonomic symptoms', status: 'Final Verified' }
        ],
        prescriptions: [
          { id: 'P-801', medicine: 'Inj Sumatriptan', dosage: '6 mg', route: 'Subcutaneous', frequency: 'STAT', instructions: 'Acute triptan rescue dose', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' },
          { id: 'P-802', medicine: 'Inj Metoclopramide', dosage: '10 mg', route: 'IV slow push', frequency: 'STAT', instructions: 'Promote gastric motility and relieve nausea', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' },
          { id: 'P-803', medicine: 'Tab Naproxen', dosage: '500 mg', route: 'Oral', frequency: 'BD PRN', instructions: 'Take with food for residual throbbing headache', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' }
        ],
        doctor_notes: 'Patient resting in dark, quiet triage observation room. Pain severity reduced from 9/10 to 3/10 forty minutes post sumatriptan injection.'
      }
    },
    {
      name: 'Amitabh Banerjee',
      age: 38,
      gender: 'Male',
      complaint: 'High fever (102°F), persistent dry cough, throat congestion, body ache',
      severity: 5,
      arrivalOffset: 110,
      medical: {
        blood_group: 'B+',
        blood_pressure: '124/82 mmHg',
        heart_rate: 92,
        spo2: 97,
        temperature: 102.2,
        respiratory_rate: 18,
        allergies: 'No Known Drug Allergies (NKDA)',
        past_history: 'Nil significant.',
        tests: [
          { id: 'T-901', name: 'Rapid Antigen Test (Influenza A/B & COVID-19)', category: 'Virology', status: 'done', suggestedAt: '90m ago', completedAt: '70m ago', result: 'Influenza A Positive (H1N1 seasonal strain), COVID-19 Negative', doctorName: 'Dr. Priya Sundaram' },
          { id: 'T-902', name: 'Complete Blood Count (CBC) with Peripheral Smear', category: 'Hematology', status: 'done', suggestedAt: '85m ago', completedAt: '60m ago', result: 'TLC 5,800/uL, Platelets 1.9 lakhs/uL, Malarial parasites negative', doctorName: 'Dr. Priya Sundaram' },
          { id: 'T-903', name: 'Dengue NS1 Antigen & IgM/IgG', category: 'Serology', status: 'done', suggestedAt: '80m ago', completedAt: '50m ago', result: 'Negative', doctorName: 'Dr. Priya Sundaram' }
        ],
        reports: [
          { id: 'R-901', title: 'Viral Respiratory Pathogen Rapid Panel', department: 'Microbiology', date: 'Today', findings: 'Positive for Influenza A viral antigens. Negative for RSV and SARS-CoV-2.', normalRange: 'Negative', conclusion: 'Viral Upper Respiratory Tract Infection (Influenza A)', status: 'Final Verified' }
        ],
        prescriptions: [
          { id: 'P-901', medicine: 'Cap Oseltamivir (Antiflu)', dosage: '75 mg', route: 'Oral', frequency: 'BD x 5 days', instructions: 'Take with food to prevent gastric upset', prescribedBy: 'Dr. Priya Sundaram', date: 'Today' },
          { id: 'P-902', medicine: 'Tab Dolo 650 (Paracetamol)', dosage: '650 mg', route: 'Oral', frequency: 'Q6H PRN', instructions: 'For fever > 100°F and generalized body ache', prescribedBy: 'Dr. Priya Sundaram', date: 'Today' },
          { id: 'P-903', medicine: 'Syp Ascoril-D (Dextromethorphan + Chlorpheniramine)', dosage: '10 mL', route: 'Oral', frequency: 'TDS x 5 days', instructions: 'Dry cough suppressant', prescribedBy: 'Dr. Priya Sundaram', date: 'Today' },
          { id: 'P-904', medicine: 'Steam Inhalation & Oral Hydration', dosage: 'Adequate', route: 'Inhalational', frequency: 'TDS', instructions: 'Drink at least 2.5 liters of warm fluids daily', prescribedBy: 'Dr. Priya Sundaram', date: 'Today' }
        ],
        doctor_notes: 'Seasonal Influenza A confirmed. No lower respiratory involvement or signs of pneumonia. Advised home isolation for 5 days with mask etiquette and symptom monitoring.'
      }
    },
    {
      name: 'Meenakshi Rao',
      age: 61,
      gender: 'Female',
      complaint: 'Prescription refill needed for chronic hypertension medication, clinically stable',
      severity: 5,
      arrivalOffset: 130,
      medical: {
        blood_group: 'O+',
        blood_pressure: '128/82 mmHg',
        heart_rate: 74,
        spo2: 99,
        temperature: 98.4,
        respiratory_rate: 15,
        allergies: 'No Known Drug Allergies (NKDA)',
        past_history: 'Essential Hypertension x 8 years, Primary Hypothyroidism x 5 years on Levothyroxine 50 mcg.',
        tests: [
          { id: 'T-1001', name: 'Digital Blood Pressure Re-check & Vitals', category: 'Nursing', status: 'done', suggestedAt: '120m ago', completedAt: '110m ago', result: 'BP 128/82 mmHg sitting, Pulse 74 regular', doctorName: 'Dr. Arjun Deshmukh' },
          { id: 'T-1002', name: 'Serum Creatinine & Electrolytes (Routine)', category: 'Biochemistry', status: 'done', suggestedAt: '100m ago', completedAt: '60m ago', result: 'Creatinine 0.8 mg/dL, Potassium 4.4 mEq/L (Normal kidney function)', doctorName: 'Dr. Arjun Deshmukh' },
          { id: 'T-1003', name: 'Serum TSH (Thyroid Stimulating Hormone)', category: 'Biochemistry', status: 'suggested', suggestedAt: '50m ago', result: 'Scheduled during next morning OPD visit', doctorName: 'Dr. Arjun Deshmukh' }
        ],
        reports: [
          { id: 'R-1001', title: 'Comprehensive Metabolic Panel (Routine Outpatient Review)', department: 'Clinical Chemistry', date: 'Today', findings: 'Fasting glucose 98 mg/dL, Urea 22 mg/dL, eGFR > 90 mL/min/1.73m2. Liver enzymes within normal limits.', normalRange: 'Normal', conclusion: 'Stable organ function under current antihypertensive regimen', status: 'Final Verified' }
        ],
        prescriptions: [
          { id: 'P-1001', medicine: 'Tab Telmisartan + Amlodipine (Telma-AM)', dosage: '40mg / 5mg', route: 'Oral', frequency: 'OD morning', instructions: 'Take daily after breakfast (30-day supply dispensed)', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' },
          { id: 'P-1002', medicine: 'Tab Thyronorm (Levothyroxine)', dosage: '50 mcg', route: 'Oral', frequency: 'OD empty stomach', instructions: 'Take 45 minutes before tea/coffee in morning', prescribedBy: 'Dr. Arjun Deshmukh', date: 'Today' }
        ],
        doctor_notes: 'Asymptomatic patient presented for monthly refill of regular medications. Blood pressure is well controlled. 30-day medication prescription renewed with advice for routine 6-monthly follow-up in Medical OPD.'
      }
    }
  ];

  for (const p of samples) {
    const arrivalTime = now - p.arrivalOffset * 60 * 1000;
    const info = insertPatient.run(
      p.name,
      p.age,
      p.gender,
      p.complaint,
      p.severity,
      arrivalTime,
      'waiting',
      null,
      null,
      null,
      null,
      null
    );

    const newPatientId = Number(info.lastInsertRowid);
    insertMedicalRecord.run(
      newPatientId,
      p.medical.blood_group,
      p.medical.blood_pressure,
      p.medical.heart_rate,
      p.medical.spo2,
      p.medical.temperature,
      p.medical.respiratory_rate,
      p.medical.allergies,
      p.medical.past_history,
      JSON.stringify(p.medical.tests),
      JSON.stringify(p.medical.reports),
      JSON.stringify(p.medical.prescriptions),
      p.medical.doctor_notes
    );
  }
}


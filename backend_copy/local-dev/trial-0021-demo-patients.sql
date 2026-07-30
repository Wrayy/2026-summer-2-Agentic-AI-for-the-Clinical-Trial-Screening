-- Trial 0021 demo patient reset for the Clinical Trial Matching POC.
-- This is synthetic demo data only. It deletes local patient rows and saved
-- match results, then inserts 20 patients tailored to trial_id 21.

USE clinical_trial_matching_poc;

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM clinical_trial_match_results;
DELETE FROM clinicaltrials_patients;
DELETE FROM patient_doctor;
DELETE FROM patients_pathology;
DELETE FROM patients_registration;

ALTER TABLE patients_registration AUTO_INCREMENT = 21;
ALTER TABLE patients_pathology AUTO_INCREMENT = 21;
ALTER TABLE patient_doctor AUTO_INCREMENT = 21;
ALTER TABLE clinicaltrials_patients AUTO_INCREMENT = 1;
ALTER TABLE clinical_trial_match_results AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO patients_registration
  (id, FName, MName, LName, Age, Gender, height, weight, BloodGroup, MobileNumber, EmailId, Address, Location, City, Province, Country, PostalCode, HCardNumber, date_of_birth)
VALUES
  (1, 'Emily', NULL, 'Hart', 52, 'Female', 166, 78, 'A+', '613-555-2101', 'emily.hart@example.test', '100 Trial Ave', 'Centretown', 'Ottawa', 'Ontario', 'Canada', 'K1P2A1', 'HC-DEMO-021-001', '1974-04-11'),
  (2, 'Marcus', NULL, 'Reed', 61, 'Male', 178, 94, 'O+', '613-555-2102', 'marcus.reed@example.test', '101 Trial Ave', 'Old Ottawa East', 'Ottawa', 'Ontario', 'Canada', 'K1S2B2', 'HC-DEMO-021-002', '1965-08-02'),
  (3, 'Priya', NULL, 'Shah', 45, 'Female', 162, 69, 'B+', '613-555-2103', 'priya.shah@example.test', '102 Trial Ave', 'Nepean', 'Ottawa', 'Ontario', 'Canada', 'K2G3C3', 'HC-DEMO-021-003', '1981-01-20'),
  (4, 'Noah', NULL, 'Brooks', 70, 'Male', 172, 98, 'AB+', '613-555-2104', 'noah.brooks@example.test', '103 Trial Ave', 'Orleans', 'Ottawa', 'Ontario', 'Canada', 'K1E4D4', 'HC-DEMO-021-004', '1956-06-15'),
  (5, 'Sara', NULL, 'Kim', 39, 'Female', 168, 76, 'A-', '613-555-2105', 'sara.kim@example.test', '104 Trial Ave', 'Sandy Hill', 'Ottawa', 'Ontario', 'Canada', 'K1N5E5', 'HC-DEMO-021-005', '1987-11-09'),
  (6, 'David', NULL, 'Nguyen', 58, 'Male', 181, 102, 'O-', '613-555-2106', 'david.nguyen@example.test', '105 Trial Ave', 'Barrhaven', 'Ottawa', 'Ontario', 'Canada', 'K2J6F6', 'HC-DEMO-021-006', '1968-02-26'),
  (7, 'Grace', NULL, 'Allen', 66, 'Female', 160, 79, 'B-', '613-555-2107', 'grace.allen@example.test', '106 Trial Ave', 'Westboro', 'Ottawa', 'Ontario', 'Canada', 'K1Z7G7', 'HC-DEMO-021-007', '1960-09-18'),
  (8, 'Omar', NULL, 'Hassan', 55, 'Male', 174, 88, 'A+', '613-555-2108', 'omar.hassan@example.test', '107 Trial Ave', 'Gloucester', 'Ottawa', 'Ontario', 'Canada', 'K1B8H8', 'HC-DEMO-021-008', '1971-12-05'),
  (9, 'Lina', NULL, 'Patel', 48, 'Female', 163, 74, 'O+', '613-555-2109', 'lina.patel@example.test', '108 Trial Ave', 'Vanier', 'Ottawa', 'Ontario', 'Canada', 'K1L9J9', 'HC-DEMO-021-009', '1978-03-30'),
  (10, 'Ethan', NULL, 'Park', 73, 'Male', 170, 86, 'AB-', '613-555-2110', 'ethan.park@example.test', '109 Trial Ave', 'Downtown', 'Ottawa', 'Ontario', 'Canada', 'K1R0K0', 'HC-DEMO-021-010', '1953-07-22'),
  (11, 'Chloe', NULL, 'Young', 33, 'Female', 165, 62, 'A+', '613-555-2111', 'chloe.young@example.test', '110 Trial Ave', 'Hintonburg', 'Ottawa', 'Ontario', 'Canada', 'K1Y1L1', 'HC-DEMO-021-011', '1993-10-14'),
  (12, 'Daniel', NULL, 'Price', 50, 'Male', 176, 91, 'O+', '613-555-2112', 'daniel.price@example.test', '111 Trial Ave', 'Old Ottawa South', 'Ottawa', 'Ontario', 'Canada', 'K1S3M2', 'HC-DEMO-021-012', '1976-01-07'),
  (13, 'Mia', NULL, 'Robertson', 29, 'Female', 158, 43, 'B+', '613-555-2113', 'mia.robertson@example.test', '112 Trial Ave', 'Centretown', 'Ottawa', 'Ontario', 'Canada', 'K1R4N3', 'HC-DEMO-021-013', '1997-05-19'),
  (14, 'Jack', NULL, 'Turner', 64, 'Male', 182, 138, 'A-', '613-555-2114', 'jack.turner@example.test', '113 Trial Ave', 'Nepean', 'Ottawa', 'Ontario', 'Canada', 'K2H5P4', 'HC-DEMO-021-014', '1962-12-03'),
  (15, 'Sophia', NULL, 'Wilson', 37, 'Female', 164, 70, 'O-', '613-555-2115', 'sophia.wilson@example.test', '114 Trial Ave', 'Vanier', 'Ottawa', 'Ontario', 'Canada', 'K1L6Q5', 'HC-DEMO-021-015', '1989-03-22'),
  (16, 'Isaac', NULL, 'Bennett', 80, 'Male', 171, 84, 'AB+', '613-555-2116', 'isaac.bennett@example.test', '115 Trial Ave', 'Kanata', 'Ottawa', 'Ontario', 'Canada', 'K2K8R6', 'HC-DEMO-021-016', '1946-09-01'),
  (17, 'Amelia', NULL, 'Scott', 42, 'Female', 169, 73, 'B-', '613-555-2117', 'amelia.scott@example.test', '116 Trial Ave', 'Downtown', 'Ottawa', 'Ontario', 'Canada', 'K1P9S7', 'HC-DEMO-021-017', '1984-07-28'),
  (18, 'Henry', NULL, 'Clark', 57, 'Male', 177, 90, 'A+', '613-555-2118', 'henry.clark@example.test', '117 Trial Ave', 'Westboro', 'Ottawa', 'Ontario', 'Canada', 'K1Z2T8', 'HC-DEMO-021-018', '1969-04-06'),
  (19, 'Victoria', NULL, 'Moore', 35, 'Female', 167, 72, 'O+', '613-555-2119', 'victoria.moore@example.test', '118 Trial Ave', 'ByWard Market', 'Ottawa', 'Ontario', 'Canada', 'K1N3V9', 'HC-DEMO-021-019', '1991-08-15'),
  (20, 'William', NULL, 'Evans', 68, 'Male', 175, 96, 'A-', '613-555-2120', 'william.evans@example.test', '119 Trial Ave', 'Barrhaven', 'Ottawa', 'Ontario', 'Canada', 'K2J4W0', 'HC-DEMO-021-020', '1958-02-12');

INSERT INTO patient_doctor (patient_id, doctor_id, association_type) VALUES
  (1, 1, 'family_doctor'),
  (2, 1, 'specialist'),
  (3, 4, 'family_doctor'),
  (4, 1, 'family_doctor'),
  (5, 4, 'family_doctor'),
  (6, 1, 'specialist'),
  (7, 2, 'family_doctor'),
  (8, 1, 'family_doctor'),
  (9, 2, 'family_doctor'),
  (10, 1, 'specialist'),
  (11, 3, 'family_doctor'),
  (12, 2, 'specialist'),
  (13, 4, 'family_doctor'),
  (14, 4, 'family_doctor'),
  (15, 1, 'family_doctor'),
  (16, 1, 'specialist'),
  (17, 1, 'family_doctor'),
  (18, 4, 'family_doctor'),
  (19, 1, 'family_doctor'),
  (20, 2, 'specialist');

INSERT INTO patients_pathology
  (patient_id, pathology, prior_medication, surgeries, pregnancies, medical_history, other_notes)
VALUES
  (1, 'Hypertension, Uncontrolled hypertension, Cardiovascular Diseases', 'Amlodipine, Losartan, Hydrochlorothiazide', 'None', 2, 'Uncontrolled hypertension for 4 years. No heart failure, myocardial infarction, stroke, TIA, or diabetes history. eGFR 78, potassium 4.3 mmol/L, sodium 139 mmol/L.', 'Average seated BP 156/94 mmHg and 24-hour ABPM 142/86 mmHg. Taking 3 antihypertensive medications.'),
  (2, 'Resistant hypertension, Hypertension, Cardiovascular Diseases', 'Amlodipine, Valsartan, Chlorthalidone, Spironolactone', 'None', 0, 'Resistant hypertension with stable regimen. eGFR 71, potassium 4.6 mmol/L, sodium 138 mmol/L. No recent cardiovascular event or diabetes.', 'Office BP 164/96 mmHg and ABPM 150/88 mmHg. Taking 4 antihypertensive medications.'),
  (3, 'Hypertension, Blood pressure, Cardiovascular Diseases', 'Lisinopril, Amlodipine', 'Appendectomy in 2010', 1, 'Hypertension documented for 2 years. No diabetes, renal impairment, stroke, TIA, MI, or heart failure. eGFR 88.', 'Office BP 148/90 mmHg and ABPM 136/82 mmHg. Taking 2 antihypertensive medications.'),
  (4, 'Uncontrolled hypertension, Hypertension', 'Olmesartan, Amlodipine, Indapamide', 'Hip replacement in 2016', 0, 'Longstanding hypertension. No heart failure, myocardial infarction, stroke, or TIA documented. eGFR 65, potassium 4.1 mmol/L, sodium 137 mmol/L.', 'Office BP 158/92 mmHg. Taking 3 antihypertensive medications.'),
  (5, 'Hypertension', 'Amlodipine', 'None', 0, 'Hypertension present but medication regimen is not yet standardized. No diabetes or major cardiovascular history.', 'Office BP 150/88 mmHg. Only 1 antihypertensive medication documented.'),
  (6, 'Resistant hypertension, Hypertension', 'Amlodipine, Losartan, Hydrochlorothiazide, Spironolactone, Carvedilol, Clonidine', 'None', 0, 'Resistant hypertension with broad medication burden. No recent MI or stroke. eGFR 70.', 'Office BP 166/98 mmHg. Taking 6 antihypertensive medications.'),
  (7, 'Hypertension, Renal Disease', 'Amlodipine, Losartan, Chlorthalidone', 'None', 0, 'Hypertension with eGFR 44 mL/min/1.73 m2 at screening. Potassium 4.7 mmol/L and sodium 136 mmol/L.', 'Blood pressure remains elevated on current therapy. Renal function is reduced.'),
  (8, 'Hypertension', 'Amlodipine, Valsartan, Hydrochlorothiazide', 'None', 0, 'Hypertension with potassium 5.3 mmol/L at screening. eGFR 80 and sodium 138 mmol/L.', 'Blood pressure remains elevated on current therapy. Hyperkalemia is documented.'),
  (9, 'Hypertension', 'Lisinopril, Amlodipine, Chlorthalidone', 'None', 2, 'Hypertension with serum sodium 132 mmol/L. eGFR 77, potassium 4.4 mmol/L.', 'Blood pressure remains elevated on current therapy. Hyponatremia is documented.'),
  (10, 'Hypertension, Cardiovascular Diseases', 'Amlodipine, Losartan, Hydrochlorothiazide', 'Coronary stent in 2023', 0, 'Myocardial infarction 3 months before screening. Hypertension remains present with elevated BP and multidrug treatment.', 'Recent myocardial infarction and coronary stent placement are documented.'),
  (11, 'Asthma, Respiratory Diseases', 'Albuterol inhaler', 'None', 0, 'No hypertension diagnosis. Mild asthma only.', 'No elevated blood pressure pattern documented.'),
  (12, 'Type 2 Diabetes, Diabetes mellitus, Endocrine Diseases', 'Metformin, Lisinopril', 'None', 0, 'Diabetes mellitus with HbA1c 8.2 percent. Mild hypertension noted but not uncontrolled or resistant.', 'Diabetes mellitus is documented.'),
  (13, 'Hypertension', 'Amlodipine, Losartan', 'None', 0, 'Hypertension with otherwise clean safety history.', 'No recent cardiovascular event, diabetes, or renal impairment documented.'),
  (14, 'Hypertension, Obesity', 'Amlodipine, Valsartan, Chlorthalidone', 'None', 0, 'Hypertension with no diabetes or recent cardiovascular event.', 'Obesity is documented. No recent cardiovascular event is documented.'),
  (15, 'Hypertension, Uncontrolled hypertension', 'Amlodipine, TEST MEDICATION, Hydrochlorothiazide', 'None', 0, 'Hypertension with elevated BP and multidrug treatment.', 'Medication history is documented in the current medications list.'),
  (16, 'Hypertension, Heart failure, Cardiovascular Diseases', 'Amlodipine, Losartan, Torsemide', 'None', 0, 'Chronic heart failure with reduced ejection fraction. eGFR 63.', 'Heart failure is documented.'),
  (17, 'Hypertension, Stroke, Cardiovascular Diseases', 'Amlodipine, Losartan, Chlorthalidone', 'None', 1, 'Ischemic stroke 4 months before screening. BP remains uncontrolled.', 'Recent ischemic stroke is documented.'),
  (18, 'Hypertension, Hypertensive', 'Amlodipine, Losartan, Hydrochlorothiazide', 'Bariatric surgery 2 months ago', 0, 'Hypertension with adequate BP range and labs. No diabetes or recent MI/stroke.', 'Recent bariatric surgery is documented.'),
  (19, 'Hypertension', 'Amlodipine, Lisinopril', 'None', 1, 'Hypertension with limited lab documentation. No known diabetes or cardiovascular event.', 'BP 145/88 mmHg. ABPM, eGFR, potassium, and sodium details are not documented.'),
  (20, 'Hypertension, Renal Disease, Diabetes mellitus', 'Amlodipine, Losartan, Insulin glargine', 'None', 0, 'Hypertension with diabetes mellitus, eGFR 38, and HbA1c 9.4 percent.', 'Diabetes mellitus, reduced renal function, poor glycemic control, and incomplete BP monitoring are documented.');

INSERT INTO pathology_classifications (Pathology, Classification) VALUES
  ('Blood pressure', 'Cardiovascular Diseases'),
  ('Hypertensive', 'Cardiovascular Diseases'),
  ('Resistant hypertension', 'Cardiovascular Diseases'),
  ('Uncontrolled hypertension', 'Cardiovascular Diseases'),
  ('Heart failure', 'Cardiovascular Diseases'),
  ('Myocardial infarction', 'Cardiovascular Diseases'),
  ('Stroke', 'Cardiovascular Diseases'),
  ('Transient ischemic attack', 'Cardiovascular Diseases'),
  ('Diabetes mellitus', 'Endocrine Diseases'),
  ('Type 2 Diabetes', 'Endocrine Diseases'),
  ('Renal Disease', 'Renal Disease');

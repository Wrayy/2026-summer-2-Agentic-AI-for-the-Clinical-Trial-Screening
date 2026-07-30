-- Synthetic local development data for the Clinical Trial Matching POC.
-- No row in this file represents a real patient, clinician, or company.
-- NCT-inspired trial rows are synthetic POC fixtures, not authoritative records.
-- The NCT-inspired trials use numeric trial_id values because the copied
-- backend schema stores clinical_trials.trial_id as INT.

USE clinical_trial_matching_poc;

INSERT INTO pharmaceutical_company (id, name, email, password) VALUES
  (1, 'Standalone Pharma', 'pharm1@test.com', 'pharm1'),
  (2, 'Northstar Therapeutics', 'research@northstar.example', NULL);

INSERT INTO clinical_staff_registration (id, FName, MName, LName, EmailId) VALUES
  (1, 'Maya', NULL, 'Reed', 'maya.reed@ehospital.example'),
  (2, 'Leo', NULL, 'Chen', 'leo.chen@ehospital.example');

INSERT INTO doctors_registration
  (id, Fname, Mname, Lname, EmailId, MobileNumber, City, Province, Country, Specialization, PractincingHospital, Gender, Availability)
VALUES
  (1, 'Amara', NULL, 'Patel', 'amara.patel@clinic.example', '613-555-0101', 'Ottawa', 'Ontario', 'Canada', 'Cardiology', 'Ottawa General', 'Female', 'Weekdays'),
  (2, 'Noah', NULL, 'Tremblay', 'noah.tremblay@clinic.example', '613-555-0102', 'Ottawa', 'Ontario', 'Canada', 'Endocrinology', 'Civic Hospital', 'Male', 'Weekdays'),
  (3, 'Sofia', NULL, 'Nguyen', 'sofia.nguyen@clinic.example', '613-555-0103', 'Kanata', 'Ontario', 'Canada', 'Pulmonology', 'Queensway Carleton', 'Female', 'Mon/Wed/Fri'),
  (4, 'Ethan', NULL, 'Brooks', 'ethan.brooks@clinic.example', '613-555-0104', 'Gatineau', 'Quebec', 'Canada', 'Internal Medicine', 'Hull Regional', 'Male', 'Tue/Thu'),
  (5, 'Priya', NULL, 'Kapoor', 'priya.kapoor@clinic.example', '613-555-0105', 'Ottawa', 'Ontario', 'Canada', 'Rheumatology', 'Ottawa General', 'Female', 'Weekdays');

INSERT INTO patients_registration
  (id, FName, MName, LName, Age, Gender, height, weight, BloodGroup, MobileNumber, EmailId, Address, Location, City, Province, Country, PostalCode, HCardNumber, date_of_birth)
VALUES
  (1, 'Olivia', NULL, 'Martin', 58, 'Female', 165, 78, 'A+', '613-555-1001', 'olivia.martin@example.test', '100 Maple St', 'Centretown', 'Ottawa', 'Ontario', 'Canada', 'K1P1A1', 'HC-LOCAL-001', '1966-04-11'),
  (2, 'James', NULL, 'Wilson', 46, 'Male', 178, 92, 'O+', '613-555-1002', 'james.wilson@example.test', '45 River Rd', 'Old Ottawa East', 'Ottawa', 'Ontario', 'Canada', 'K1S2B2', 'HC-LOCAL-002', '1978-08-02'),
  (3, 'Ava', NULL, 'Singh', 34, 'Female', 160, 64, 'B+', '613-555-1003', 'ava.singh@example.test', '22 Pine Ave', 'Nepean', 'Ottawa', 'Ontario', 'Canada', 'K2G3C3', 'HC-LOCAL-003', '1990-01-20'),
  (4, 'Liam', NULL, 'Garcia', 67, 'Male', 172, 82, 'AB+', '613-555-1004', 'liam.garcia@example.test', '8 Cedar Cres', 'Orleans', 'Ottawa', 'Ontario', 'Canada', 'K1E4D4', 'HC-LOCAL-004', '1957-06-15'),
  (5, 'Emma', NULL, 'Brown', 52, 'Female', 170, 70, 'A-', '613-555-1005', 'emma.brown@example.test', '901 Elm Way', 'Sandy Hill', 'Ottawa', 'Ontario', 'Canada', 'K1N5E5', 'HC-LOCAL-005', '1972-11-09'),
  (6, 'Lucas', NULL, 'Ahmed', 41, 'Male', 181, 76, 'O-', '613-555-1006', 'lucas.ahmed@example.test', '77 Spruce Dr', 'Barrhaven', 'Ottawa', 'Ontario', 'Canada', 'K2J6F6', 'HC-LOCAL-006', '1983-02-26'),
  (7, 'Mia', NULL, 'Taylor', 29, 'Female', 168, 61, 'B-', '613-555-1007', 'mia.taylor@example.test', '13 Birch Lane', 'Westboro', 'Ottawa', 'Ontario', 'Canada', 'K1Z7G7', 'HC-LOCAL-007', '1995-09-18'),
  (8, 'Benjamin', NULL, 'Lee', 60, 'Male', 174, 96, 'A+', '613-555-1008', 'benjamin.lee@example.test', '204 Oak Blvd', 'Gloucester', 'Ottawa', 'Ontario', 'Canada', 'K1B8H8', 'HC-LOCAL-008', '1964-12-05'),
  (9, 'Charlotte', NULL, 'Clark', 49, 'Female', 162, 88, 'O+', '613-555-1009', 'charlotte.clark@example.test', '66 Ash St', 'Vanier', 'Ottawa', 'Ontario', 'Canada', 'K1L9J9', 'HC-LOCAL-009', '1975-03-30'),
  (10, 'Henry', NULL, 'Moore', 72, 'Male', 169, 74, 'AB-', '613-555-1010', 'henry.moore@example.test', '5 Willow Ct', 'Downtown', 'Ottawa', 'Ontario', 'Canada', 'K1R0K0', 'HC-LOCAL-010', '1952-07-22'),
  (11, 'Nora', NULL, 'Bennett', 55, 'Female', 166, 91, 'A+', '613-555-1011', 'nora.bennett@example.test', '18 Laurel St', 'Hintonburg', 'Ottawa', 'Ontario', 'Canada', 'K1Y1L1', 'HC-LOCAL-011', '1969-10-14'),
  (12, 'Mateo', NULL, 'Rivera', 63, 'Male', 175, 105, 'O+', '613-555-1012', 'mateo.rivera@example.test', '9 Canal Rd', 'Old Ottawa South', 'Ottawa', 'Ontario', 'Canada', 'K1S3M2', 'HC-LOCAL-012', '1961-01-07'),
  (13, 'Grace', NULL, 'Campbell', 38, 'Female', 158, 73, 'B+', '613-555-1013', 'grace.campbell@example.test', '400 Queen St', 'Centretown', 'Ottawa', 'Ontario', 'Canada', 'K1R4N3', 'HC-LOCAL-013', '1986-05-19'),
  (14, 'Owen', NULL, 'Scott', 44, 'Male', 182, 86, 'A-', '613-555-1014', 'owen.scott@example.test', '72 Greenbank Rd', 'Nepean', 'Ottawa', 'Ontario', 'Canada', 'K2H5P4', 'HC-LOCAL-014', '1980-12-03'),
  (15, 'Sofia', NULL, 'Morgan', 31, 'Female', 164, 67, 'O-', '613-555-1015', 'sofia.morgan@example.test', '15 Clinic Ave', 'Vanier', 'Ottawa', 'Ontario', 'Canada', 'K1L6Q5', 'HC-LOCAL-015', '1993-03-22'),
  (16, 'Evelyn', NULL, 'Young', 70, 'Female', 160, 82, 'AB+', '613-555-1016', 'evelyn.young@example.test', '51 Garden Way', 'Kanata', 'Ottawa', 'Ontario', 'Canada', 'K2K8R6', 'HC-LOCAL-016', '1954-09-01'),
  (17, 'Daniel', NULL, 'Wright', 57, 'Male', 170, 68, 'B-', '613-555-1017', 'daniel.wright@example.test', '29 Albert St', 'Downtown', 'Ottawa', 'Ontario', 'Canada', 'K1P9S7', 'HC-LOCAL-017', '1967-07-28'),
  (18, 'Lila', NULL, 'Chen', 48, 'Female', 169, 79, 'A+', '613-555-1018', 'lila.chen@example.test', '11 Elmwood Ave', 'Westboro', 'Ottawa', 'Ontario', 'Canada', 'K1Z2T8', 'HC-LOCAL-018', '1976-04-06'),
  (19, 'Samuel', NULL, 'King', 65, 'Male', 177, 110, 'O+', '613-555-1019', 'samuel.king@example.test', '92 Market Lane', 'ByWard Market', 'Ottawa', 'Ontario', 'Canada', 'K1N3V9', 'HC-LOCAL-019', '1959-08-15'),
  (20, 'Hannah', NULL, 'Evans', 27, 'Female', 163, 59, 'A-', '613-555-1020', 'hannah.evans@example.test', '7 Riverstone Dr', 'Barrhaven', 'Ottawa', 'Ontario', 'Canada', 'K2J4W0', 'HC-LOCAL-020', '1997-02-12');

INSERT INTO patient_doctor (patient_id, doctor_id, association_type) VALUES
  (1, 1, 'family_doctor'),
  (2, 2, 'family_doctor'),
  (3, 3, 'specialist'),
  (4, 1, 'family_doctor'),
  (5, 2, 'specialist'),
  (6, 4, 'family_doctor'),
  (7, 3, 'family_doctor'),
  (8, 1, 'specialist'),
  (9, 2, 'family_doctor'),
  (10, 4, 'family_doctor'),
  (11, 2, 'family_doctor'),
  (12, 2, 'specialist'),
  (13, 5, 'specialist'),
  (14, 1, 'family_doctor'),
  (15, 5, 'family_doctor'),
  (16, 1, 'family_doctor'),
  (17, 4, 'family_doctor'),
  (18, 5, 'specialist'),
  (19, 2, 'family_doctor'),
  (20, 5, 'specialist');

INSERT INTO patients_pathology
  (patient_id, pathology, prior_medication, surgeries, pregnancies, medical_history, other_notes)
VALUES
  (1, 'Hypertension, Cardiovascular Diseases', 'Amlodipine, Atorvastatin', 'Appendectomy in 2001', 2, 'Stable blood pressure with medication adherence.', 'Recent labs within expected range.'),
  (2, 'Type 2 Diabetes, Endocrine Diseases', 'Metformin', 'None', 0, 'Type 2 diabetes diagnosed in 2019. HbA1c 7.6 percent at last visit.', 'Metformin dose stable for more than 6 months.'),
  (3, 'Asthma, Respiratory Diseases', 'Albuterol', 'None', 0, 'Mild persistent asthma with seasonal flares.', 'No hospitalization in past year.'),
  (4, 'Hypertension, Cardiovascular Diseases', 'Lisinopril, Warfarin', 'Coronary bypass surgery in 2019', 0, 'History of coronary artery disease.', 'Requires anticoagulation monitoring.'),
  (5, 'Type 2 Diabetes, Endocrine Diseases', 'Metformin, Semaglutide', 'Gallbladder surgery in 2018', 1, 'Type 2 diabetes with improving glucose trend. HbA1c 7.2 percent.', 'Prior semaglutide exposure is documented.'),
  (6, 'Asthma, Respiratory Diseases', 'Inhaled corticosteroid', 'Knee arthroscopy in 2020', 0, 'Exercise-induced symptoms controlled.', 'Non-smoker.'),
  (7, 'Asthma', 'Albuterol', 'None', 0, 'Mild intermittent symptoms.', 'Currently pregnant: no.'),
  (8, 'Hypertension, Renal Disease', 'Amlodipine, Furosemide', 'Recent abdominal surgery', 0, 'Stage 2 chronic kidney disease.', 'Abdominal surgery was 6 weeks ago.'),
  (9, 'Type 2 Diabetes, Cardiovascular Diseases', 'Metformin, Aspirin', 'None', 3, 'Type 2 diabetes with hypertension history. HbA1c 8.4 percent.', 'Metformin stable; no insulin. Historical pregnancies are recorded.'),
  (10, 'Hypertension, Cardiovascular Diseases', 'Atorvastatin', 'Hip replacement surgery in 2017', 0, 'Stable post-surgical history.', 'Retired, strong family support.'),
  (11, 'Type 2 Diabetes, Obesity, Endocrine Diseases', 'Metformin, Empagliflozin', 'None', 0, 'Type 2 diabetes diagnosed in 2020. HbA1c 8.1 percent.', 'SGLT2 treatment stable for 16 weeks. No insulin or GLP-1 receptor agonist use documented.'),
  (12, 'Type 2 Diabetes, Obesity, Endocrine Diseases', 'Metformin, Dapagliflozin', 'Appendectomy in 2005', 0, 'Type 2 diabetes diagnosed in 2018. HbA1c 9.4 percent.', 'Metformin and SGLT2 treatment stable for 5 months. No recent surgery.'),
  (13, 'Rheumatoid Arthritis, Immunological Diseases', 'NSAID as needed', 'None', 0, 'Early rheumatoid arthritis diagnosed within the past 5 months. RF positive and anti-CCP positive. CRP elevated.', 'No prior DMARD therapy documented. Swollen joint count 8 and tender joint count 11.'),
  (14, 'Hypertension, Cardiovascular Diseases', 'Amlodipine, Lisinopril, Hydrochlorothiazide', 'None', 0, 'Uncontrolled hypertension despite three antihypertensive medications.', 'Average seated blood pressure around 152/94 mmHg on recent home log.'),
  (15, 'Rheumatoid Arthritis, Immunological Diseases', 'NSAID as needed', 'None', 0, 'Early inflammatory arthritis with rheumatoid arthritis diagnosis. CRP elevated and RF positive.', 'No prior DMARD therapy documented. Swollen joint count 6 and tender joint count 9.'),
  (16, 'Hypertension, Cardiovascular Diseases', 'Amlodipine, Losartan, Chlorthalidone, Spironolactone', 'None', 0, 'Resistant hypertension on four antihypertensive medications.', 'Average seated blood pressure around 160/98 mmHg.'),
  (17, 'Hypertension, Cardiovascular Diseases', 'Lifestyle management only', 'None', 0, 'Mild hypertension noted intermittently.', 'Currently on fewer than two antihypertensive medications.'),
  (18, 'Rheumatoid Arthritis, Immunological Diseases', 'Methotrexate', 'None', 0, 'Established rheumatoid arthritis diagnosed in 2021. CRP mildly elevated.', 'Already taking methotrexate for more than 1 year.'),
  (19, 'Type 2 Diabetes, Obesity, Endocrine Diseases, Renal Disease', 'Metformin, Insulin glargine', 'None', 0, 'Type 2 diabetes with HbA1c 10.8 percent and stage 3 chronic kidney disease.', 'Insulin use is documented.'),
  (20, 'Rheumatoid Arthritis, Immunological Diseases', 'Hydroxychloroquine', 'None', 0, 'Rheumatoid arthritis symptoms controlled on prior DMARD therapy.', 'Hydroxychloroquine treatment history is documented.');

INSERT INTO pathology_classifications (Pathology, Classification) VALUES
  ('Hypertension', 'Cardiovascular Diseases'),
  ('Resistant hypertension', 'Cardiovascular Diseases'),
  ('Uncontrolled hypertension', 'Cardiovascular Diseases'),
  ('Coronary artery disease', 'Cardiovascular Diseases'),
  ('Type 2 Diabetes', 'Endocrine Diseases'),
  ('Diabetes mellitus', 'Endocrine Diseases'),
  ('Obesity', 'Endocrine Diseases'),
  ('Asthma', 'Respiratory Diseases'),
  ('Chronic kidney disease', 'Renal Disease'),
  ('Renal Disease', 'Renal Disease'),
  ('Rheumatoid Arthritis', 'Immunological Diseases'),
  ('Immunological Diseases', 'Immunological Diseases'),
  ('Cardiovascular Diseases', 'Cardiovascular Diseases'),
  ('Endocrine Diseases', 'Endocrine Diseases'),
  ('Respiratory Diseases', 'Respiratory Diseases');

INSERT INTO clinical_trials
  (company_name, company_id, trial_name, trial_id, official_title, brief_summary, detailed_description, related_conditions, trial_status, trial_phase, study_type, allocation, intervention_model, masking, primary_purpose, locations, principal_investigator, sponsor, ethics_approval, pathology, age_range, gender, exclusion_criteria, start_date, end_date)
VALUES
  ('Standalone Pharma', 1, 'CardioBalance Hypertension Study', 1001, 'A randomized study of CardioBalance for adults with controlled hypertension', 'Evaluates whether CardioBalance improves blood pressure control in adults with hypertension.', 'Participants should have documented hypertension, stable medication use, and no recent major cardiovascular surgery.', 'Hypertension', 1, 'Phase II', 'Interventional', 'Randomized', 'Parallel', 'Double (participant, investigator)', 'Treatment', 'Ottawa, Canada', 'Dr. Amara Patel', 'Standalone Pharma', 'REB-LOCAL-1001', 'Hypertension', '40-75', 'Both', JSON_OBJECT('BMI', '> 18 or < 35', 'Diseases', 'Renal Disease', 'Surgeries', 'Recent abdominal surgery', 'Prior Medications', 'Warfarin', 'PriorMedications', 'Warfarin', 'Pregnancy', 'Yes'), '2026-07-01', '2027-02-28'),
  ('Standalone Pharma', 1, 'GlucoForward Type 2 Diabetes Trial', 1002, 'A pragmatic trial of GlucoForward in adults with type 2 diabetes', 'Assesses a diabetes support intervention in adults with type 2 diabetes.', 'Participants should have type 2 diabetes and no recent surgery or advanced renal disease.', 'Type 2 Diabetes', 1, 'Phase III', 'Interventional', 'Randomized', 'Single Group', 'None (Open Label)', 'Treatment', 'Ottawa, Canada', 'Dr. Noah Tremblay', 'Standalone Pharma', 'REB-LOCAL-1002', 'Type 2 Diabetes', '30-70', 'Both', JSON_OBJECT('BMI', '> 20 or < 40', 'Diseases', 'Renal Disease', 'Surgeries', 'Recent surgeries', 'Prior Medications', 'Insulin', 'PriorMedications', 'Insulin', 'Pregnancy', 'Yes'), '2026-08-15', '2027-08-15'),
  ('Northstar Therapeutics', 2, 'AIR-12 Asthma Monitoring Study', 2001, 'Observational study of asthma symptom stability and medication use', 'Tracks respiratory symptoms in adults with asthma.', 'Participants should have asthma and no recent lung surgery or hospitalization.', 'Asthma', 0, 'Phase IV', 'Observational', 'Non-randomized', 'Single Group', 'None (Open Label)', 'Supportive Care', 'Ottawa, Canada', 'Dr. Sofia Nguyen', 'Northstar Therapeutics', 'REB-LOCAL-2001', 'Asthma', '18-65', 'Both', JSON_OBJECT('BMI', '> 16 or < 45', 'Diseases', 'Cardiovascular Diseases', 'Surgeries', 'Recent lung surgery', 'Prior Medications', 'Oral corticosteroid', 'PriorMedications', 'Oral corticosteroid', 'Pregnancy', 'Unrestricted'), '2026-09-01', '2027-03-01'),
  ('Standalone Pharma', 1, 'NCT06660173 Maridebart Cafraglutide Type 2 Diabetes Study', 6660173, 'Maridebart cafraglutide in adults with type 2 diabetes and obesity-related metabolic disease', 'Evaluates a metabolic intervention in adults with type 2 diabetes, elevated BMI, and stable background therapy.', 'POC test trial based on summarized public criteria: age at least 18, type 2 diabetes for at least 6 months, HbA1c 7.0 to 10.5 percent, stable metformin or SGLT2 therapy, and BMI-related criteria.', 'Type 2 Diabetes', 1, 'Phase II', 'Interventional', 'Randomized', 'Parallel', 'Double (participant, investigator)', 'Treatment', 'Ottawa, Canada', 'Dr. Noah Tremblay', 'Standalone Pharma', 'REB-LOCAL-NCT06660173', 'Type 2 Diabetes', '18-80', 'Both', JSON_OBJECT('BMI', '> 27 or < 45', 'Diseases', 'Renal Disease', 'Surgeries', 'Recent surgeries', 'Prior Medications', 'Insulin, Semaglutide', 'PriorMedications', 'Insulin, Semaglutide', 'Pregnancy', 'Yes'), '2026-10-01', '2027-10-01');

INSERT INTO clinical_trial_id_sequence (id, next_trial_id)
SELECT 1, GREATEST(
  COALESCE(MAX(CASE WHEN trial_id > 0 AND trial_id <= 999 THEN trial_id END), 0) + 1,
  1
)
FROM clinical_trials;

INSERT INTO clinical_trial_semantic_criteria
  (trial_id, source_type, criteria_json, summary)
VALUES
  (6660173, 'seeded_summary', JSON_OBJECT(
    'nctId', 'NCT06660173',
    'agentOutputVersion', 'local-seed-v1',
    'supplementalCriteria', JSON_ARRAY(
      JSON_OBJECT('category', 'diagnosis duration', 'criterion', 'Type 2 diabetes documented for at least 6 months', 'patientEvidenceHints', JSON_ARRAY('medical_history', 'other_notes')),
      JSON_OBJECT('category', 'lab value', 'criterion', 'HbA1c between 7.0 and 10.5 percent', 'patientEvidenceHints', JSON_ARRAY('medical_history', 'other_notes')),
      JSON_OBJECT('category', 'medication stability', 'criterion', 'Stable metformin or SGLT2 inhibitor therapy before screening', 'patientEvidenceHints', JSON_ARRAY('prior_medication', 'other_notes')),
      JSON_OBJECT('category', 'metabolic status', 'criterion', 'BMI-related obesity or metabolic disease context may affect eligibility', 'patientEvidenceHints', JSON_ARRAY('height', 'weight', 'other_notes'))
    ),
    'semanticRisks', JSON_ARRAY('Recent incretin therapy, insulin use, advanced renal disease, or HbA1c outside range may reduce eligibility')
  ), 'Supplemental semantic criteria for the local NCT06660173-style type 2 diabetes trial.');

INSERT INTO clinicaltrials_patients
  (trial_id, patient_id, company_id, enrollment_date, doctor_ids)
VALUES
  (1001, 1, 1, '2026-07-10', JSON_ARRAY(JSON_OBJECT('id', 1, 'response_time', '2026-07-09T14:00:00Z'))),
  (1002, 2, 1, '2026-08-20', JSON_ARRAY(JSON_OBJECT('id', 2, 'response_time', '2026-08-19T15:00:00Z'))),
  (2001, 3, 2, '2026-09-12', JSON_ARRAY(JSON_OBJECT('id', 3, 'response_time', '2026-09-11T13:30:00Z'))),
  (6660173, 11, 1, '2026-10-05', JSON_ARRAY(JSON_OBJECT('id', 2, 'response_time', '2026-10-04T13:00:00Z')));

INSERT INTO clinicaltrials_actions
  (ActionID, ActionType, TrialID, InitiatorType, InitiatorID, IsCompleted, Timestamp)
VALUES
  (1, 0, 1001, 1, 1, TRUE, '2026-07-01 09:00:00'),
  (2, 1, 1001, 1, 1, FALSE, '2026-07-12 10:30:00'),
  (3, 2, 1002, 3, 5, FALSE, '2026-08-22 11:15:00'),
  (4, 1, 6660173, 1, 1, FALSE, '2026-10-05 10:00:00');

INSERT INTO clinicaltrials_actionrequests
  (ActionID, ReceivedUserType, ReceivedUserID, ReadStatus, Note, IsPrimaryRequest, Timestamp)
VALUES
  (1, 0, 1, TRUE, 'Initial trial audit request.', TRUE, '2026-07-01 09:01:00'),
  (2, 3, 4, FALSE, 'Synthetic invitation for local testing.', TRUE, '2026-07-12 10:31:00'),
  (2, 2, 1, FALSE, 'Doctor copied on synthetic invitation.', FALSE, '2026-07-12 10:31:30'),
  (3, 1, 1, FALSE, 'Synthetic patient application for local testing.', TRUE, '2026-08-22 11:16:00'),
  (4, 3, 11, FALSE, 'Synthetic NCT06660173-style invitation.', TRUE, '2026-10-05 10:01:00');

INSERT INTO clinicaltrials_actionresponses
  (ActionID, ResponseUserType, ResponseUserID, ResponseStatus, Note, Timestamp)
VALUES
  (2, 2, 1, 0, 'Doctor acknowledged invitation.', '2026-07-12 12:00:00'),
  (3, 2, 2, 0, 'Doctor acknowledged application.', '2026-08-22 13:00:00'),
  (4, 2, 2, 0, 'Endocrinologist acknowledged synthetic diabetes candidate.', '2026-10-05 13:00:00');

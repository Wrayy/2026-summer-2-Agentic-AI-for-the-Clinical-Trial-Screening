-- Local development schema for the Clinical Trial Matching POC.
-- This intentionally models only the e-Hospital tables used by the current
-- clinical trial Flutter flow and copied backend routes.

CREATE DATABASE IF NOT EXISTS clinical_trial_matching_poc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE clinical_trial_matching_poc;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS clinicaltrials_actionresponses;
DROP TABLE IF EXISTS clinicaltrials_actionrequests;
DROP TABLE IF EXISTS clinicaltrials_actions;
DROP TABLE IF EXISTS clinical_trial_match_results;
DROP TABLE IF EXISTS clinicaltrials_patients;
DROP TABLE IF EXISTS clinical_trial_semantic_criteria;
DROP TABLE IF EXISTS clinical_trials_contacts;
DROP TABLE IF EXISTS clinical_trial_id_sequence;
DROP TABLE IF EXISTS clinical_trials;
DROP TABLE IF EXISTS pathology_classifications;
DROP TABLE IF EXISTS patients_pathology;
DROP TABLE IF EXISTS patient_doctor;
DROP TABLE IF EXISTS doctors_registration;
DROP TABLE IF EXISTS patients_registration;
DROP TABLE IF EXISTS clinical_staff_registration;
DROP TABLE IF EXISTS pharmaceutical_company;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE pharmaceutical_company (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  password VARCHAR(255)
);

CREATE TABLE clinical_staff_registration (
  id INT PRIMARY KEY AUTO_INCREMENT,
  FName VARCHAR(100) NOT NULL,
  MName VARCHAR(100),
  LName VARCHAR(100) NOT NULL,
  EmailId VARCHAR(255)
);

CREATE TABLE patients_registration (
  id INT PRIMARY KEY AUTO_INCREMENT,
  FName VARCHAR(100) NOT NULL,
  MName VARCHAR(100),
  LName VARCHAR(100) NOT NULL,
  Age INT NOT NULL,
  Gender VARCHAR(20) NOT NULL,
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  BloodGroup VARCHAR(10),
  MobileNumber VARCHAR(30),
  EmailId VARCHAR(255),
  Address VARCHAR(255),
  Location VARCHAR(255),
  City VARCHAR(100),
  Province VARCHAR(100),
  Country VARCHAR(100) DEFAULT 'Canada',
  PostalCode VARCHAR(20),
  HCardNumber VARCHAR(50),
  PassportNumber VARCHAR(50),
  PRNumber VARCHAR(50),
  DLNumber VARCHAR(50),
  password VARCHAR(255),
  verification TINYINT DEFAULT 1,
  date_of_birth DATE
);

CREATE TABLE doctors_registration (
  id INT PRIMARY KEY AUTO_INCREMENT,
  Fname VARCHAR(100) NOT NULL,
  Mname VARCHAR(100),
  Lname VARCHAR(100) NOT NULL,
  EmailId VARCHAR(255),
  MobileNumber VARCHAR(30),
  City VARCHAR(100),
  Province VARCHAR(100),
  Country VARCHAR(100) DEFAULT 'Canada',
  Specialization VARCHAR(150),
  PractincingHospital VARCHAR(255),
  Gender VARCHAR(20),
  Availability VARCHAR(100),
  verification TINYINT DEFAULT 1
);

CREATE TABLE patient_doctor (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  relationship_status VARCHAR(50) DEFAULT 'active',
  association_type VARCHAR(100) DEFAULT 'family_doctor',
  record_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  relationship_start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients_registration(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors_registration(id)
);

CREATE TABLE patients_pathology (
  id INT PRIMARY KEY AUTO_INCREMENT,
  patient_id INT NOT NULL,
  pathology TEXT,
  prior_medication TEXT,
  surgeries TEXT,
  pregnancies INT DEFAULT 0,
  medical_history TEXT,
  other_notes TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients_registration(id)
);

CREATE TABLE pathology_classifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  Pathology VARCHAR(150) NOT NULL,
  Classification VARCHAR(150) NOT NULL
);

CREATE TABLE clinical_trials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(255),
  company_id INT,
  trial_name VARCHAR(255) NOT NULL,
  trial_id INT NOT NULL UNIQUE,
  official_title TEXT,
  brief_summary TEXT,
  detailed_description TEXT,
  related_conditions TEXT,
  trial_status INT DEFAULT 0,
  trial_phase VARCHAR(100),
  study_type VARCHAR(100),
  allocation VARCHAR(100),
  intervention_model VARCHAR(100),
  masking VARCHAR(150),
  primary_purpose VARCHAR(100),
  locations VARCHAR(255),
  principal_investigator VARCHAR(255),
  sponsor VARCHAR(255),
  ethics_approval VARCHAR(255),
  pathology VARCHAR(150),
  age_range VARCHAR(50),
  gender VARCHAR(20),
  exclusion_criteria JSON,
  start_date DATE,
  end_date DATE
);

CREATE TABLE clinical_trial_id_sequence (
  id TINYINT PRIMARY KEY DEFAULT 1,
  next_trial_id INT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE clinical_trial_semantic_criteria (
  id INT PRIMARY KEY AUTO_INCREMENT,
  trial_id INT NOT NULL UNIQUE,
  source_type VARCHAR(100) DEFAULT 'supplemental_agent',
  criteria_json JSON NOT NULL,
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (trial_id) REFERENCES clinical_trials(trial_id)
);

CREATE TABLE clinical_trials_contacts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  trial_id INT NOT NULL,
  first_name VARCHAR(100),
  middle_name VARCHAR(100),
  last_name VARCHAR(100),
  area_code VARCHAR(20),
  phone_number VARCHAR(30),
  email VARCHAR(255)
);

CREATE TABLE clinicaltrials_patients (
  id INT PRIMARY KEY AUTO_INCREMENT,
  trial_id INT NOT NULL,
  patient_id INT NOT NULL,
  company_id INT,
  enrollment_date DATE,
  doctor_ids JSON,
  FOREIGN KEY (patient_id) REFERENCES patients_registration(id)
);

CREATE TABLE clinical_trial_match_results (
  id INT PRIMARY KEY AUTO_INCREMENT,
  trial_id INT NOT NULL,
  patient_id INT NOT NULL,
  deterministic_result_json JSON,
  semantic_result_json JSON,
  score DECIMAL(5,2),
  status VARCHAR(50),
  explanation_json JSON,
  suggested_actions_json JSON,
  patient_context_hash VARCHAR(128),
  trial_criteria_hash VARCHAR(128),
  last_evaluated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_trial_patient_match (trial_id, patient_id),
  FOREIGN KEY (trial_id) REFERENCES clinical_trials(trial_id),
  FOREIGN KEY (patient_id) REFERENCES patients_registration(id)
);

CREATE TABLE clinicaltrials_actions (
  ActionID INT PRIMARY KEY AUTO_INCREMENT,
  ActionType INT NOT NULL,
  TrialID INT NOT NULL,
  InitiatorType INT NOT NULL,
  InitiatorID INT NOT NULL,
  IsCompleted BOOLEAN DEFAULT FALSE,
  Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clinicaltrials_actionrequests (
  RequestID INT PRIMARY KEY AUTO_INCREMENT,
  ActionID INT NOT NULL,
  ReceivedUserType INT NOT NULL,
  ReceivedUserID INT NOT NULL,
  ReadStatus BOOLEAN DEFAULT FALSE,
  Note TEXT,
  IsPrimaryRequest BOOLEAN DEFAULT FALSE,
  Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ActionID) REFERENCES clinicaltrials_actions(ActionID)
);

CREATE TABLE clinicaltrials_actionresponses (
  ResponseID INT PRIMARY KEY AUTO_INCREMENT,
  ActionID INT NOT NULL,
  ResponseUserType INT NOT NULL,
  ResponseUserID INT NOT NULL,
  ResponseStatus INT DEFAULT 0,
  Note TEXT,
  Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ActionID) REFERENCES clinicaltrials_actions(ActionID)
);

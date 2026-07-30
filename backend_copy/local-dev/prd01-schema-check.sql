-- PRD01 schema verification — READ ONLY.
--
-- Purpose: compare the production PRD01 database against the tables and
-- columns this POC's code actually queries, so missing/renamed objects are
-- found before they surface as misleading runtime errors.
--
-- Safety: this script only reads INFORMATION_SCHEMA. It creates nothing,
-- changes nothing, and deletes nothing. Safe to run against production.
--
-- Usage: run against PRD01 and send the output back. Connection values (host,
-- user, password) are NOT stored in this repository -- read them from your
-- local, gitignored backend_copy/app/config/db.config.js.
--   mysql -h <HOST> -u <USER> -p PRD01 < prd01-schema-check.sql
-- Or open this file in MySQL Workbench against the PRD01 connection.


-- ============================================================
-- 1. WHICH REQUIRED TABLES ARE MISSING?
-- ============================================================
-- Every table below is referenced by code paths the Flutter app reaches.
-- Anything reported as MISSING will throw ER_NO_SUCH_TABLE at runtime.

SELECT
  required.table_name                        AS required_table,
  CASE WHEN t.TABLE_NAME IS NULL
       THEN '*** MISSING ***'
       ELSE 'present'
  END                                        AS status,
  COALESCE(t.TABLE_ROWS, 0)                  AS approx_rows
FROM (
  -- Original e-Hospital tables (should already exist in PRD01)
  SELECT 'pharmaceutical_company'            AS table_name UNION ALL
  SELECT 'clinical_trials'                   UNION ALL
  SELECT 'clinical_trials_contacts'          UNION ALL
  SELECT 'clinical_staff_registration'       UNION ALL
  SELECT 'patients_registration'             UNION ALL
  SELECT 'patients_pathology'                UNION ALL
  SELECT 'pathology_classifications'         UNION ALL
  SELECT 'patient_doctor'                    UNION ALL
  SELECT 'doctors_registration'              UNION ALL
  SELECT 'ClinicalTrials_Patients'           UNION ALL
  SELECT 'ClinicalTrials_Actions'            UNION ALL
  SELECT 'ClinicalTrials_ActionRequests'     UNION ALL
  SELECT 'ClinicalTrials_ActionResponses'    UNION ALL
  -- New POC tables (added for this project)
  SELECT 'clinical_trial_id_sequence'        UNION ALL
  SELECT 'clinical_trial_semantic_criteria'  UNION ALL
  SELECT 'clinical_trial_match_results'
) AS required
LEFT JOIN INFORMATION_SCHEMA.TABLES t
       ON t.TABLE_SCHEMA = 'PRD01'
      AND LOWER(t.TABLE_NAME) = LOWER(required.table_name)
ORDER BY status DESC, required_table;


-- ============================================================
-- 2. COLUMN SHAPES FOR THE TABLES THE POC READS/WRITES
-- ============================================================
-- Compare this output against backend_copy/local-dev/schema.sql.
-- Watch for: renamed columns, INT vs VARCHAR on the *_id columns, and
-- NOT NULL columns our INSERTs never supply.

SELECT
  c.TABLE_NAME,
  c.ORDINAL_POSITION AS pos,
  c.COLUMN_NAME,
  c.COLUMN_TYPE,
  c.IS_NULLABLE,
  c.COLUMN_KEY,
  c.COLUMN_DEFAULT,
  c.EXTRA
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_SCHEMA = 'PRD01'
  AND LOWER(c.TABLE_NAME) IN (
    'clinical_trials',
    'clinical_trials_contacts',
    'clinical_trial_id_sequence',
    'clinical_trial_semantic_criteria',
    'clinical_trial_match_results',
    'patients_registration',
    'patients_pathology',
    'pathology_classifications',
    'pharmaceutical_company',
    'clinicaltrials_patients',
    'clinicaltrials_actions',
    'clinicaltrials_actionrequests',
    'clinicaltrials_actionresponses'
  )
ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION;


-- ============================================================
-- 3. KEYS AND CONSTRAINTS ON THE THREE NEW POC TABLES
-- ============================================================
-- clinical_trial_semantic_criteria.trial_id MUST be UNIQUE — the app relies
-- on INSERT ... ON DUPLICATE KEY UPDATE for upserts. Without the unique key,
-- repeated saves silently create duplicate rows instead of updating.
-- clinical_trial_match_results needs UNIQUE (trial_id, patient_id) for the
-- same reason.

SELECT
  s.TABLE_NAME,
  s.INDEX_NAME,
  s.NON_UNIQUE,
  GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) AS columns_in_index
FROM INFORMATION_SCHEMA.STATISTICS s
WHERE s.TABLE_SCHEMA = 'PRD01'
  AND LOWER(s.TABLE_NAME) IN (
    'clinical_trial_semantic_criteria',
    'clinical_trial_match_results',
    'clinical_trial_id_sequence'
  )
GROUP BY s.TABLE_NAME, s.INDEX_NAME, s.NON_UNIQUE
ORDER BY s.TABLE_NAME, s.INDEX_NAME;


-- ============================================================
-- 4. FOREIGN KEYS POINTING AT clinical_trials
-- ============================================================
-- The POC tables must reference clinical_trials(trial_id) — the business ID —
-- not clinical_trials(id), the internal auto-increment. If these point at the
-- wrong column, saves fail with a foreign key error on valid trials.

SELECT
  k.TABLE_NAME,
  k.COLUMN_NAME,
  k.CONSTRAINT_NAME,
  k.REFERENCED_TABLE_NAME,
  k.REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
WHERE k.TABLE_SCHEMA = 'PRD01'
  AND k.REFERENCED_TABLE_NAME IS NOT NULL
  AND (
    LOWER(k.TABLE_NAME) IN (
      'clinical_trial_semantic_criteria',
      'clinical_trial_match_results'
    )
    OR LOWER(k.REFERENCED_TABLE_NAME) = 'clinical_trials'
  )
ORDER BY k.TABLE_NAME, k.COLUMN_NAME;


-- ============================================================
-- 5. DOES pharmaceutical_company HAVE THE password COLUMN?
-- ============================================================
-- Required by the original e-Hospital Pharma login branch we reuse.

SELECT
  CASE WHEN COUNT(*) = 0
       THEN '*** MISSING — login will fail ***'
       ELSE 'present'
  END AS password_column_status
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'PRD01'
  AND LOWER(TABLE_NAME) = 'pharmaceutical_company'
  AND LOWER(COLUMN_NAME) = 'password';


-- ============================================================
-- 6. FULL TABLE INVENTORY (for the broader comparison)
-- ============================================================

SELECT TABLE_NAME, TABLE_ROWS
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'PRD01'
ORDER BY TABLE_NAME;

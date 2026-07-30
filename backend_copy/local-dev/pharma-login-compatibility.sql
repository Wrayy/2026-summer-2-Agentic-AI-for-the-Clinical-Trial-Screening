-- Idempotent local compatibility patch for the inherited e-Hospital
-- Pharmaceutical Office login flow.
--
-- The copied backend's original POST /api/users/login Pharma branch reads
-- pharmaceutical_company.email and pharmaceutical_company.password and compares
-- the submitted password as plaintext. Older local POC databases had only
-- id/name/email because the standalone app previously bypassed login.

USE clinical_trial_matching_poc;

SET @password_column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pharmaceutical_company'
    AND COLUMN_NAME = 'password'
);

SET @add_password_column_sql := IF(
  @password_column_exists = 0,
  'ALTER TABLE pharmaceutical_company ADD COLUMN password VARCHAR(255) NULL AFTER email',
  'SELECT ''pharmaceutical_company.password already exists'' AS message'
);

PREPARE add_password_column_stmt FROM @add_password_column_sql;
EXECUTE add_password_column_stmt;
DEALLOCATE PREPARE add_password_column_stmt;

SET @standalone_company_id := COALESCE(
  (
    SELECT company_id
    FROM (
      SELECT company_id, COUNT(*) AS trial_count
      FROM clinical_trials
      WHERE company_id IS NOT NULL
      GROUP BY company_id
      ORDER BY trial_count DESC, company_id
      LIMIT 1
    ) AS trial_owner
  ),
  1
);

UPDATE pharmaceutical_company
SET email = 'pharm1@test.com',
    password = 'pharm1'
WHERE id = @standalone_company_id;

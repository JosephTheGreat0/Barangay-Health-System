-- MySQL 8.0+ required.

CREATE TABLE IF NOT EXISTS prenatal_checkups (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  patient_id CHAR(36) NOT NULL,
  checkup_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  gestational_age_weeks INT,
  findings TEXT,
  next_visit_date DATE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prenatal_patient (patient_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS immunizations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  patient_id CHAR(36) NOT NULL,
  vaccine_name VARCHAR(255) NOT NULL,
  dose_number INT NOT NULL DEFAULT 1,
  date_given DATE NOT NULL DEFAULT (CURRENT_DATE),
  next_due_date DATE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_immunizations_patient (patient_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS growth_records (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  patient_id CHAR(36) NOT NULL,
  record_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  age_months INT,
  height_cm DECIMAL(5,2),
  weight_kg DECIMAL(5,2),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_growth_patient (patient_id)
) ENGINE=InnoDB;

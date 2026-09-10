-- Auto-generated: creates all 9 databases + loads each service's schema.sql
-- This runs ONCE automatically the first time the mysql container starts
-- (only when its data volume is empty), same as the old Postgres init.sql did.

CREATE DATABASE IF NOT EXISTS auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE auth_db;

-- MySQL 8.0+ required (uses CHECK constraints and expression DEFAULTs).
-- No pgcrypto equivalent needed: MySQL's built-in UUID() function generates
-- the id default, same role Postgres's gen_random_uuid() played.

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'doctor', 'midwife', 'bhw')),
  barangay_id VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE DATABASE IF NOT EXISTS patient_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE patient_db;

-- MySQL 8.0+ required.

CREATE TABLE IF NOT EXISTS households (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  address TEXT NOT NULL,
  barangay VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS patients (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  household_id CHAR(36),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  birthdate DATE NOT NULL,
  sex VARCHAR(10) NOT NULL CHECK (sex IN ('male', 'female')),
  contact_number VARCHAR(50),
  is_pwd BOOLEAN NOT NULL DEFAULT FALSE,
  is_pregnant BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_patients_name (last_name, first_name),
  CONSTRAINT fk_patients_household FOREIGN KEY (household_id) REFERENCES households(id)
) ENGINE=InnoDB;

CREATE DATABASE IF NOT EXISTS consultation_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE consultation_db;

-- MySQL 8.0+ required.
-- patient_id is NOT a foreign key here on purpose: patients live in a
-- different database/service (patient_db), and MySQL foreign keys can't
-- span databases across separate connections/services either way.

CREATE TABLE IF NOT EXISTS visits (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  patient_id CHAR(36) NOT NULL,
  visit_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attending_user_id CHAR(36),
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_visits_patient (patient_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vitals (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  visit_id CHAR(36) NOT NULL,
  height_cm DECIMAL(5,2),
  weight_kg DECIMAL(5,2),
  blood_pressure VARCHAR(20),
  temperature_c DECIMAL(4,1),
  pulse_rate INT,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vitals_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS diagnoses (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  visit_id CHAR(36) NOT NULL,
  diagnosis_text TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_diagnoses_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescriptions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  visit_id CHAR(36) NOT NULL,
  medicine_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(255),
  quantity INT NOT NULL,
  instructions TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prescriptions_visit FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE DATABASE IF NOT EXISTS mch_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE mch_db;

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

CREATE DATABASE IF NOT EXISTS appointment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE appointment_db;

-- MySQL 8.0+ required.

CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  patient_id CHAR(36) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  purpose TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','checked_in','completed','cancelled','no_show')),
  priority_level VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority_level IN ('normal','senior','pwd','pregnant')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_appointments_date (scheduled_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS queue_entries (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  appointment_id CHAR(36),
  patient_id CHAR(36) NOT NULL,
  queue_number INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','in_consultation','done')),
  checked_in_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_queue_checkedin (checked_in_at),
  CONSTRAINT fk_queue_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id)
) ENGINE=InnoDB;

CREATE DATABASE IF NOT EXISTS inventory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE inventory_db;

-- MySQL 8.0+ required.

CREATE TABLE IF NOT EXISTS stock_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  item_name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  quantity_on_hand INT NOT NULL DEFAULT 0,
  expiry_date DATE,
  reorder_level INT NOT NULL DEFAULT 10,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_expiry (expiry_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_transactions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  item_id CHAR(36) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('dispense','restock','adjustment')),
  quantity INT NOT NULL,
  patient_id CHAR(36),
  reference_visit_id CHAR(36),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stocktx_item FOREIGN KEY (item_id) REFERENCES stock_items(id)
) ENGINE=InnoDB;

CREATE DATABASE IF NOT EXISTS referral_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE referral_db;

-- MySQL 8.0+ required.

CREATE TABLE IF NOT EXISTS referrals (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  patient_id CHAR(36) NOT NULL,
  visit_id CHAR(36),
  reason TEXT NOT NULL,
  destination_facility VARCHAR(255) NOT NULL,
  referring_provider VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','acknowledged','completed')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_referrals_patient (patient_id)
) ENGINE=InnoDB;

CREATE DATABASE IF NOT EXISTS reporting_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE reporting_db;

-- MySQL 8.0+ required.
-- Reporting owns a cache of generated summaries, not source-of-truth data.

CREATE TABLE IF NOT EXISTS monthly_summaries (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  report_month DATE NOT NULL,
  total_visits INT NOT NULL DEFAULT 0,
  total_referrals INT NOT NULL DEFAULT 0,
  total_dispensed_items INT NOT NULL DEFAULT 0,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report_month (report_month)
) ENGINE=InnoDB;

CREATE DATABASE IF NOT EXISTS audit_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE audit_db;

-- MySQL 8.0+ required.

CREATE TABLE IF NOT EXISTS audit_events (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  service_name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36),
  action VARCHAR(20) NOT NULL CHECK (action IN ('create','update','delete','view')),
  performed_by CHAR(36),
  payload JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;


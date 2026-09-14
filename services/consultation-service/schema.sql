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

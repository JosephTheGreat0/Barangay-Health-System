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

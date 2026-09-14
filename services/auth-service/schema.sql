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

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

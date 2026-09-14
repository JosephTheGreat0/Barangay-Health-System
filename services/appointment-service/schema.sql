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

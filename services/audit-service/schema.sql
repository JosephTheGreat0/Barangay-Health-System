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

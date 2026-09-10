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

-- Apply once to an existing BHIMS MySQL database before using hardened login throttling.
CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    attempt_key CHAR(64) NOT NULL,
    attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_login_attempts_key_time (attempt_key, attempted_at)
) ENGINE=InnoDB;

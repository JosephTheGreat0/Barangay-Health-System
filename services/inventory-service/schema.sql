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

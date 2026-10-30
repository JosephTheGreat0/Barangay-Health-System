-- Apply once to an existing BHIMS database.
ALTER TABLE patients ADD COLUMN archived_at DATETIME NULL;

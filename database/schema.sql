-- =========================================================
-- Barangay Health Information & Management System (BHIMS)
-- MySQL Schema
-- =========================================================

CREATE DATABASE IF NOT EXISTS bhims CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bhims;

-- ---------------------------------------------------------
-- ROLES & USERS (Auth + RBAC)
-- ---------------------------------------------------------
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,       -- admin, doctor, nurse, bhw, frontdesk, pharmacist, hr, bookkeeper
    description VARCHAR(255)
);

CREATE TABLE staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    contact_number VARCHAR(30),
    address VARCHAR(255),
    hire_date DATE,
    daily_rate DECIMAL(10,2) DEFAULT 0,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    staff_id INT NULL,                      -- link to staff record (nullable for pure admin accounts)
    full_name VARCHAR(150) NOT NULL,
    status ENUM('active','disabled') DEFAULT 'active',
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- STAFF SCHEDULING & PAYROLL
-- ---------------------------------------------------------
CREATE TABLE staff_schedule (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    work_date DATE NOT NULL,
    shift_start TIME NOT NULL,
    shift_end TIME NOT NULL,
    notes VARCHAR(255),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    time_in TIME,
    time_out TIME,
    status ENUM('present','absent','late','leave') DEFAULT 'present',
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_staff_date (staff_id, attendance_date)
);

CREATE TABLE payroll (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    days_worked INT DEFAULT 0,
    basic_pay DECIMAL(10,2) DEFAULT 0,
    deductions DECIMAL(10,2) DEFAULT 0,
    net_pay DECIMAL(10,2) DEFAULT 0,
    status ENUM('draft','approved','paid') DEFAULT 'draft',
    generated_by INT,
    approved_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- ---------------------------------------------------------
-- PATIENTS, APPOINTMENTS / WALK-IN, CONSULTATIONS, REFERRALS
-- ---------------------------------------------------------
CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birthdate DATE,
    sex ENUM('male','female'),
    address VARCHAR(255),
    contact_number VARCHAR(30),
    philhealth_no VARCHAR(30),
    guardian_name VARCHAR(150),
    archived_at DATETIME NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    visit_type ENUM('appointment','walk-in') NOT NULL,
    queue_number INT,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    assigned_staff_id INT NULL,
    status ENUM('waiting','in-consultation','completed','cancelled','no-show') DEFAULT 'waiting',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_staff_id) REFERENCES staff(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE consultations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT NOT NULL,
    patient_id INT NOT NULL,
    staff_id INT NOT NULL,
    chief_complaint VARCHAR(255),
    vitals VARCHAR(255),           -- e.g. "BP:120/80 Temp:36.5 Wt:60kg"
    diagnosis TEXT,
    treatment_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES staff(id)
);

CREATE TABLE referrals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    referring_staff_id INT NOT NULL,
    receiving_facility VARCHAR(150) NOT NULL,
    reason TEXT,
    referral_date DATE NOT NULL,
    status ENUM('pending','accepted','completed','declined') DEFAULT 'pending',
    outcome_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (referring_staff_id) REFERENCES staff(id)
);

-- ---------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------
CREATE TABLE inventory_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(30),
    quantity_on_hand INT DEFAULT 0,
    reorder_level INT DEFAULT 10,
    expiry_date DATE NULL,
    unit_cost DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE inventory_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    txn_type ENUM('stock-in','stock-out','adjustment') NOT NULL,
    quantity INT NOT NULL,
    reference_note VARCHAR(255),      -- e.g. "Dispensed - Consultation #123"
    performed_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id)
);

-- ---------------------------------------------------------
-- FINANCIAL MANAGEMENT
-- ---------------------------------------------------------
CREATE TABLE financial_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    txn_type ENUM('income','expense') NOT NULL,
    category VARCHAR(100) NOT NULL,      -- e.g. Payroll, Supply Purchase, LGU Funding, Donation
    amount DECIMAL(12,2) NOT NULL,
    description VARCHAR(255),
    reference_module VARCHAR(50),        -- e.g. 'payroll', 'inventory'
    reference_id INT NULL,
    transaction_date DATE NOT NULL,
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recorded_by) REFERENCES users(id)
);

-- ---------------------------------------------------------
-- AUDIT TRAIL (admin-only visibility, enforced in app layer)
-- ---------------------------------------------------------
CREATE TABLE audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    username VARCHAR(50),
    action VARCHAR(50) NOT NULL,      -- CREATE, UPDATE, DELETE, LOGIN, LOGIN_FAILED, VIEW
    module VARCHAR(50) NOT NULL,
    record_id INT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- LOGIN THROTTLING
-- ---------------------------------------------------------
CREATE TABLE login_attempts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    attempt_key CHAR(64) NOT NULL,
    attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_login_attempts_key_time (attempt_key, attempted_at)
);

-- ---------------------------------------------------------
-- SEED DATA
-- ---------------------------------------------------------
INSERT INTO roles (name, description) VALUES
('admin', 'Full system access'),
('doctor', 'Consultation, referrals, patient records'),
('nurse', 'Patient records, appointments, vitals'),
('bhw', 'Barangay health worker - patients, referrals, appointments'),
('frontdesk', 'Appointment and walk-in queue management'),
('pharmacist', 'Inventory management'),
('hr', 'Staff management, scheduling, payroll'),
('bookkeeper', 'Financial management');

-- No default administrator is seeded. Create one using database/create_admin.php (CLI only).

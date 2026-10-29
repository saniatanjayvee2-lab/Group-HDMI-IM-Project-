CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- USER ADDRESSES
CREATE TABLE user_addresses (
    address_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    street_address VARCHAR(255),
    city VARCHAR(100),
    province VARCHAR(100),
    postal_code VARCHAR(20),
    is_primary BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- USER PHONES
CREATE TABLE user_phones (
    phone_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    phone_number VARCHAR(30) NOT NULL,
    type VARCHAR(50),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- TECHNICIANS
CREATE TABLE technicians (
    technician_id SERIAL PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    specialization VARCHAR(255),
    hire_date DATE,
    status VARCHAR(50),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- DEVICES
CREATE TABLE devices (
    device_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    device_type VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    serial_number VARCHAR(100),
    accessories_included TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

-- REPAIR REQUESTS
CREATE TABLE repair_requests (
    repair_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    technician_id INT,
    problem_description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    date_submitted TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_completed TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (device_id)
        REFERENCES devices(device_id),

    FOREIGN KEY (technician_id)
        REFERENCES technicians(technician_id)
);

-- DIAGNOSES
CREATE TABLE diagnoses (
    diagnosis_id SERIAL PRIMARY KEY,
    repair_id INT NOT NULL,
    technician_id INT NOT NULL,
    diagnosis_details TEXT NOT NULL,
    recommended_action TEXT,
    date_diagnosed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (repair_id)
        REFERENCES repair_requests(repair_id)
        ON DELETE CASCADE,

    FOREIGN KEY (technician_id)
        REFERENCES technicians(technician_id)
);

-- PARTS
CREATE TABLE parts (
    part_id SERIAL PRIMARY KEY,
    part_name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    unit_price DECIMAL(10,2) NOT NULL,
    stock_quantity INT DEFAULT 0
);

-- REPAIR PARTS
CREATE TABLE repair_parts (
    repair_part_id SERIAL PRIMARY KEY,
    repair_id INT NOT NULL,
    part_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,

    FOREIGN KEY (repair_id)
        REFERENCES repair_requests(repair_id)
        ON DELETE CASCADE,

    FOREIGN KEY (part_id)
        REFERENCES parts(part_id)
);

-- LABOR CHARGES
CREATE TABLE labor_charges (
    labor_id SERIAL PRIMARY KEY,
    repair_id INT NOT NULL,
    description VARCHAR(255),
    labor_cost DECIMAL(10,2) NOT NULL,

    FOREIGN KEY (repair_id)
        REFERENCES repair_requests(repair_id)
        ON DELETE CASCADE
);

-- PAYMENTS
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    repair_id INT NOT NULL,
    amount_paid DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50),
    payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (repair_id)
        REFERENCES repair_requests(repair_id)
);

-- PAYMONGO TRANSACTIONS
CREATE TABLE paymongo_transactions (
    paymongo_id SERIAL PRIMARY KEY,
    payment_id INT NOT NULL,
    paymongo_source_id VARCHAR(255),
    checkout_session_id VARCHAR(255),
    payment_type VARCHAR(50),
    raw_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (payment_id)
        REFERENCES payments(payment_id)
);

-- PAYMONGO CHECKOUT SESSIONS
CREATE TABLE IF NOT EXISTS paymongo_checkout_sessions (
    checkout_session_id VARCHAR(255) PRIMARY KEY,
    repair_id INT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    reference_number VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    payment_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,

    FOREIGN KEY (repair_id)
        REFERENCES repair_requests(repair_id),

    FOREIGN KEY (payment_id)
        REFERENCES payments(payment_id)
);

-- PAYMENT CORRECTION AUDIT LOG
CREATE TABLE IF NOT EXISTS payment_audit_logs (
    audit_id SERIAL PRIMARY KEY,
    payment_id INT NOT NULL,
    admin_user_id INT NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('EDIT', 'VOID')),
    old_amount DECIMAL(10,2) NOT NULL,
    new_amount DECIMAL(10,2) NOT NULL,
    old_method VARCHAR(50),
    new_method VARCHAR(50),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (payment_id)
        REFERENCES payments(payment_id),

    FOREIGN KEY (admin_user_id)
        REFERENCES users(user_id)
);

-- REPAIR STATUS HISTORY
CREATE TABLE repair_status_history (
    history_id SERIAL PRIMARY KEY,
    repair_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    changed_by INT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (repair_id)
        REFERENCES repair_requests(repair_id)
        ON DELETE CASCADE,

    FOREIGN KEY (changed_by)
        REFERENCES users(user_id)
);
"""
Seed Snowflake with tables and data for the Mobile Reimbursement Automation workflow.

Creates a new REIMBURSEMENT_DB database with:
- EMPLOYEES: Employee master data (for verification)
- REIMBURSEMENT_CLAIMS: Claim records (for duplicate detection)
- PAYROLL: Payroll records (for payroll updates)
"""

import snowflake.connector

SNOWFLAKE_ACCOUNT = "QBAIKPT-MJ82801"
SNOWFLAKE_USER = "PARABOLA"
SNOWFLAKE_PASSWORD = "R87wcwpRwisM39a"
SNOWFLAKE_WAREHOUSE = "COMPUTE_WH"


def run():
    conn = snowflake.connector.connect(
        account=SNOWFLAKE_ACCOUNT,
        user=SNOWFLAKE_USER,
        password=SNOWFLAKE_PASSWORD,
        warehouse=SNOWFLAKE_WAREHOUSE,
    )
    cursor = conn.cursor()

    print("Creating database REIMBURSEMENT_DB...")
    cursor.execute("CREATE DATABASE IF NOT EXISTS REIMBURSEMENT_DB")
    cursor.execute("USE DATABASE REIMBURSEMENT_DB")
    cursor.execute("CREATE SCHEMA IF NOT EXISTS PUBLIC")
    cursor.execute("USE SCHEMA PUBLIC")

    # ── EMPLOYEES table ──
    print("Creating EMPLOYEES table...")
    cursor.execute("""
        CREATE OR REPLACE TABLE EMPLOYEES (
            EMPLOYEE_ID VARCHAR(20) PRIMARY KEY,
            NAME VARCHAR(200) NOT NULL,
            EMAIL VARCHAR(200) NOT NULL,
            DEPARTMENT VARCHAR(100),
            DESIGNATION VARCHAR(100),
            EMPLOYMENT_TYPE VARCHAR(20) DEFAULT 'FTE',
            BAND VARCHAR(10),
            BAND_LIMIT DECIMAL(12,2),
            MANAGER_EMAIL VARCHAR(200),
            LOCATION VARCHAR(100),
            JOINING_DATE DATE,
            IS_ACTIVE BOOLEAN DEFAULT TRUE,
            CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """)

    print("Inserting employee data...")
    employees = [
        ("EMP001", "Rahul Sharma", "rahul.sharma@orky.com", "Engineering", "Senior Engineer", "FTE", "B4", 15000.00, "priya.patel@orky.com", "Bangalore", "2021-03-15"),
        ("EMP002", "Priya Patel", "priya.patel@orky.com", "Engineering", "Engineering Manager", "FTE", "B5", 25000.00, "amit.kumar@orky.com", "Bangalore", "2019-07-01"),
        ("EMP003", "Amit Kumar", "amit.kumar@orky.com", "Engineering", "Director", "FTE", "B6", 40000.00, "cto@orky.com", "Mumbai", "2018-01-10"),
        ("EMP004", "Sneha Reddy", "sneha.reddy@orky.com", "Finance", "Finance Analyst", "FTE", "B3", 10000.00, "deepak.joshi@orky.com", "Hyderabad", "2022-06-20"),
        ("EMP005", "Deepak Joshi", "deepak.joshi@orky.com", "Finance", "Finance Manager", "FTE", "B5", 25000.00, "cfo@orky.com", "Mumbai", "2019-11-05"),
        ("EMP006", "Ananya Gupta", "ananya.gupta@orky.com", "HR", "HR Business Partner", "FTE", "B4", 15000.00, "hr-head@orky.com", "Delhi", "2020-08-12"),
        ("EMP007", "Vikram Singh", "vikram.singh@orky.com", "Sales", "Sales Executive", "FTE", "B3", 10000.00, "sales-head@orky.com", "Delhi", "2023-01-09"),
        ("EMP008", "Meera Nair", "meera.nair@orky.com", "Engineering", "Software Engineer", "CONTRACT", "B2", 5000.00, "rahul.sharma@orky.com", "Bangalore", "2024-02-01"),
        ("EMP009", "Arjun Menon", "arjun.menon@orky.com", "Product", "Product Manager", "FTE", "B4", 15000.00, "product-head@orky.com", "Bangalore", "2021-09-15"),
        ("EMP010", "Kavita Iyer", "kavita.iyer@orky.com", "Engineering", "QA Lead", "FTE", "B4", 15000.00, "priya.patel@orky.com", "Chennai", "2020-04-22"),
    ]
    cursor.execute("DELETE FROM EMPLOYEES")
    for emp in employees:
        cursor.execute("""
            INSERT INTO EMPLOYEES (EMPLOYEE_ID, NAME, EMAIL, DEPARTMENT, DESIGNATION, EMPLOYMENT_TYPE, BAND, BAND_LIMIT, MANAGER_EMAIL, LOCATION, JOINING_DATE)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, emp)

    # ── REIMBURSEMENT_CLAIMS table ──
    print("Creating REIMBURSEMENT_CLAIMS table...")
    cursor.execute("""
        CREATE OR REPLACE TABLE REIMBURSEMENT_CLAIMS (
            CLAIM_ID VARCHAR(20) PRIMARY KEY,
            EMPLOYEE_ID VARCHAR(20) NOT NULL,
            EMPLOYEE_NAME VARCHAR(200),
            CLAIM_TYPE VARCHAR(50) DEFAULT 'MOBILE',
            INVOICE_NUMBER VARCHAR(100),
            INVOICE_DATE DATE,
            VENDOR_NAME VARCHAR(200),
            AMOUNT DECIMAL(12,2),
            TAX_AMOUNT DECIMAL(12,2),
            TOTAL_AMOUNT DECIMAL(12,2),
            GSTIN VARCHAR(20),
            BILLING_PERIOD VARCHAR(20),
            STATUS VARCHAR(30) DEFAULT 'PENDING',
            SUBMITTED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
            APPROVED_AT TIMESTAMP_NTZ,
            APPROVED_BY VARCHAR(200),
            S3_BUCKET VARCHAR(200),
            S3_KEY VARCHAR(500),
            NOTES TEXT,
            CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """)

    print("Inserting sample reimbursement claims...")
    claims = [
        ("CLM-2025-001", "EMP001", "Rahul Sharma", "MOBILE", "INV-JIO-20250115", "2025-01-15", "Jio", 599.00, 107.82, 706.82, "27AABCU9603R1ZM", "JAN-2025", "APPROVED", "2025-01-20 10:30:00", "priya.patel@orky.com"),
        ("CLM-2025-002", "EMP001", "Rahul Sharma", "MOBILE", "INV-JIO-20250215", "2025-02-15", "Jio", 599.00, 107.82, 706.82, "27AABCU9603R1ZM", "FEB-2025", "APPROVED", "2025-02-20 11:00:00", "priya.patel@orky.com"),
        ("CLM-2025-003", "EMP002", "Priya Patel", "MOBILE", "INV-AIRTEL-20250110", "2025-01-10", "Airtel", 999.00, 179.82, 1178.82, "06AABCA1234B1Z5", "JAN-2025", "APPROVED", "2025-01-18 09:15:00", "amit.kumar@orky.com"),
        ("CLM-2025-004", "EMP004", "Sneha Reddy", "MOBILE", "INV-VI-20250120", "2025-01-20", "Vodafone Idea", 449.00, 80.82, 529.82, "36AABCV5678C1Z9", "JAN-2025", "APPROVED", "2025-01-25 14:00:00", "deepak.joshi@orky.com"),
        ("CLM-2025-005", "EMP007", "Vikram Singh", "MOBILE", "INV-AIRTEL-20250205", "2025-02-05", "Airtel", 799.00, 143.82, 942.82, "07AABCA1234B1Z3", "FEB-2025", "PENDING", None, None),
        ("CLM-2025-006", "EMP009", "Arjun Menon", "MOBILE", "INV-JIO-20250201", "2025-02-01", "Jio", 399.00, 71.82, 470.82, "29AABCU9603R1ZK", "FEB-2025", "REJECTED", "2025-02-10 16:30:00", "product-head@orky.com"),
    ]
    cursor.execute("DELETE FROM REIMBURSEMENT_CLAIMS")
    for claim in claims:
        cursor.execute("""
            INSERT INTO REIMBURSEMENT_CLAIMS (CLAIM_ID, EMPLOYEE_ID, EMPLOYEE_NAME, CLAIM_TYPE, INVOICE_NUMBER, INVOICE_DATE, VENDOR_NAME, AMOUNT, TAX_AMOUNT, TOTAL_AMOUNT, GSTIN, BILLING_PERIOD, STATUS, APPROVED_AT, APPROVED_BY)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, claim)

    # ── PAYROLL table ──
    print("Creating PAYROLL table...")
    cursor.execute("""
        CREATE OR REPLACE TABLE PAYROLL (
            PAYROLL_ID VARCHAR(20) PRIMARY KEY,
            EMPLOYEE_ID VARCHAR(20) NOT NULL,
            EMPLOYEE_NAME VARCHAR(200),
            PAY_PERIOD VARCHAR(20),
            BASE_SALARY DECIMAL(12,2),
            MOBILE_REIMBURSEMENT DECIMAL(12,2) DEFAULT 0,
            OTHER_REIMBURSEMENTS DECIMAL(12,2) DEFAULT 0,
            TAXABLE_AMOUNT DECIMAL(12,2),
            NON_TAXABLE_AMOUNT DECIMAL(12,2) DEFAULT 0,
            TAX_DEDUCTED DECIMAL(12,2) DEFAULT 0,
            NET_PAY DECIMAL(12,2),
            STATUS VARCHAR(20) DEFAULT 'DRAFT',
            PROCESSED_AT TIMESTAMP_NTZ,
            CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
        )
    """)

    print("Inserting payroll data...")
    payroll = [
        ("PAY-2025-01-001", "EMP001", "Rahul Sharma", "JAN-2025", 120000.00, 706.82, 0, 120000.00, 706.82, 24000.00, 96706.82, "PROCESSED", "2025-01-31 18:00:00"),
        ("PAY-2025-01-002", "EMP002", "Priya Patel", "JAN-2025", 180000.00, 1178.82, 0, 180000.00, 1178.82, 42000.00, 139178.82, "PROCESSED", "2025-01-31 18:00:00"),
        ("PAY-2025-01-003", "EMP004", "Sneha Reddy", "JAN-2025", 80000.00, 529.82, 0, 80000.00, 529.82, 12000.00, 68529.82, "PROCESSED", "2025-01-31 18:00:00"),
        ("PAY-2025-01-004", "EMP007", "Vikram Singh", "JAN-2025", 70000.00, 0, 0, 70000.00, 0, 10500.00, 59500.00, "PROCESSED", "2025-01-31 18:00:00"),
        ("PAY-2025-01-005", "EMP009", "Arjun Menon", "JAN-2025", 150000.00, 0, 0, 150000.00, 0, 33000.00, 117000.00, "PROCESSED", "2025-01-31 18:00:00"),
        ("PAY-2025-02-001", "EMP001", "Rahul Sharma", "FEB-2025", 120000.00, 706.82, 0, 120000.00, 706.82, 24000.00, 96706.82, "PROCESSED", "2025-02-28 18:00:00"),
        ("PAY-2025-02-002", "EMP002", "Priya Patel", "FEB-2025", 180000.00, 0, 0, 180000.00, 0, 42000.00, 138000.00, "DRAFT", None),
        ("PAY-2025-02-003", "EMP007", "Vikram Singh", "FEB-2025", 70000.00, 0, 0, 70000.00, 0, 10500.00, 59500.00, "DRAFT", None),
        ("PAY-2025-02-004", "EMP009", "Arjun Menon", "FEB-2025", 150000.00, 0, 0, 150000.00, 0, 33000.00, 117000.00, "DRAFT", None),
        ("PAY-2025-03-001", "EMP001", "Rahul Sharma", "MAR-2025", 120000.00, 0, 0, 120000.00, 0, 24000.00, 96000.00, "DRAFT", None),
    ]
    cursor.execute("DELETE FROM PAYROLL")
    for p in payroll:
        cursor.execute("""
            INSERT INTO PAYROLL (PAYROLL_ID, EMPLOYEE_ID, EMPLOYEE_NAME, PAY_PERIOD, BASE_SALARY, MOBILE_REIMBURSEMENT, OTHER_REIMBURSEMENTS, TAXABLE_AMOUNT, NON_TAXABLE_AMOUNT, TAX_DEDUCTED, NET_PAY, STATUS, PROCESSED_AT)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, p)

    conn.commit()

    # Verify
    print("\n--- Verification ---")
    cursor.execute("SELECT COUNT(*) AS cnt FROM REIMBURSEMENT_DB.PUBLIC.EMPLOYEES")
    print(f"EMPLOYEES: {cursor.fetchone()[0]} rows")
    cursor.execute("SELECT COUNT(*) AS cnt FROM REIMBURSEMENT_DB.PUBLIC.REIMBURSEMENT_CLAIMS")
    print(f"REIMBURSEMENT_CLAIMS: {cursor.fetchone()[0]} rows")
    cursor.execute("SELECT COUNT(*) AS cnt FROM REIMBURSEMENT_DB.PUBLIC.PAYROLL")
    print(f"PAYROLL: {cursor.fetchone()[0]} rows")

    cursor.close()
    conn.close()
    print("\nDone! Snowflake seeded successfully.")


if __name__ == "__main__":
    run()

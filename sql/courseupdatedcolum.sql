-- 1. courses टेबल में एडमिशन और कन्वीनर से जुड़े 4 नए कॉलम जोड़ें
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS admission_start_date DATE,
ADD COLUMN IF NOT EXISTS admission_last_date DATE,
ADD COLUMN IF NOT EXISTS convener_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS convener_contact VARCHAR(20);

-- 2. B.A. Semester-I कोर्स को अपडेट करें
UPDATE courses 
SET convener_name = 'Mohd Javed Khan', 
    convener_contact = '9785159841', 
    admission_start_date = '2026-05-01', 
    admission_last_date = '2026-05-26',
    total_seats = 1600
WHERE name ILIKE '%B.A. Semester-I%' OR name ILIKE '%B.A.%' AND stream = 'Arts';

-- 3. B.Sc. Bio. Semester-I कोर्स को अपडेट करें
UPDATE courses 
SET convener_name = 'Dr. Mukesh Kumar Meena', 
    convener_contact = '8005763754', 
    admission_start_date = '2026-05-01', 
    admission_last_date = '2026-05-26',
    total_seats = 264
WHERE name ILIKE '%B.Sc. Bio. Semester-I%' OR name ILIKE '%B.Sc. Bio%';

-- 4. B.Sc. Math. Semester-I कोर्स को अपडेट करें
UPDATE courses 
SET convener_name = 'Dr. Mukesh Kumar Meena', 
    convener_contact = '8005763754', 
    admission_start_date = '2026-05-01', 
    admission_last_date = '2026-05-26',
    total_seats = 264
WHERE name ILIKE '%B.Sc. Math. Semester-I%' OR name ILIKE '%B.Sc. Math%';

-- 5. B.Com. Semester-I कोर्स को अपडेट करें
UPDATE courses 
SET convener_name = 'Dr. Mahendra Kumar Khardiya', 
    convener_contact = '9928273463', 
    admission_start_date = '2026-05-01', 
    admission_last_date = '2026-05-26',
    total_seats = 600
WHERE name ILIKE '%B.Com. Semester-I%' OR name ILIKE '%B.Com%';

-- 6. BBA Semester-I कोर्स (ARRAY format के साथ)
INSERT INTO courses (id, name, stream, subjects, total_seats, convener_name, convener_contact, admission_start_date, admission_last_date)
SELECT gen_random_uuid(), 'BBA Semester-I', 'Management', 
       ARRAY['Business and Management Concepts', 'Financial Accounting', 'Entrepreneurship & Small Business Management', 'Computer Application'], 
       60, 'Dr. Mahendra Kumar Khardiya', '9928273463', '2026-05-01', '2026-05-26'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE name = 'BBA Semester-I');

-- 7. AEDP (B.Com in BFSI) कोर्स (ARRAY format के साथ)
INSERT INTO courses (id, name, stream, subjects, total_seats, convener_name, convener_contact, admission_start_date, admission_last_date)
SELECT gen_random_uuid(), 'AEDP (B.Com in BFSI)', 'Commerce', 
       ARRAY['Account assistant', 'Principal of management', 'Business Economics'], 
       80, 'Dr. Madhu Sudan Pardhan', '9782582267', '2026-05-01', '2026-05-26'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE name = 'AEDP (B.Com in BFSI)' OR name ILIKE '%AEDP%');

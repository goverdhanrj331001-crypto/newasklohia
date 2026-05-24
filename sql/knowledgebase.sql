-- 1. Create the Knowledge Base Table
CREATE TABLE IF NOT EXISTS college_kb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE college_kb ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Allow anyone (public) to view/read facts
CREATE POLICY "Allow public read access to college_kb" 
ON college_kb FOR SELECT 
TO public 
USING (true);

-- Allow authorized admins (authenticated) to manage (Insert/Update/Delete) facts
CREATE POLICY "Allow authenticated full access to college_kb" 
ON college_kb FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. Insert initial FAQs / Facts for testing
INSERT INTO college_kb (category, question, answer)
VALUES 
  (
    'Canteen', 
    'What are the college canteen timings and popular items?', 
    'The Lohia College canteen is open from 9:30 AM to 3:30 PM on all working days (Monday to Friday). Popular items include hot Samosas (Rs. 10 each), Chai (Rs. 5), Bread Pakora (Rs. 12), and cold beverages.'
  ),
  (
    'Parking & Campus', 
    'Are there parking fees or rules for student vehicles on campus?', 
    'Student parking is located near the main entrance gate. Bicycle parking is free of charge. Two-wheelers (motorcycles/scooters) must have valid college ID passes to enter. No parking fees are charged to regular college students with proper ID.'
  ),
  (
    'Library', 
    'What is the procedure to issue books from the college library?', 
    'To issue books, students must present a valid Library Card which is made in the beginning of the semester. A student can issue up to 2 books at a time for a duration of 14 days. A late fee of Rs. 1 per day is charged for overdue books.'
  ),
  (
    'NSS & NCC', 
    'How can a student join the NSS unit of Lohia College?', 
    'Lohia College has active NSS units. Applications for registration in NSS start in July/August every year. Students can contact the NSS Program Officers in their respective departments to get the application form. Selection is done on a merit and interview basis.'
  );

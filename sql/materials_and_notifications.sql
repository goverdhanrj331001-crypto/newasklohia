-- 1. Create Materials Table
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  files JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS) for materials
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- Create policies for materials
CREATE POLICY "Allow public read access to materials" 
ON materials FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Allow authenticated full access to materials" 
ON materials FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. Create/Update academic_alerts (Notifications) Table
CREATE TABLE IF NOT EXISTS academic_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info' NOT NULL,
  target_stream VARCHAR(50) DEFAULT 'All' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ensure attachments and is_active columns exist if academic_alerts already exists
ALTER TABLE academic_alerts ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE academic_alerts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- Enable RLS for academic_alerts if not already enabled
ALTER TABLE academic_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for academic_alerts (if not already set up)
CREATE POLICY "Allow public read access to academic_alerts" 
ON academic_alerts FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Allow authenticated full access to academic_alerts" 
ON academic_alerts FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

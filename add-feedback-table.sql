-- Add feedback table (run this if you get "relation does not exist" error)

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert feedback
CREATE POLICY "Anyone can insert feedback"
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


-- Create a function for atomic counter increments
-- Run this in your Supabase SQL editor

CREATE OR REPLACE FUNCTION increment_counter(counter_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  -- Try to increment existing counter
  UPDATE counters 
  SET count = count + 1, updated_at = NOW()
  WHERE id = counter_id
  RETURNING count INTO new_count;
  
  -- If no rows were updated, insert a new counter
  IF NOT FOUND THEN
    INSERT INTO counters (id, count, updated_at)
    VALUES (counter_id, 1, NOW())
    RETURNING count INTO new_count;
  END IF;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Also ensure the counters table has the updated_at column
ALTER TABLE counters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create or update the flight_plans counter if it doesn't exist
INSERT INTO counters (id, count, updated_at) 
VALUES ('flight_plans', 0, NOW()) 
ON CONFLICT (id) DO NOTHING;

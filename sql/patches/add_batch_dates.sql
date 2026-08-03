-- Add start_date and end_date columns to batches table if missing
ALTER TABLE public.batches 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

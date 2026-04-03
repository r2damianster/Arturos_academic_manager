-- Run this in the Supabase Dashboard → SQL Editor
ALTER TABLE horarios ADD COLUMN IF NOT EXISTS disponible_hasta DATE;

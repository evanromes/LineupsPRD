-- Add email column to profiles so contacts matching works client-side.
-- Run this once in Supabase SQL Editor.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill from auth.users for existing accounts
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL;

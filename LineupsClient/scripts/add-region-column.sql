-- Add region column to breaks table and backfill from lat/lng coordinates.
-- Run this once in Supabase SQL Editor.

ALTER TABLE breaks ADD COLUMN IF NOT EXISTS region TEXT;

UPDATE breaks
SET region = CASE
  -- Los Angeles / South Bay (lat 33.75–34.15, lng -119.1 to -118.35)
  WHEN lat BETWEEN 33.75 AND 34.15  AND lng BETWEEN -119.1  AND -118.35 THEN 'Los Angeles, CA'
  -- Orange County (lat 33.35–33.75, lng -118.15 to -117.45)
  WHEN lat BETWEEN 33.35 AND 33.75  AND lng BETWEEN -118.15 AND -117.45  THEN 'Orange County, CA'
  -- San Diego (lat 32.5–33.35, lng -118.0 to -117.0)
  WHEN lat BETWEEN 32.5  AND 33.35  AND lng BETWEEN -118.0  AND -117.0   THEN 'San Diego, CA'
  -- Santa Barbara / Ventura (lat 34.15–34.55, lng -120.2 to -118.85)
  WHEN lat BETWEEN 34.15 AND 34.55  AND lng BETWEEN -120.2  AND -118.85  THEN 'Santa Barbara, CA'
  -- Northern California (lat 36.5–38.2, lng -122.7 to -121.8)
  WHEN lat BETWEEN 36.5  AND 38.2   AND lng BETWEEN -122.7  AND -121.8   THEN 'Northern California'
  -- Oahu (lat 21.2–21.75, lng -158.2 to -157.75)
  WHEN lat BETWEEN 21.2  AND 21.75  AND lng BETWEEN -158.2  AND -157.75  THEN 'Oahu, HI'
  -- Maui (lat 20.55–21.1, lng -156.8 to -155.9)
  WHEN lat BETWEEN 20.55 AND 21.1   AND lng BETWEEN -156.8  AND -155.9   THEN 'Maui, HI'
  -- Fiji (lat -18.1 to -17.7, lng 177.0 to 177.35)
  WHEN lat BETWEEN -18.1 AND -17.7  AND lng BETWEEN 177.0   AND 177.35   THEN 'Fiji'
  -- Portugal (lat 38.5–38.75, lng -9.5 to -9.1)
  WHEN lat BETWEEN 38.5  AND 38.75  AND lng BETWEEN -9.5    AND -9.1     THEN 'Portugal'
  -- Mexico (lat 17.7–18.9, lng -104.1 to -101.5)
  WHEN lat BETWEEN 17.7  AND 18.9   AND lng BETWEEN -104.1  AND -101.5   THEN 'Mexico'
  ELSE NULL
END
WHERE region IS NULL;

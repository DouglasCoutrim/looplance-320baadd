ALTER TABLE public.cameras 
ADD COLUMN IF NOT EXISTS video_width INTEGER,
ADD COLUMN IF NOT EXISTS video_height INTEGER,
ADD COLUMN IF NOT EXISTS video_x INTEGER,
ADD COLUMN IF NOT EXISTS video_y INTEGER,
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT '16:9',
ADD COLUMN IF NOT EXISTS sponsor_logo_left TEXT,
ADD COLUMN IF NOT EXISTS sponsor_logo_center TEXT,
ADD COLUMN IF NOT EXISTS sponsor_logo_right TEXT,
ADD COLUMN IF NOT EXISTS final_overlay_url TEXT;

-- Update RLS policies to ensure super admins and owners can update these fields
-- Assuming existing policies cover this, but keeping it in mind.

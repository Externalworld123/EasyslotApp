
-- Add area column to centers for SEO location filtering
ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS area TEXT;

-- Index for fast city/area lookups
CREATE INDEX IF NOT EXISTS idx_centers_city ON public.centers (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_centers_area ON public.centers (LOWER(area));
CREATE INDEX IF NOT EXISTS idx_centers_city_area ON public.centers (LOWER(city), LOWER(area));


-- Add slug column to centers table for SEO-friendly URLs
ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Add city column to centers table
ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS city text;

-- Auto-generate slugs for existing centers
UPDATE public.centers SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) || '-' || SUBSTRING(id::text, 1, 8) WHERE slug IS NULL;

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_centers_slug ON public.centers(slug);

-- Allow public (anon) read access to centers by slug for SEO pages
CREATE POLICY "Public can view active centers" ON public.centers FOR SELECT TO anon USING (is_active = true);


-- Add new columns to resources table
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 1;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS pricing_type text DEFAULT 'hourly';
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Create availability_schedule table
CREATE TABLE public.availability_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL DEFAULT '06:00',
  end_time time NOT NULL DEFAULT '22:00',
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_id, day_of_week)
);

-- Enable RLS on availability_schedule
ALTER TABLE public.availability_schedule ENABLE ROW LEVEL SECURITY;

-- RLS: center users can read schedules (via resource's center_id)
CREATE POLICY "Center users see schedules"
ON public.availability_schedule
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = availability_schedule.resource_id
    AND user_belongs_to_center(auth.uid(), r.center_id)
  )
);

-- RLS: center admins manage schedules
CREATE POLICY "Center admins manage schedules"
ON public.availability_schedule
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = availability_schedule.resource_id
    AND user_belongs_to_center(auth.uid(), r.center_id)
    AND (has_role(auth.uid(), 'center_admin') OR has_role(auth.uid(), 'super_admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = availability_schedule.resource_id
    AND user_belongs_to_center(auth.uid(), r.center_id)
    AND (has_role(auth.uid(), 'center_admin') OR has_role(auth.uid(), 'super_admin'))
  )
);

-- Create storage bucket for resource images
INSERT INTO storage.buckets (id, name, public) VALUES ('resource-images', 'resource-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anyone can view
CREATE POLICY "Public read resource images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'resource-images');

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated upload resource images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resource-images');

-- Storage RLS: authenticated users can update their uploads
CREATE POLICY "Authenticated update resource images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'resource-images');

-- Storage RLS: authenticated users can delete their uploads
CREATE POLICY "Authenticated delete resource images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'resource-images');

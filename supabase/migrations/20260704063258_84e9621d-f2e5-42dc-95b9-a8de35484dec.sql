
-- Restrict anon access to sensitive PII/financial columns via column-level grants
-- Centers: hide upi_id from anon
REVOKE SELECT ON public.centers FROM anon;
GRANT SELECT (id, name, address, phone, email, is_active, created_at, updated_at, organization_id, slug, city, image_url, latitude, longitude, area) ON public.centers TO anon;

-- Monthly plans: hide customer PII and financials from anon (keep scheduling only)
REVOKE SELECT ON public.monthly_plans FROM anon;
GRANT SELECT (id, resource_id, center_id, start_date, end_date, slot_time, duration_minutes, days_of_week, is_active, plan_type, created_at, updated_at) ON public.monthly_plans TO anon;

-- Plan participants: not needed by public UI — remove anon SELECT entirely
DROP POLICY IF EXISTS "Public can view active plan participants" ON public.plan_participants;
REVOKE SELECT ON public.plan_participants FROM anon;

-- Trainers: hide phone/email from anon
REVOKE SELECT ON public.trainers FROM anon;
GRANT SELECT (id, center_id, name, sport, bio, image_url, rating, total_reviews, experience_years, is_active, created_at, updated_at) ON public.trainers TO anon;

-- Storage: drop broad SELECT policy that allowed listing all objects in the public bucket.
-- Public file access via getPublicUrl / CDN continues to work because the bucket is public.
DROP POLICY IF EXISTS "Public read resource images" ON storage.objects;

-- Lock down trigger-only SECURITY DEFINER functions so they cannot be invoked via the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_session_overlap() FROM PUBLIC, anon, authenticated;

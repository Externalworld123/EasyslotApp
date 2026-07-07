
CREATE POLICY "Public can view active monthly plans"
  ON public.monthly_plans FOR SELECT
  TO anon
  USING (is_active = true AND is_resource_publicly_visible(resource_id));

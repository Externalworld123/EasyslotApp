
CREATE POLICY "Public can view active pricing rules"
ON public.pricing_rules
FOR SELECT
TO anon
USING (
  is_active = true
  AND EXISTS (
    SELECT 1 FROM public.centers c
    WHERE c.id = pricing_rules.center_id AND c.is_active = true
  )
);

GRANT SELECT ON public.pricing_rules TO anon;

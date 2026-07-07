
-- Drop the exclusion constraint that prevents overlapping sessions
ALTER TABLE public.sessions DROP CONSTRAINT no_overlap_sessions;

-- Create a trigger function that enforces no-overlap only for single-capacity resources
CREATE OR REPLACE FUNCTION public.check_session_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  resource_capacity integer;
  current_count integer;
BEGIN
  -- Only check for active/scheduled sessions
  IF NEW.status NOT IN ('active', 'scheduled') THEN
    RETURN NEW;
  END IF;

  -- Get resource capacity
  SELECT COALESCE(capacity, 1) INTO resource_capacity
  FROM public.resources WHERE id = NEW.resource_id;

  -- Count overlapping active/scheduled sessions (excluding self on UPDATE)
  SELECT COUNT(*) INTO current_count
  FROM public.sessions
  WHERE resource_id = NEW.resource_id
    AND status IN ('active', 'scheduled')
    AND id IS DISTINCT FROM NEW.id
    AND start_time < NEW.scheduled_end_time
    AND scheduled_end_time > NEW.start_time;

  -- Block if at or over capacity
  IF current_count >= resource_capacity THEN
    RAISE EXCEPTION 'no_overlap_sessions: slot is full (capacity=%, current=%)', resource_capacity, current_count;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach the trigger
CREATE TRIGGER enforce_session_overlap
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_session_overlap();

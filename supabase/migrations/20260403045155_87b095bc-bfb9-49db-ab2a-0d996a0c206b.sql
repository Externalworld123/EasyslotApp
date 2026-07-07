-- Add unique constraint: one feedback per session
ALTER TABLE public.feedback ADD CONSTRAINT unique_session_feedback UNIQUE (session_id);
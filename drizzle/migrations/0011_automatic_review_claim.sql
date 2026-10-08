ALTER TABLE public.room_secrets ADD COLUMN review_started_at timestamptz;
CREATE OR REPLACE FUNCTION public.claim_quiz_reviews(_room uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.room_secrets SET review_started_at=now() WHERE room_id=_room AND review_started_at IS NULL;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_quiz_reviews(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_quiz_reviews(uuid) TO service_role;
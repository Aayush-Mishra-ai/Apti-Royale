ALTER TABLE public.rooms ADD COLUMN auto_control boolean NOT NULL DEFAULT false;
ALTER TABLE public.rooms ADD COLUMN phase_started_at timestamptz;
ALTER TABLE public.rooms ADD COLUMN ai_error text;
CREATE TABLE public.round_reviews (room_id uuid NOT NULL REFERENCES public.rooms(id), idx integer NOT NULL, review text NOT NULL, PRIMARY KEY(room_id, idx));
GRANT ALL ON public.round_reviews TO service_role;
ALTER TABLE public.round_reviews ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.ai_review_state (id boolean PRIMARY KEY DEFAULT true, paused boolean NOT NULL DEFAULT false, reason text);
GRANT ALL ON public.ai_review_state TO service_role;
ALTER TABLE public.ai_review_state ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.tick_quiz(_room uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rooms%ROWTYPE; alive_count integer; answer_count integer; extra_seconds integer := 0; out_ids uuid[]; left_count integer; p record;
BEGIN
 SELECT * INTO r FROM public.rooms WHERE id = _room FOR UPDATE;
 IF NOT FOUND OR NOT r.auto_control OR r.status IN ('lobby','finished') THEN RETURN false; END IF;
 IF r.status = 'question' THEN
  SELECT count(*) INTO alive_count FROM public.players WHERE room_id=r.id AND eliminated_at IS NULL;
  SELECT count(*) INTO answer_count FROM public.answers a JOIN public.players p ON p.id=a.player_id WHERE a.room_id=r.id AND a.idx=r.current_index AND p.eliminated_at IS NULL;
  IF EXISTS (SELECT 1 FROM public.powerup_uses u JOIN public.players p ON p.id=u.player_id WHERE p.room_id=r.id AND p.eliminated_at IS NULL AND u.idx=r.current_index AND u.kind='freeze' AND NOT EXISTS(SELECT 1 FROM public.answers a WHERE a.player_id=p.id AND a.idx=r.current_index)) THEN extra_seconds:=10; END IF;
  IF now()<r.question_started_at OR (answer_count<alive_count AND now()<r.question_started_at + make_interval(secs => r.question_seconds + extra_seconds) + interval '1500 milliseconds') THEN RETURN false; END IF;
  UPDATE public.players p SET streak=0 WHERE p.room_id=r.id AND NOT EXISTS(SELECT 1 FROM public.answers a WHERE a.player_id=p.id AND a.idx=r.current_index);
  UPDATE public.rooms SET status='reveal',phase_started_at=now() WHERE id=r.id;
  RETURN true;
 END IF;
 IF r.phase_started_at IS NULL OR now()<r.phase_started_at + interval '10 seconds' THEN RETURN false; END IF;
 IF r.status='reveal' AND r.royale AND (r.current_index+1)%3=0 AND r.current_index+1<r.total_questions THEN
  SELECT count(*) INTO alive_count FROM public.players WHERE room_id=r.id AND eliminated_at IS NULL;
  IF alive_count>1 THEN
   SELECT array_agg(id) INTO out_ids FROM (SELECT id FROM public.players WHERE room_id=r.id AND eliminated_at IS NULL ORDER BY score ASC,created_at DESC LIMIT least(alive_count-1,greatest(1,floor(alive_count*0.2)::integer))) s;
   UPDATE public.players SET eliminated_at=r.current_index WHERE id=ANY(out_ids);
   left_count:=alive_count-cardinality(out_ids);
   IF left_count>1 THEN UPDATE public.rooms SET status='elimination',phase_started_at=now() WHERE id=r.id; RETURN true; END IF;
  END IF;
 END IF;
 IF (left_count IS NOT NULL AND left_count<=1) OR r.current_index+1>=r.total_questions THEN
  UPDATE public.rooms SET status='finished',phase_started_at=now() WHERE id=r.id;
  FOR p IN SELECT name,score,row_number() OVER(ORDER BY score DESC,created_at) AS rank FROM public.players WHERE room_id=r.id LOOP
   PERFORM public.bump_world_ranking(p.name,p.score,p.rank=1);
  END LOOP;
 ELSE
  UPDATE public.rooms SET status='question',current_index=current_index+1,question_started_at=now()+interval '3 seconds',phase_started_at=now() WHERE id=r.id;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.tick_quiz(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.tick_quiz(uuid) TO service_role;
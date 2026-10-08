ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question text;
UPDATE public.questions SET question = prompt WHERE question IS NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium';
ALTER TABLE public.questions ALTER COLUMN prompt SET DEFAULT '';
COMMENT ON COLUMN public.questions.prompt IS 'DEPRECATED: replaced by question';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS streak int NOT NULL DEFAULT 0;
COMMENT ON FUNCTION public.record_answer(uuid,uuid,integer,integer,boolean,integer) IS 'DEPRECATED: replaced by record_answer_v2';

CREATE OR REPLACE FUNCTION public.record_answer_v2(_room uuid, _player uuid, _idx int, _choice int, _correct boolean, _points int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s int; bonus int := 0; total int;
BEGIN
  SELECT streak INTO s FROM players WHERE id = _player FOR UPDATE;
  IF _correct THEN bonus := LEAST(COALESCE(s,0), 5) * 100; END IF;
  total := _points + bonus;
  INSERT INTO answers(room_id, player_id, idx, choice, is_correct, points)
  VALUES (_room, _player, _idx, _choice, _correct, total);
  UPDATE players SET score = score + total,
    correct_count = correct_count + (CASE WHEN _correct THEN 1 ELSE 0 END),
    streak = CASE WHEN _correct THEN streak + 1 ELSE 0 END
  WHERE id = _player;
  RETURN total;
EXCEPTION WHEN unique_violation THEN
  RETURN -1;
END $$;
REVOKE ALL ON FUNCTION public.record_answer_v2 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_answer_v2 TO service_role;
CREATE OR REPLACE FUNCTION public.record_answer_v3(_room uuid, _player uuid, _idx integer, _choice integer, _correct boolean, _points integer)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE s int; bonus int := 0; first_bonus int := 0; total int;
BEGIN
  PERFORM 1 FROM rooms WHERE id = _room FOR UPDATE;
  SELECT streak INTO s FROM players WHERE id = _player FOR UPDATE;
  IF _correct THEN
    bonus := LEAST(COALESCE(s,0), 5) * 100;
    IF NOT EXISTS (SELECT 1 FROM answers WHERE room_id = _room AND idx = _idx AND is_correct) THEN
      first_bonus := 300;
    END IF;
  END IF;
  total := _points + bonus + first_bonus;
  INSERT INTO answers(room_id, player_id, idx, choice, is_correct, points)
  VALUES (_room, _player, _idx, _choice, _correct, total);
  UPDATE players SET score = score + total,
    correct_count = correct_count + (CASE WHEN _correct THEN 1 ELSE 0 END),
    streak = CASE WHEN _correct THEN streak + 1 ELSE 0 END
  WHERE id = _player;
  RETURN total;
EXCEPTION WHEN unique_violation THEN
  RETURN -1;
END $function$;
REVOKE ALL ON FUNCTION public.record_answer_v3(uuid,uuid,integer,integer,boolean,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_answer_v3(uuid,uuid,integer,integer,boolean,integer) TO service_role;
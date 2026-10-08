CREATE OR REPLACE FUNCTION public.bump_world_ranking(_name text, _score integer, _won boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO world_rankings(name, best_score, total_score, games, wins)
  VALUES (_name, _score, _score, 1, CASE WHEN _won THEN 1 ELSE 0 END)
  ON CONFLICT (name) DO UPDATE SET
    best_score = GREATEST(world_rankings.best_score, EXCLUDED.best_score),
    total_score = world_rankings.total_score + EXCLUDED.total_score,
    games = world_rankings.games + 1,
    wins = world_rankings.wins + EXCLUDED.wins,
    updated_at = now();
END
$function$;
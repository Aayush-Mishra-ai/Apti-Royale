CREATE TABLE public.world_rankings (
  name text PRIMARY KEY,
  best_score integer NOT NULL DEFAULT 0,
  total_score integer NOT NULL DEFAULT 0,
  games integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.world_rankings TO anon;
GRANT SELECT ON public.world_rankings TO authenticated;
GRANT ALL ON public.world_rankings TO service_role;
ALTER TABLE public.world_rankings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "World rankings are publicly readable" ON public.world_rankings FOR SELECT TO anon, authenticated USING (true);
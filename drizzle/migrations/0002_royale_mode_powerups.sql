ALTER TABLE public.rooms ADD COLUMN royale boolean NOT NULL DEFAULT false;
ALTER TABLE public.players ADD COLUMN eliminated_at integer;
CREATE TABLE public.powerup_uses (
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('fifty','double','freeze')),
  idx integer NOT NULL,
  removed integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, kind)
);
GRANT ALL ON public.powerup_uses TO service_role;
ALTER TABLE public.powerup_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ADD COLUMN team_size integer NOT NULL DEFAULT 1;
ALTER TABLE public.players ADD COLUMN team text;
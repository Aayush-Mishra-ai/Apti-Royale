CREATE TABLE public.questions (
  id serial PRIMARY KEY,
  category text NOT NULL,
  prompt text NOT NULL,
  options text[] NOT NULL,
  correct_index int NOT NULL,
  explanation text NOT NULL DEFAULT ''
);
GRANT ALL ON public.questions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.questions_id_seq TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby',
  current_index int NOT NULL DEFAULT -1,
  question_started_at timestamptz,
  question_seconds int NOT NULL DEFAULT 20,
  total_questions int NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rooms are publicly readable" ON public.rooms FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.room_secrets (
  room_id uuid PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  host_token text NOT NULL
);
GRANT ALL ON public.room_secrets TO service_role;
ALTER TABLE public.room_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.room_questions (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  idx int NOT NULL,
  question_id int NOT NULL REFERENCES public.questions(id),
  PRIMARY KEY (room_id, idx)
);
GRANT ALL ON public.room_questions TO service_role;
ALTER TABLE public.room_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  score int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX players_room_name_idx ON public.players (room_id, lower(name));
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players are publicly readable" ON public.players FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.player_secrets (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  token text NOT NULL
);
GRANT ALL ON public.player_secrets TO service_role;
ALTER TABLE public.player_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  idx int NOT NULL,
  choice int NOT NULL,
  is_correct boolean NOT NULL,
  points int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, idx)
);
GRANT ALL ON public.answers TO service_role;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Atomic scoring: insert answer + bump score, rejecting duplicates
CREATE OR REPLACE FUNCTION public.record_answer(_room uuid, _player uuid, _idx int, _choice int, _correct boolean, _points int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO answers(room_id, player_id, idx, choice, is_correct, points)
  VALUES (_room, _player, _idx, _choice, _correct, _points);
  UPDATE players SET score = score + _points, correct_count = correct_count + (CASE WHEN _correct THEN 1 ELSE 0 END)
  WHERE id = _player;
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.record_answer FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_answer TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;

INSERT INTO public.questions (category, prompt, options, correct_index, explanation) VALUES
('Quant','A train 150 m long passes a pole in 15 seconds. What is its speed in km/h?',ARRAY['36','45','54','60'],0,'150/15 = 10 m/s = 36 km/h.'),
('Quant','What is 15% of 240?',ARRAY['32','36','38','40'],1,'0.15 × 240 = 36.'),
('Quant','If the cost price is ₹400 and selling price is ₹500, what is the profit %?',ARRAY['20%','25%','30%','15%'],1,'100/400 = 25%.'),
('Quant','A can finish a job in 10 days, B in 15 days. Together they take:',ARRAY['5 days','6 days','7.5 days','8 days'],1,'1/10 + 1/15 = 1/6.'),
('Quant','The average of 5 consecutive odd numbers is 21. The largest is:',ARRAY['23','25','27','29'],1,'Numbers 17–25; largest 25.'),
('Quant','Simple interest on ₹2000 at 5% per annum for 3 years is:',ARRAY['₹250','₹300','₹350','₹400'],1,'2000 × 5 × 3 / 100 = 300.'),
('Quant','The ratio of two numbers is 3:5 and their sum is 64. The smaller number is:',ARRAY['21','24','27','30'],1,'64 × 3/8 = 24.'),
('Quant','What is the next number: 2, 6, 12, 20, 30, ?',ARRAY['40','42','44','36'],1,'Differences 4,6,8,10,12 → 42.'),
('Quant','A shopkeeper gives 20% discount on ₹750 marked price. Selling price?',ARRAY['₹580','₹600','₹620','₹650'],1,'750 × 0.8 = 600.'),
('Quant','√1764 = ?',ARRAY['38','42','44','46'],1,'42 × 42 = 1764.'),
('Quant','A pipe fills a tank in 6 hours, another empties it in 12 hours. Both open, the tank fills in:',ARRAY['8 h','10 h','12 h','9 h'],2,'1/6 − 1/12 = 1/12.'),
('Quant','If x + 1/x = 3, then x² + 1/x² = ?',ARRAY['7','9','11','5'],0,'(x+1/x)² − 2 = 7.'),
('Logical','Find the odd one out: 3, 5, 11, 14, 17',ARRAY['3','11','14','17'],2,'14 is the only non-prime.'),
('Logical','If CAT is coded as 3120, how is DOG coded?',ARRAY['4157','41507','4158','4167'],0,'D=4, O=15, G=7.'),
('Logical','Pointing to a man, Riya says "He is the son of my grandfather''s only son." The man is Riya''s:',ARRAY['Cousin','Brother','Uncle','Father'],1,'Grandfather''s only son is her father; his son is her brother.'),
('Logical','All roses are flowers. Some flowers fade quickly. Which must be true?',ARRAY['All roses fade quickly','Some roses fade quickly','No rose fades quickly','None of these'],3,'No definite conclusion about roses.'),
('Logical','Next in series: A, C, F, J, O, ?',ARRAY['T','U','S','V'],1,'Gaps +2,+3,+4,+5,+6 → U.'),
('Logical','A clock shows 3:15. The angle between the hands is:',ARRAY['0°','7.5°','15°','30°'],1,'Hour hand moves 7.5° past 3.'),
('Logical','Facing north, you turn right, then right, then left. You now face:',ARRAY['North','East','South','West'],1,'N→E→S→E.'),
('Logical','Which word does not belong: Apple, Mango, Potato, Banana',ARRAY['Apple','Mango','Potato','Banana'],2,'Potato is a vegetable.'),
('Logical','If 1st Jan 2024 was a Monday, what day was 1st Jan 2025?',ARRAY['Tuesday','Wednesday','Thursday','Monday'],1,'2024 is a leap year: +2 days.'),
('Logical','Mirror image of the time 2:30 on an analog clock reads:',ARRAY['9:30','10:30','9:00','8:30'],0,'11:60 − 2:30 = 9:30.'),
('Verbal','Choose the synonym of "Abundant":',ARRAY['Scarce','Plentiful','Rare','Tiny'],1,'Abundant = plentiful.'),
('Verbal','Choose the antonym of "Benevolent":',ARRAY['Kind','Generous','Malevolent','Gentle'],2,'Benevolent ↔ malevolent.'),
('Verbal','Fill in: She has been working here ___ 2019.',ARRAY['for','since','from','by'],1,'"Since" with a point in time.'),
('Verbal','Spot the correctly spelled word:',ARRAY['Accomodate','Acommodate','Accommodate','Acomodate'],2,'Double c, double m.'),
('Verbal','"To let the cat out of the bag" means:',ARRAY['To free an animal','To reveal a secret','To make a mess','To be careless'],1,'Idiom: reveal a secret.'),
('Verbal','Choose the correct sentence:',ARRAY['Neither of them are coming','Neither of them is coming','Neither of them were coming','Neither of them have come'],1,'"Neither" takes a singular verb.'),
('Verbal','Synonym of "Ephemeral":',ARRAY['Eternal','Short-lived','Heavy','Bright'],1,'Ephemeral = lasting a short time.'),
('Verbal','One word for "a person who knows many languages":',ARRAY['Linguist','Polyglot','Orator','Bilingual'],1,'Polyglot.');
# AptiRoyale

A live multiplayer aptitude and logic quiz for up to 50 players. No login — players join with a 6-digit room code and a nickname. The server is the referee: it checks every answer, the timing and the scores, so nobody can cheat from their phone.

**Live URL:** https://aptiroyale.lovable.app/

## What it does

- **Host** creates a room, picks category, difficulty, question count, teams and game control, then shares the 6-digit code.
- **Players** join from their phones with just a nickname. No personal data is collected.
- Questions open on every screen at the same moment after a synced 3-second "Get ready" countdown. 20 seconds per question.
- Faster correct answers earn more points (500–1000), multiplied by difficulty (easy 1x, medium 1.25x, hard 1.5x), plus a streak bonus and +300 for the first correct answer.
- Live leaderboard, top 10 after each question, and a big countdown on the host screen.
- **Royale mode:** every 3 questions the lowest-scoring 20% are eliminated and become spectators. Last survivor wins.
- **Power-ups** (one use each): 50:50, Double points, Freeze (+10s for that player only).
- **Automatic mode:** the game runs itself — rounds advance on server-timed deadlines and an AI coach reviews each round's answers. No host clicks needed.
- **Single player:** play a full game alone, no host needed.
- **Teams:** Solo, Duos or Squads of 4 with live team standings.
- **World ranking:** best scores by nickname across all games.
- **End report:** each player gets accuracy by category and the one category to practise next, with a tip.
- Questions include text, images, tables, bar graphs and line graphs across 7 categories (Quant, Logical, Verbal, Science, Tech, Sports, GK — 20+ each).

## Done / Left / Plan

**Done:** everything above — full host, player and single-player flows, realtime updates, server-side scoring, Royale mode, power-ups, AI-reviewed automatic rounds, teams, world ranking, end reports, dark/light theme.

**Left:** hard questions were reclassified by list position, not hand-reviewed for real difficulty.

**Plan:** more question banks and image assets, per-question time limits, room codes that expire, player avatars.

## Architecture

- **Frontend:** React 19 + TanStack Start (SSR), Tailwind CSS v4, deployed on Lovable.
- **Backend:** Lovable Cloud (Postgres + Realtime). All game writes (create/join/advance/reveal/answer) go through server functions using a privileged client; the browser can only read `rooms` and `players`.
- **Cheat resistance:** correct answers never leave the server before the reveal. Answer timing uses the server clock; duplicates are blocked by a unique constraint inside a database function that also applies scoring atomically.
- **Automatic rounds:** a service-role-only `tick_quiz` database transaction with a room lock advances the game on server deadlines — no host dependency, and disconnected games resume when a participant returns.
- **AI reviews:** prepared in one bounded, database-claimed batch per game via the Lovable AI Gateway; cached reviews are shown only at reveal, and gameplay continues if the AI is unavailable.
- **Identity:** anonymous per-room secret tokens in localStorage — no accounts.

## How to run

```sh
npm i
cp .env.example .env   # fill in your own project values
npm run dev
```

Tests: `npx vitest run`

## Tools / AI used

Built with [Lovable](https://lovable.dev) (AI-assisted development), Lovable Cloud (database + realtime), Lovable AI Gateway (answer reviews), React, TanStack Start, Tailwind CSS, Vitest.

## Who it's for

Students and event hosts who want a fast, fair, Kahoot-style aptitude quiz for classrooms, hackathons and placement prep — with nothing to install and no accounts to create.

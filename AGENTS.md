<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md

## Technical decisions

- Theme-specific homepage artwork uses bundled image imports and scoped CSS transform animations with reduced-motion support; never add a gameplay animation loop. Why: keep visual themes reversible without affecting quiz timing or network updates.

- Automatic room transitions use the service-role-only `tick_quiz` transaction with a room lock and database deadlines; authenticated room-token polling runs on host and player screens. Why: no host dependency, duplicate transitions, or client-controlled timing; disconnected games resume when a participant returns.
- AI coaching is prepared in one bounded, database-claimed batch on the host's explicit Start action; cached reviews are exposed only at reveal, and provider blocks persist separately from gameplay. Why: avoid per-player billed calls and keep scoring deterministic and automatic rounds available during AI failures.

- The server is the quiz referee: all game writes (create/join/advance/reveal/answer) go through `createServerFn` handlers in `src/lib/quiz.functions.ts` using the admin client; the browser can only read `rooms` and `players`. Why: cheat resistance — correct answers, timing and scoring never trust the client.
- Answer timing uses the server clock (`question_started_at` vs handler `Date.now()`, small grace window); duplicate answers are blocked by a unique (player, idx) constraint inside the `record_answer_v2` DB function, which also applies the streak bonus atomically; reveal resets streaks for non-answerers. Why: tamper-proof speed and streak scoring.
- Identity is anonymous per-room secret tokens (host token, player token) kept in localStorage and stored in service-role-only secret tables. Why: no accounts needed to join with a code.
- Live updates use realtime on `rooms` and `players`; question content is fetched from the server only when it is live. Why: hide upcoming questions and answers.
- Question stimuli use validated nullable JSON in `questions.visual` and a shared renderer in `QuestionHeader`; image references use a bundled asset allowlist. Why: host and players see identical safe visuals without exposing answer metadata.
- Royale mode, power-ups and reports are pure rules in `src/lib/royale.ts` (tested in `src/test/royale.test.ts`) applied by the server referee; eliminations run in `nextQuestion` (room status `elimination`), power-up effects live in a service-role-only `powerup_uses` table and are only returned to the owning player (token-checked). Why: eliminations, 2x points and freeze time can't be faked from the browser.

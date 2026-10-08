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

- AI calls go through the Lovable AI Gateway Responses API (`/v1/responses`, model `openai/gpt-6-astra`, streamed with `store: false` + strict `json_schema` output) inside `createServerFn` handlers in `src/lib/roadmap.functions.ts`. Why: it is the project's gateway default and keeps the API key server-side.
- Roadmap state (the generated map and the "known" node set) lives in localStorage only; there is no database. Why: hackathon demo scope, no accounts needed.
- Skill-tree layout is a custom stage-column DAG layout in `src/lib/tree-layout.ts` (one column per roadmap stage, barycenter row ordering), rendered as pan/zoom SVG in `src/components/roadmap-canvas.tsx`. No graph library. Why: zero dependencies and full control of the game-map aesthetic.

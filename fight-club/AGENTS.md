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

## Fight Club Padel League
- League state changes (challenges, scheduling, results, ranking) go only through SECURITY DEFINER Postgres functions; players never write `players`/`challenges` directly — keeps ranking tamper-proof.
- All league rules live in the single-row `league_settings` table and are read by those functions — admins change rules without code changes.
- "Expirado"/"A decorrer" statuses are derived from deadlines in `displayStatus` (src/lib/league.ts), not persisted by cron — avoids background jobs.

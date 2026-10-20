# Fight Club Next.js migration

- The application at the workspace root is Next.js and MongoDB. `fight-club/` and the ZIP are the untouched Lovable reference.
- All league writes go through the validated domain engine and MongoDB transactions. Never let clients edit rankings directly.
- Rules are stored in settings and edited by administrators. Keep audit/history records for affected players.
- MongoDB requires a replica set (Atlas or the included local demo runner).
- Run `npm run typecheck`, `npm test` and `npm run build` after substantive changes.

## Saved project status

- Before starting work, read `docs/PROJECT_STATUS.md` for the saved feature, deployment, testing and outstanding-issue context.
- Check current Git/live state rather than treating that dated snapshot as live data. Update the handoff when meaningful project state changes, without storing secrets.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and API routes (`app/page.tsx`, `app/api/**`).
- `lib/`: pipeline logic and helpers (Docling stub, generating, PPTX/SRT, job store).
- `remotion/`: Remotion compositions used for video rendering.
- `storage/`: local runtime artifacts (`uploads/`, `outputs/`, `jobs.json`), ignored by git.
- `public/`: static assets (currently empty).

## Build, Test, and Development Commands
- `bun run dev`: start local Next.js dev server.
- `bun run build`: production build.
- `bun run start`: run the production server after build.
- `bun run lint`: run ESLint (Next core web vitals + TypeScript rules).
- `bun run remotion:preview`: preview Remotion compositions.
- `bun run remotion:render`: render a Remotion video.

## Coding Style & Naming Conventions
- TypeScript-first; keep files in `app/`, `lib/`, `remotion/`.
- Indentation: 2 spaces; prefer single quotes in TS/JS.
- API routes live under `app/api/<route>/route.ts`.
- UI uses Tailwind classes in `app/page.tsx` and global styles in `app/globals.css`.
- Linting: `eslint.config.mjs` (Next core web vitals + TypeScript). Fix lint errors before committing.

## Testing Guidelines
- No automated tests are configured yet.
- If you add tests, document the framework and add scripts in `package.json`.

## Commit & Pull Request Guidelines
- No commit history is present yet; no existing message convention to follow.
- Recommended: use Conventional Commits (e.g., `feat: add docling adapter`).
- PRs should include a short description, linked issues (if any), and screenshots for UI changes.

## Security & Configuration Tips
- External services are optional; configure via `.env`/`.env.local` (see `.env.example`):
  - `DOCLING_URL` for PDF parsing.
  - `QWEN_API_KEY` for LLM summarization (stubbed today).
  - `REMOTION_RENDER_ENABLED` to enable MP4 generation in the pipeline.
- Uploaded PDFs and generated outputs are stored under `storage/` on the local filesystem.

# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and API routes (`app/page.tsx`, `app/api/**`).
- `constants/`: shared constants and configuration values.
- `lib/`: pipeline logic and helpers (MinerU PDF parsing, generating, rendering, job store).
- `storage/`: local runtime artifacts (`uploads/`, `outputs/`, `jobs.json`), ignored by git.
- `public/`: static assets (currently empty).

## Build, Test, and Development Commands
- `bun run dev`: start local Next.js dev server.
- `bun run build`: production build.
- `bun run start`: run the production server after build.
- `bun run lint`: run ESLint (Next core web vitals + TypeScript rules).

## Coding Style & Naming Conventions
- TypeScript-first; keep files in `app/` and `lib/`.
- Indentation: 2 spaces; prefer single quotes in TS/JS.
- API routes live under `app/api/<route>/route.ts`.
- UI uses Tailwind classes in `app/page.tsx` and global styles in `app/globals.css`.
- Linting: `eslint.config.mjs` (Next core web vitals + TypeScript). Fix lint errors before committing.

## Testing Guidelines
- Unit tests: Vitest (`bun run test`, `bun run test:watch`, `bun run test:coverage`).
- E2E tests: Playwright (`bun run test:e2e`).
- Tests live in `tests/unit/` and `tests/e2e/`.

## Commit & Pull Request Guidelines
- No commit history is present yet; no existing message convention to follow.
- Use Conventional Commits (e.g., `feat: add mineru adapter`).
- PRs should include a short description, linked issues (if any), and screenshots for UI changes.

## Security & Configuration Tips
- External services are optional; configure via `.env`/`.env.local` (see `.env.example`):
  - `MINERU_API_KEY` for PDF parsing (MinerU cloud API).
  - `QWEN_API_KEY` for LLM summarization.
- Uploaded PDFs and generated outputs are stored under `storage/` on the local filesystem.

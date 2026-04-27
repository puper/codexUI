# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-27
**Commit:** 5b34728
**Branch:** main

## OVERVIEW
Codex web UI bridge — Vue 3 SPA + Express CLI server. Exposes Codex app-server workflows in a browser. Published as `codexapp` on npm. Stack: Vue 3.5 / Vite 6 / TypeScript 5.7 / Tailwind 4 / Express 5.

## STRUCTURE
```
codexUI/
├── src/
│   ├── main.ts              # Vue 3 entry point
│   ├── App.vue              # Root orchestrator (~3000 lines, all route views)
│   ├── style.css            # Tailwind v4 entry + global dark-theme overrides
│   ├── components/
│   │   ├── content/         # 19 files: ThreadConversation, ThreadComposer, SkillsHub, ReviewPane...
│   │   ├── icons/           # 22 Tabler SVG icons (pure template SFC, 12-line standard)
│   │   ├── sidebar/         # 4 files: ThreadTree, ThreadControls, MenuRow
│   │   └── layout/          # DesktopLayout (responsive, slot-driven, 169 lines)
│   ├── composables/
│   │   ├── useDesktopState  # Central state hub (5068 lines, 240+ sub-functions)
│   │   ├── useUiLanguage    # i18n en/zh-CN (419 lines)
│   │   ├── useMobile        # 768px responsive breakpoint
│   │   ├── useDictation     # Web Audio API → Whisper transcription
│   │   └── useGithubSkillsSync  # Firebase OAuth + GitHub skill sync
│   ├── api/                 # codexGateway (RPC client, 2751 lines) + normalizers + errors
│   ├── server/              # Express HTTP server, RPC bridge, proxies, terminal → SEE src/server/AGENTS.md
│   ├── cli/                 # Commander CLI entry (npx codexapp, 422 lines)
│   ├── router/              # Hash-based Vue Router (3 routes, empty render components)
│   ├── types/               # codex.ts (336 lines, 50+ Ui* domain types)
│   └── utils/               # commandInvocation.ts
├── scripts/                 # 12 dev/build/deploy scripts
├── documentation/           # Auto-generated app-server schema types (reference only, not compiled)
└── llm-wiki/                # LLM-maintained wiki (raw/ immutable, wiki/ synthesized)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add API endpoint | `src/api/codexGateway.ts` + `src/server/` proxy | Frontend gateway + server-side proxy both needed |
| Add Vue component | `src/components/content/` | 19 existing components for pattern reference |
| Change thread rendering | `src/components/content/ThreadConversation.vue` | 5357 lines — extract sub-components if possible |
| Add icon | `src/components/icons/` | Copy `IconTablerFolder.vue` as template (12-line standard) |
| Modify server behavior | `src/server/codexAppServerBridge.ts` | 5121-line god class — prefer extracting new modules |
| Change routing | `src/router/index.ts` + `App.vue` computed props | Router defines URLs only; views are conditional-rendered |
| Add application state | `src/composables/useDesktopState.ts` | 5068-line god composable — prefer new composables |
| Add translations | `src/composables/useUiLanguage.ts` | Add to `zhCN` record (~400 entries) |
| Server-side logic | `src/server/` → see `src/server/AGENTS.md` | Express middleware, bridge, proxies, terminal |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `createApp(App)` | entry | `src/main.ts` | Vue 3 bootstrap + ServiceWorker |
| `App.vue` | component | `src/App.vue` | Root orchestrator, all 3 route views |
| `useDesktopState()` | composable | `src/composables/useDesktopState.ts` | All application state (no Pinia/Vuex) |
| `createServer()` | factory | `src/server/httpServer.ts` | Express app factory |
| `startServer()` | CLI action | `src/cli/index.ts` | `npx codexapp` entry |
| `rpcCall()` | API client | `src/api/codexRpcClient.ts` | JSON-RPC POST to `/codex-api/rpc` |
| `codexGateway.ts` | API gateway | `src/api/codexGateway.ts` | 93 exported functions |
| `normalizers/v2.ts` | transform | `src/api/normalizers/v2.ts` | DTO → UiMessage/UiThread |
| `codex.ts` | types | `src/types/codex.ts` | All `Ui*` domain types (336 lines) |
| `style.css` | styles | `src/style.css` | Tailwind v4 entry + `:root.dark` overrides |

## CONVENTIONS (Code)

- **No store library** — state via composables (no Pinia, no Vuex)
- **All components `<script setup lang="ts">`** — zero Options API
- **No barrel files** in `components/` — direct named imports
- **Hash routing** (`createWebHashHistory`) — URL-driven but component-conditional rendering
- **Dual-entry build**: Vite (frontend → `dist/`) + tsup (CLI ESM → `dist-cli/`)
- **No ESLint/Prettier** — only `tsconfig.json` `strict: true`
- **Tailwind v4** via `@reference "tailwindcss"` in scoped `<style>`
- **Dark theme**: decisive overrides in `src/style.css` (`:root.dark`), not component-scoped
- **Icons**: `IconTabler{Name}.vue`, 12-line standard SVG with `width="1em" height="1em"`

## COMPLEXITY HOTSPOTS

| File | Lines | Risk | Recommendation |
|------|-------|------|----------------|
| `src/composables/useDesktopState.ts` | 5068 | 🔴 God composable | Split by domain: `useThreads`, `useProjects`, `useReview`, `useSettings` |
| `src/server/codexAppServerBridge.ts` | 5121 | 🔴 God class | Extract: stream capture, session recovery, inline sanitizer |
| `src/api/codexGateway.ts` | 2751 | 🟡 Flat file | Split by domain: `threads.ts`, `accounts.ts`, `plugins.ts`, `skills.ts` |
| `src/App.vue` | ~3000 | 🟡 God component | Extract route views to separate components |
| `src/components/content/ThreadConversation.vue` | 5357 | 🟡 Large component | Extract message renderers, tool output blocks |

## COMMANDS

```bash
pnpm run dev              # Vite dev server (0.0.0.0:5173)
pnpm run build            # Full build: frontend + CLI
pnpm run test:unit        # Vitest (3 test files, node env)
pnpm run preview          # Preview production build
```

## NOTES

- **`tests.md`** must be updated after every feature (light + dark theme, step-by-step)
- **Playwright** only when explicitly requested — never for routine tasks
- **CJS smoke test** required for package/runtime changes
- **`documentation/app-server-schemas/`** is auto-generated reference (236 TS + 102 JSON), not compiled
- **NPX testing**: `publish` first, then test `@latest`. Run on Oracle host (A1), not local.

## Git Workflow (Compact)

- Keep both worktrees clean before merge/rebase:
  - feature worktree: `git status --short`
  - main worktree: `git status --short`
- If any merge/rebase is already in progress, abort it first in that worktree:
  - merge: `git merge --abort`
  - rebase: `git rebase --abort`
- Always checkpoint local changes in main worktree before merge/rebase:
  - `git add -A && git commit -m "temp-before-merge-<branch>"`
  - skip only if there are no local changes.
- Standard merge path:
  1. commit task in feature worktree
  2. create/switch feature branch
  3. rebase feature branch on `main`
  4. from main worktree: `git checkout main && git merge --no-ff <feature-branch>`
- If user explicitly asks for a single merge commit, use:
  - `git checkout main`
  - `git reset --hard <pre-merge-main-commit>`
  - `git checkout <feature-branch>`
  - `git rebase main`
  - `git checkout main`
  - `git merge --no-ff <feature-branch> -m "Merge branch '<feature-branch>' into main"`

## Never Blindly Merge (MANDATORY)

- Never use automatic conflict-bias strategies blindly (for example: `git merge -X theirs`, `git merge -X ours`, `git checkout --theirs .`, `git checkout --ours .`).
- If conflicts occur, inspect each conflicted file and resolve intentionally.
- After conflict resolution, run required verification/tests before pushing.

## Conflict Avoidance and Recovery (MANDATORY)

- Do not rebase long-lived mixed-history branches directly onto `main` if it creates broad unrelated conflicts.
- Prefer a fresh branch from `main` + cherry-pick only task-relevant commits.
- If a branch is already checked out in another worktree, rebase/commit there, then merge by branch name from main worktree.
- If merge pulls unrelated conflicts, abort and retry with a narrower commit set.

## package.json / tests.md Conflict Rule

- For any merge/rebase conflict involving `package.json`, always resolve by taking the current local/checkpoint `package.json` entirely (full file replacement) without additional review, then continue merge.
- Treat `package.json` as generated/low-priority for conflict resolution and do not block merge completion on its conflicts.
- If `package.json` has uncommitted changes during merge/rebase workflow, always discard those uncommitted changes and keep the current local/checkpoint `package.json` version.
- For any merge/rebase conflict involving `tests.md`, always resolve by taking the current local/checkpoint `tests.md` entirely (full file replacement) without additional review, then continue merge.
- Treat `tests.md` as low-priority for conflict resolution and do not block merge completion on its conflicts.

## Commit After Each Task

- Always create a commit after completing each discrete task or sub-task.
- Do not batch multiple tasks into a single commit.
- Each commit message should describe the specific change made.

## Pre-Merge Squash Review (MANDATORY)

- Before merging to local `main`, diff-compare all changes on the current branch against `main`.

## Tests Documentation Rule (MANDATORY)

- After every feature implementation, update `tests.md` in the repository root.
- Add a new section describing how to test the feature manually.
- For any new or changed UI, include both light-theme and dark-theme verification steps/results in that test section.
- Each test section must include:
  - feature/change name
  - prerequisites/setup
  - exact step-by-step actions
  - expected result(s)
  - rollback/cleanup notes (if applicable)
- Keep existing test cases; append or update only what is needed for the new feature.
- Do not mark a feature task complete until `tests.md` is updated.

## Completion Verification Requirement (MANDATORY)

- Test changes before reporting completion when feasible.
- For any new or changed UI, always verify both light theme and dark theme before reporting completion.
- Do not treat dark theme as optional polish; dark-theme support is part of the feature being complete.
- When a user asks to "test it" for UI work and a local dev server is available, prefer actually loading the changed route and checking the rendered result instead of stopping at static analysis.
- If a dark-theme screenshot shows light-theme surfaces on a dark page, fix the actual CSS/theme wiring first; do not treat "text is visible" as sufficient.
- Run Playwright verification only when the user explicitly asks for Playwright/browser automation testing.
- If a change affects package/runtime/module loading behavior, also run a CJS smoke test before completion.
- CJS smoke test requirement:
  1. Build the project/artifact first (if needed).
  2. Run a Node `require(...)` check against the changed entry (or closest public CJS entry).
  3. Confirm the module loads without runtime errors and expected exported symbol(s) exist.
  4. Include the exact CJS command and result summary in the completion report.
- For Playwright automation scripts, CJS (`const { chromium } = require('playwright')`) is the default style unless ESM is explicitly required.
- Preferred Playwright verification pattern for chat parsing changes (when Playwright is requested):
  - send a message with a unique marker (for selecting the correct rendered row)
  - include mixed content in one message (for example: plain text, `**bold**`, and `` `code` ``)
  - inspect row HTML and count expected rendered nodes (for example `strong.message-bold-text`)
  - save screenshot to `output/playwright/<task-name>.png`
- Playwright test sequence (when Playwright is requested):
  1. Start or confirm a single dev server instance (`pnpm run dev -- --host 0.0.0.0 --port 4173`).
  2. If there are stale servers on the same port, stop them first to avoid false test results.
  3. Run Playwright CLI against `http://127.0.0.1:4173` (or required test URL) and exercise the changed flow.
  4. For visual/UI changes, capture both light-theme and dark-theme results.
  5. For responsive/mobile changes, run checks at 375x812 and 768x1024.
  6. Wait 2-3 seconds before capturing final screenshot(s).
  7. Save screenshots under `output/playwright/` with task-specific names.
- Capture screenshots only when Playwright verification is requested.
- If the dev server fails to start due to pre-existing errors, fix them first or work around them before testing.
- If requested Playwright assertions fail, do not report completion; fix and re-run until passing.

## Browser Automation: Prefer Playwright CLI Over Cursor Browser Tool

- For all browser interactions (navigation, clicking, typing, screenshots, snapshots), prefer the Playwright CLI skill in headless mode over the Cursor IDE browser MCP tool.
- Do not run Playwright for routine task completion unless the user explicitly asks for it.
- Playwright CLI is faster, more reliable, and works in headless environments without a desktop.
- Use headless mode by default; only add `--headed` when a live visual check is explicitly needed.
- Skill location: `~/.codex/skills/playwright/SKILL.md` (wrapper script: `~/.codex/skills/playwright/scripts/playwright_cli.sh`).
- Minimum reporting format in completion messages:
  - tested URL
  - viewport(s)
  - assertion/result summary
  - screenshot absolute path(s)
  - CJS command/result (when module-loading behavior was changed)

## Worktree Dev Server Rule

- When working in a git worktree, prefer reusing an existing compatible `node_modules` tree when it is already available instead of triggering a fresh install by default.
- If `node_modules` is symlinked to a shared dependency directory, avoid workflows that prompt to remove and recreate that shared directory just to run `npm run dev` or `pnpm run dev`.
- For dev-server fixes, verify the exact user-requested command afterwards (for example `npm run dev`), not only a fallback Vite invocation.

## Dark Theme CSS Rule

- For shared route surfaces and large feature UIs, prefer putting the decisive dark-theme overrides in the global theme stylesheet (`src/style.css`) instead of relying only on component-scoped `:global(:root.dark)` blocks.
- Scoped dark overrides are fine for truly local elements, but if a full route still looks like light theme in dark mode, add or strengthen the global selectors for that surface.

## NPX Testing Rule

- For any `npx` package behavior test, **publish first**, then test the published `@latest` package.
- Do not rely on local unpublished changes when validating `npx` behavior.
- Run `npx` validation on the Oracle host (not local machine) unless user explicitly asks otherwise.
- For Playwright verification of `npx` behavior, use the Oracle host Tailscale URL (for example `http://100.127.77.25:<port>`) instead of `localhost`.

## A1 Playwright Verification (From Mac via Tailscale)

- Use this flow when validating UI behavior on Oracle A1 from the local Mac machine.
- On A1, start the app server with Codex CLI available in `PATH`:
  - `export PATH="$HOME/.npm-global/bin:$PATH"`
  - `pnpm run dev -- --host 0.0.0.0 --port 4173`
- From Mac, run Playwright against Tailscale URL (`http://100.127.77.25:4173`), not localhost.
- Verify success with both checks:
  - UI assertion in Playwright (new project/folder appears in sidebar or selector).
  - Filesystem assertion on A1 (`test -d /home/ubuntu/<project-name>`).
- Save screenshot artifact under `output/playwright/` and include it in the report.

## Playwright Evidence For UI Fixes

- When the user asks to test with Playwright, run the verification on the explicitly requested project/thread context (for example `TestChat`).
- Screenshot artifacts must show complete passing evidence for the tested feature, not only the base page load.
- For UI work, include dark-theme evidence in addition to the default/light-theme evidence unless the task is explicitly light-only.
- For refresh-persistence fixes, include a post-refresh screenshot that still shows the expected UI state.

## Mandatory CJS + TestChat Validation For Markdown/File-Link Features

- For any markdown parsing, link parsing, file-link rendering, or browse-link encoding change, verification in `TestChat` is mandatory before reporting completion.
- Use CJS Playwright scripts as the default verification implementation:
  - `const { chromium } = require('playwright')`
  - run from repository working directory so local `node_modules` resolves correctly.
- Required validation flow:
  1. Start dev server at `http://127.0.0.1:4173`.
  2. Open project `TestChat`.
  3. Open an existing TestChat thread, or create one if none exists.
  4. Send a message with a unique marker plus target markdown link (example: ``<MARKER> [hosting_manager.py](/home/ubuntu/Documents/New Project (2)/hosting_manager.py)``).
  5. Locate the rendered row by marker.
  6. Assert a parsed file link exists (`a.message-file-link`) in that row.
  7. Assert link metadata is correct:
     - `href` includes encoded full path (example: `/codex-local-browse/home/ubuntu/Documents/New%20Project%20(2)/hosting_manager.py`)
     - `title` equals the original full file path
     - visible link text contains expected filename.
  8. Save screenshot to `output/playwright/testchat-<feature>-cjs.png`.
- Completion report must include:
  - tested URL
  - thread context (`TestChat`)
  - viewport
  - exact CJS command/script path
  - assertion summary (`hrefOk`, `titleOk`, `textOk`)
  - screenshot absolute path

## LLM Wiki Schema

This repository includes a persistent wiki under `llm-wiki/` maintained by an LLM agent.

### Structure
- `llm-wiki/raw/`: immutable source notes and captured material.
- `llm-wiki/wiki/`: synthesized, interlinked markdown pages.
- `llm-wiki/wiki/index.md`: catalog of pages.
- `llm-wiki/wiki/log.md`: append-only operation log.

### Conventions
- Never edit files under `llm-wiki/raw/` after creation.
- Prefer updating existing wiki pages over creating duplicates.
- Add wiki links using relative markdown links.
- Keep factual claims tied to one or more source files in `llm-wiki/raw/`.

### Operations
- Ingest:
  1. Add a source under `llm-wiki/raw/`.
  2. Create or update topic/entity pages under `llm-wiki/wiki/`.
  3. Update `llm-wiki/wiki/index.md`.
  4. Append one entry in `llm-wiki/wiki/log.md`.
- Query:
  1. Read `llm-wiki/wiki/index.md` first.
  2. Read relevant linked pages.
  3. Synthesize an answer and optionally file it back as a page.
- Lint:
  1. Check for orphan pages.
  2. Check for stale or contradictory claims.
  3. Add follow-up questions to the log.

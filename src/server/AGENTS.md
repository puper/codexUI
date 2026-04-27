# src/server/ — Express Backend

**Generated:** 2026-04-27
**Commit:** 5b34728

## OVERVIEW
Express 5 server that bridges browser ↔ Codex app-server. CLI entry (`npx codexapp`) calls `createServer()` from `httpServer.ts`. Built by tsup (ESM, node18) to `dist-cli/`.

## STRUCTURE
```
server/
├── httpServer.ts                    # Express app factory (287 lines)
├── codexAppServerBridge.ts          # Core bridge middleware (5121 lines 🔴)
├── authMiddleware.ts                # Bearer token auth + login rate limiting
├── appServerRuntimeConfig.ts        # Runtime: sandbox, approval policy
├── terminalManager.ts              # PTY session pool (480 lines, node-pty)
├── methodCatalog.ts                 # RPC method directory
├── skillsRoutes.ts                  # Skills install/uninstall/sync (1415 lines)
├── accountRoutes.ts                 # Account CRUD + quota (1063 lines)
├── reviewGit.ts                     # Git diff/review (853 lines)
├── localBrowseUi.ts                 # File browser HTML pages
├── freeMode.ts                      # Custom endpoint provider config
├── unifiedResponsesProxy.ts         # Responses API ↔ Chat API translator
├── customEndpointProxy.ts           # Custom endpoint proxy
├── terminalManager.test.ts          # Vitest: FakePty + boundary tests
└── codexAppServerBridge.inlinePayload.test.ts  # Vitest: inline payload sanitization
```

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Add new API route | `httpServer.ts` + new route module | Register under `/codex-api/` |
| App-server communication | `codexAppServerBridge.ts` | `AppServerProcess` class manages lifecycle |
| Add provider proxy | `*Proxy.ts` pattern | `customEndpointProxy.ts` + `unifiedResponsesProxy.ts` as templates |
| Terminal sessions | `terminalManager.ts` | PTY pool, session attachment/detachment |
| Skills management | `skillsRoutes.ts` | HTTP routes for install/uninstall/sync |
| Account operations | `accountRoutes.ts` | Switch, remove, quota polling |
| Git review | `reviewGit.ts` | `git diff` via child_process, structured output |

## CONVENTIONS

- **All modules export a single factory or route handler** — no classes except `AppServerProcess`
- **Proxy pattern**: external provider traffic goes through the custom endpoint proxy unless a dedicated route is truly required
- **Route registration**: `httpServer.ts` calls `app.use('/codex-api/...', handler)`
- **Testing**: Vitest + fake doubles defined inline, no shared test utilities
- **Error handling**: propagate original errors, never mask with generic messages
- **No barrel files** — direct named imports within server/

## ANTI-PATTERNS

- **NEVER** add logic to `codexAppServerBridge.ts` unless unavoidable — extract new modules
- **NEVER** start app-server process outside the bridge's lifecycle management
- **NEVER** hardcode ports — always use `--port` CLI flag

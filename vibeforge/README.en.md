# VibeForge

**Local-first vibecoding for the desktop.** Connect Ollama, pick a model and build software by describing what you
want. VibeForge plans, explores your codebase, writes code, runs commands, tests, reviews diffs, commits and can drive a
browser — all on your own machine.

> **Your code never leaves your computer.** The model runs through Ollama on `localhost`. No telemetry, no sign-in, no
> cloud account. The only traffic that leaves your machine is what you explicitly approve.

[README på svenska](README.md) · [Architecture](docs/architecture.md) · [Safety](docs/safety.md) ·
[Skills](docs/skills.md) · [MCP](docs/mcp.md) · [Releasing](docs/releasing.md) · [TODO](TODO.md)

---

## What it does

| Area             | Capability                                                                                                                                                                                                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Model**        | Ollama over the OpenAI-compatible API (`/v1/chat/completions`) with streaming, tool calling and detection of models without tool support.                                                                                                                                                           |
| **Agent loop**   | Context build → model reply → tool calls → execution → tool results → reflection → next turn or final answer.                                                                                                                                                                                       |
| **Tools**        | `list_files`, `read_file`, `search_files`, `create_file`, `write_file`, `edit_file`, `delete_file`, `run_terminal_command`, `run_tests`, `git_status`, `git_diff`, `git_commit`, `git_branch`, `web_fetch`, `browser_open/read/screenshot/click/fill`, `ask_user` — plus every MCP tool you enable. |
| **Context**      | Repo map, local embeddings, import and symbol analysis, import neighbours, pinned files and a hard context budget. Only what is needed is sent to the model.                                                                                                                                        |
| **Review**       | Every file change is shown as a diff — as a proposal in the approval and as history in the right panel.                                                                                                                                                                                             |
| **Extension**    | Skills (Markdown in `.vibeforge/skills/`), project rules (`AGENTS.md`, `.vibeforge/rules.md`), project memory (`.vibeforge/memory.md`), hooks and MCP (stdio, HTTP, SSE).                                                                                                                           |
| **Subagents**    | Explorer, Implementer, Tester, Reviewer and Documenter with isolated context and short summaries back.                                                                                                                                                                                              |
| **Git**          | Status, branches, diff, commits with AI-written messages and a code review mode.                                                                                                                                                                                                                    |
| **Distribution** | Windows `.exe` (NSIS), macOS `.dmg`, Linux `.AppImage`/`.deb`, a Doctor mode, onboarding and a public website.                                                                                                                                                                                      |

## Getting started

**Requirements:** Node 22.5+, [Ollama](https://ollama.com) and a model with tool calling. Building the desktop app also
needs Rust and the Tauri dependencies.

```bash
# 1. Pull a model that supports tool calls
ollama pull qwen2.5-coder:7b

# 2. Clone and install
git clone https://github.com/vibeforge/vibeforge.git
cd vibeforge
npm install

# 3. Run the agent and the desktop UI
npm run dev
```

`npm run dev` starts the agent on `127.0.0.1:4319` (a token is required in `x-vibeforge-token`) and the UI on
`http://127.0.0.1:1420`. On first launch you get an onboarding flow: consent for local data handling, the Ollama
connection, a project folder, and an **optional** choice about the sponsored slot in the chat.

Check the environment at any time:

```bash
npm run doctor
```

```text
✓ Node.js: v24.19.0
✓ Local data directory: C:\Users\you\.vibeforge is writable
✓ Project directory: … (14 entries)
✓ Free disk space: 483845 MB
✓ Git: git version 2.54.0.windows.1
✓ Test command: vitest run
✓ Ollama: http://localhost:11434 (v0.40.5), 2 models
```

## The vertical slice

```
you: "Read package.json and create src/hello.ts"
  → context built (2 files, 24 chars)
  → tool_call read_file { path: "package.json" }
  → tool_result  (3 lines)
  → tool_call write_file { path: "src/hello.ts", content: … }
  → diff         src/hello.ts  +1 −0   (waiting for you)
  → approval     → the file is written
  → assistant_message "Done. I created src/hello.ts …"
```

Every step is visible: context in the centre panel, diffs and approvals on the right, everything in the log, and all
terminal output in the terminal panel.

## Safety model

Four permission modes:

| Mode                     | File changes                                     | Commands          |
| ------------------------ | ------------------------------------------------ | ----------------- |
| **Ask always** (default) | Requires approval                                | Requires approval |
| **Auto-edit**            | Written after the diff has been shown and logged | Requires approval |
| **Auto-run**             | Written immediately                              | Run immediately   |
| **Full auto**            | Written immediately                              | Run immediately   |

**In every mode, including full auto, these are blocked:**

- `rm -rf`, `sudo`, `format` and other destructive commands,
- writes and deletions outside the project root,
- exposing ports and sending secrets to external services.

On top of that: every file change produces a diff, every command is visible in the terminal, approve/reject is logged in
the session, browser automation needs its own approval, and MCP servers stay off until you enable them per project. See
[Safety](docs/safety.md) for details.

## Architecture

```
apps/desktop      Tauri 2 + React + Tailwind. Starts the agent and injects URL + token into the webview.
apps/web          Public website (Next.js, statically exported).
packages/protocol Shared types, tool schemas, events and IPC contracts.
packages/agent-core  Agent loop, tools, context engine, skills, memory, MCP, subagents, hooks, SQLite.
packages/agent-server HTTP + SSE on 127.0.0.1 with token and origin checks.
```

Everything runs in one Node process on your machine. The desktop app starts the agent, waits for `/api/health` to answer
and then injects the base URL and token into the webview. More in [Architecture](docs/architecture.md).

## Skills, rules and memory

- **Skills** are Markdown files with YAML front matter in `.vibeforge/skills/`. Ten are included (React component,
  Next.js page, API endpoint, Python script, bug fix, test writing, code review, refactoring, documentation, database
  migration). They activate on triggers or via `@skillname`.
- **Rules** are read automatically from `AGENTS.md`, `.vibeforge/rules.md` and `.vibeforge/preferences.json` and
  injected into the system prompt.
- **Memory** lives in `.vibeforge/memory.md` — local, readable and versioned with your code.

Edit all of it in the app (the Skills, Memory and Settings dialogs) or directly in the files. More in
[Skills](docs/skills.md).

## MCP, subagents and hooks

- **MCP**: add servers per project over stdio, HTTP or SSE. Tools, resources and prompts from a server show up as regular
  agent tools. Example configuration for filesystem, GitHub, Postgres, Playwright and web search is included in the MCP
  dialog. More in [MCP](docs/mcp.md).
- **Subagents**: `explorer`, `implementer`, `tester`, `reviewer`, `documenter`. They run with isolated context and return
  short summaries; their status is shown in the left panel.
- **Hooks**: run commands on `on_session_start`, `before/after_file_edit`, `before/after_terminal_command`,
  `before/after_test_run` and `before/after_commit` — for example ESLint after every edit or tests before a commit.

## The sponsored slot

The ad slot is a separate component with a deliberately minimal API: it receives **only a number** (the count of user
prompts) and has no access to prompts, files, context or answers.

- Shown by default after every 10th prompt — and only if you consented during onboarding.
- Always labelled **Sponsored** and visually separated from AI answers, never inside a reply.
- Can be turned off in settings (and from the command palette).
- Providers: `none`, `custom` (the default in the app) and `adsense` (disabled in the desktop app).
- No prompts, files or project data are sent to any ad network, and clicks are never tied to an identity.
- The website has reserved ad slots that only activate if `NEXT_PUBLIC_ADSENSE_CLIENT` is set at build time.

## Commands

```bash
npm run dev            # agent + desktop UI
npm run dev:server     # agent only (127.0.0.1:4319)
npm run dev:web        # public website (127.0.0.1:4320)
npm run doctor         # environment check (Node, Git, Ollama, model, disk, data dir)
npm run typecheck      # tsc --noEmit across all packages
npm run lint           # ESLint
npm run format         # Prettier
npm test               # Vitest (unit tests + API/UI tests in jsdom)
npm run test:e2e       # Playwright (starts the agent, a fake Ollama and vite)
npm run icons          # generate app icons (PNG/ICO/ICNS)
npm run sidecar:build  # package the agent as a standalone binary (Node SEA)
npm run tauri build    # build .exe/.dmg/.AppImage/.deb
npm run verify         # typecheck + lint + tests
```

## Testing

```bash
npm run verify      # everything CI runs except E2E
npm run test:e2e    # end-to-end in a browser and over HTTP
```

- **Unit tests** (Vitest) cover the tools, the approval policy, the context engine, skills, rules, memory, the MCP client
  (against a real process over stdio), subagents, hooks, the SQLite layer, the HTTP surface and the React components.
- **E2E** (Playwright) runs the vertical slice against the real agent with a fake Ollama: prompt → read file → proposal →
  approval → diff → written file → answer, both over HTTP and through the UI. No network and no real model required.

## Known limitations and TODO

- [ ] **Code signing**: Windows Authenticode and Apple notarization. Without it the OS warns on install.
- [ ] **Auto-update**: set `plugins.updater.active = true`, add a `pubkey` and a real `endpoints` URL.
- [ ] **Telemetry**: deliberately off (`telemetry: false`) and not toggleable from the UI.
- [ ] **Pro features**: shared skills across projects, team memory and remote agents behind a paid licence.
- [ ] **More models**: a cloud transport (OpenAI/Anthropic) behind the same `ChatTransport` interface — requires
      explicit consent per project.
- [ ] **Embeddings**: a real vector model instead of the local hash-based vector.
- [ ] **The Rust shell**: `apps/desktop/src-tauri` is written but has not been compiled in this environment (no Rust
      toolchain). Run `npm run tauri build` on a machine with Rust to verify it.

Full list in [TODO.md](TODO.md).

## Licence

MIT.

# atomik-dsl

The **atomik** DSL — a human-readable, cheap-LLM-generatable visualization language for learning — developed as a standalone dual-plane repository (same template as the main Atomik repo) until it is vendored into the workbench as `packages/dsl-core` (main-repo milestone M12).

Quickstart:

```bash
npm test                    # 54 tests: golden-IR parity + runtime oracle + layout geometry (cycle, flow)
npm run build:prototype     # rebuilds apps/prototype-cycle/index.html from sources
open apps/prototype-cycle/index.html   # end-to-end cycle prototype, no install
```

Start reading at `AGENTS.md` (bootstrap protocol) and `docs/bedrock/00_00-orientation.md` (map and reading order). Execution state lives in `atomik-project/coding-paths/` — never in a chat thread.

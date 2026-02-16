# Weaver

Visual graph programming language and AI-powered development platform.

## Weaving Lexicon

All code uses this vocabulary exclusively. Never use generic terms like "node", "edge", "graph", "namespace", "boundary".

### Structure
- **Weave** — a complete program/graph (the woven fabric)
- **Knot** — a node where threads meet (tied point)
- **Thread** — an edge/connection (warp or weft strand)
- **Gate** — a conditional thread (controls passage)
- **Wave** — data token flowing through the graph (motion of fabric through the loom)
- **Strand** — namespace/module grouping (bundle of fibers)
- **Threshold** — trust/sandbox boundary (bar of the loom frame)
- **Enclave** — trusted sandbox within a threshold

### System
- **Loom** — compiler/build step
- **Weaver** — runtime/interpreter
- **Spindle** — scheduler (time + concurrency)
- **Braid** — concurrent execution/interleaving

### Glamour
- **Glamour** — a metaphorical visual representation veiling complexity (enchantment that makes something appear different)
- **Unveil** — remove a glamour to see the underlying structure (lift the veil)
- **Enchant** — apply a glamour to a knot or subgraph (cast the visual transformation)
- **Facade** — the interactive surface of a glamour (clickable metaphorical controls mapped to graph operations)

### Operations (pure functions: `(weave, ...args) => Weave`)
- `mark` — create a knot
- `thread` — connect two knots
- `branch` — fork from one knot to many
- `join` — merge paths into one knot
- `span` — bridge disconnected knots
- `knot` — close a cycle
- `gate` — add condition to a thread
- `veil` — abstract a subgraph
- `reveal` — expand an abstraction
- `snip` — remove a thread
- `cut` — remove a knot and its threads
- `trace` — execute/follow a path

## Architecture

```
packages/
  core/       — types, operations, helpers, serialization (63 tests)
  runtime/    — Wave flow, trace, gate-eval, Spindle, Braid
  adapters/   — ComfyUI + n8n bidirectional format translators
  glamour/    — Glamour engine: types, renderers, themes, facades, asset resolution
  server/     — Express API (port 4444) + WebSocket + file watcher
  app/        — React + Vite frontend (port 5173) with @xyflow/react
  mcp/        — MCP server exposing 16 Weaver tools to Claude Code
data/
  graphs/     — .weave.json files (saved Weave graphs)
  schemas/    — UI layout schemas (JSON)
  output/     — ComfyUI generated images + glamour assets
docs/
  vision.md   — Full architecture vision and phase plan
services/
  comfyui/    — ComfyUI local install (install.bat/start.bat)
  n8n/        — n8n local install (install.bat/start.bat)
ComfyUI-LOKI/ — ComfyUI extension with glamour overlay prototype (git submodule)
```

## Conventions

- **TypeScript** throughout, strict mode, `NodeNext` module resolution
- **Pure functions** for all graph operations (never mutate, return new Weave)
- **Filesystem-first** — graphs stored as `.weave.json` in `data/graphs/`
- **npm** with single root `package.json` (no workspaces — exFAT drive has no symlink support)
- **Node.js subpath imports** (`#weaver/core`, `#weaver/runtime`, `#weaver/adapters`) for cross-package imports — defined in root `package.json` `"imports"` field
- **TypeScript project references** with `tsc -b` for type-checking
- **Vitest** for testing (63 tests across core + runtime)
- **No database** — JSON files only
- File extension for weave graphs: `.weave.json`

## Development

```bash
npm install           # Install all dependencies
npm run dev           # Start server (4444) + frontend (5173)
npm test              # Run all tests
npm run typecheck     # Type-check all packages (tsc -b)
```

## Server API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/graphs` | List saved weaves |
| `GET /api/graphs/:id` | Load a weave |
| `POST /api/graphs` | Create a weave |
| `PUT /api/graphs/:id` | Update a weave |
| `DELETE /api/graphs/:id` | Delete a weave |
| `POST /api/runtime/trace` | Execute a trace |
| `GET /api/schema/layout` | Read UI layout schema |
| `PUT /api/schema/layout` | Replace UI layout schema |
| `PATCH /api/schema/layout` | Patch UI layout schema |
| `ws://localhost:4444/ws` | WebSocket (graph change + schema broadcasts) |

## MCP Server (Claude Code Tool)

16 tools exposed: `weaver_create`, `weaver_list`, `weaver_load`, `weaver_save`, `weaver_mark`, `weaver_cut`, `weaver_thread`, `weaver_snip`, `weaver_branch`, `weaver_join`, `weaver_span`, `weaver_knot`, `weaver_gate`, `weaver_veil`, `weaver_reveal`, `weaver_trace`

To register as a Claude Code MCP server, add to `~/.claude.json` or project `.mcp.json`:
```json
{
  "mcpServers": {
    "weaver": {
      "command": "npx",
      "args": ["tsx", "packages/mcp/src/index.ts"],
      "cwd": "G:/LOKI/LOCUS/SENSUS/weaver"
    }
  }
}
```

## Ports
- Frontend (Vite): 5173
- Server (Express): 4444
- ComfyUI: 4188
- n8n: 5678

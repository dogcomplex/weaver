# Weaver — From Graph Editor to Living Metaphorical Worlds

## Context

Weaver is a visual graph programming platform built across 5 phases — core types, runtime, adapters, server, frontend, MCP, and ComfyUI integration. It's fully functional: you can create knots, connect them, save/load, trace execution, queue to ComfyUI, and see generated images inline. **157 tests pass, server + frontend run, ComfyUI portable with SD 1.5 generates images end-to-end.**

**Phase 1 (Classic Editor) is complete.** Selection, properties panel, deletion, context menus, knot type registry, type-specific rendering, keyboard shortcuts, undo/redo, validation, and ComfyUI service management from the web UI all work.

**Phase 2 (Glamour Engine) is complete.** The `packages/glamour/` package provides the abstraction layer for pluggable renderers. ClassicRenderer extracted from Canvas.tsx, ViewTabs with three-tab switching (Unveiled / ComfyUI / Glamour), wave animation engine, and the foundation for Phase 3's PixiJS glamour renderer.

**Phase 3 (First Glamour — "The Loom") is complete.** PixiJS v8 GlamourRenderer with full Loom theme: 8 hand-crafted SVG assets, facade controls (sliders, dropdowns, text inputs), CSS-synced HTML overlays, Alt+click partial unveil, pan/zoom camera, and click→Properties Panel integration. 128 tests passing at completion. The Loom metaphor scored ~3/10 on our own quality criteria — a useful exercise that informed the Phase 4 metaphor engine design.

**Phase 4 (AI Integration) is in progress.** Claude-powered chat panel, SSE streaming with tool execution, MetaphorEngine (the Loci), and ComfyUI asset generation bridge.

**The vision**: Transform Weaver into something that has never been built — a system where workflows manifest as **living, interactive metaphorical worlds**. Factories with conveyor belts, gardens with irrigation, kingdoms with roads and messengers. Non-programmers understand what's happening intuitively because the visual metaphor *clicks*. AI (Claude) builds workflows from natural language, explains them in metaphorical terms, and generates custom visual assets using ComfyUI itself.

**Nobody has done this.** Research confirms: ComfyUI themes are color-only, Factorio-like programming games don't generate real code, Zachtronics games are fixed puzzles, VR city metaphors are view-only. The specific combination of general-purpose graph programming + dynamic metaphorical rendering + AI assistance + extensible theme system is genuinely novel.

---

## The Glamour System — Core Conceptual Framework

A **Glamour** is a metaphorical visual representation that **veils** the underlying complexity of one or more knots. It is the central concept that connects the weaving lexicon to the visual metaphor system.

### Key Principles

1. **Glamours veil complexity.** A glamour replaces the raw node-and-wire view with an intuitive visual metaphor. A perfect glamour represents ALL underlying capabilities of its component(s) in metaphorical form — e.g., a turning gear for numeric settings, a color wheel for color selection — with no confusing or misrepresentative states.

2. **Unveil to see beneath.** Unveil a glamour to reveal the underlying complexity — the original ComfyUI nodes, the raw Weaver graph, and eventually the Python code underneath. This is recursive: unveil the glamour → see ComfyUI nodes → unveil those → see Python → unveil that → assembly → machine code. Each level of abstraction can be veiled/unveiled.

3. **Glamours can span subgraphs.** A glamour can cover a single knot OR a group of knots (a subgraph). If several knots are better represented as a single entity (e.g., "the dyeing station" covering both CLIP encoders), the glamour merges them visually. If a single knot is better split into conceptual parts, the glamour expands it. The `veil` operation from core already supports collapsing subgraphs — glamours are the visual complement.

4. **AI finds the best metaphors.** We give the AI general tools for creating, composing, and manipulating glamours, then let it discover the best metaphorical representations unrestricted. Don't prescribe rigid mappings — let Claude experiment with what *clicks*.

5. **Fractal consistency is the ideal.** A truly spectacular glamour holds at every zoom level. Zoom into a section, split it into its component subgraph of steps, and the metaphor still works fractally at the "smaller" level. For example, in a Loom glamour: the whole weave is a tapestry → zoom into the heddle frame → it's a smaller loom within the loom → zoom into one heddle → it's a single thread manipulation. Often we can't be this elegant and need to mix metaphors at different levels — but it's the aspiration.

6. **Metaphors inform programming and vice versa.** The act of finding good glamours will reveal structural insights about the programs they represent. If a glamour feels awkward, it may indicate a design smell in the underlying workflow. Conversely, well-structured programs naturally yield beautiful glamours.

### The Perfect Glamour

A perfect glamour is **complexity disguised as elegant minimalism**. It is so seamless a metaphor that all the little components and capabilities represented in visual/game/metaphor form blend in and are almost forgotten — they're just instantly grasped by the user, and so don't even need to stand out. Many controls that feel like just one thing, which the user already "knows."

This ties all the way up and all the way down the complexity stack: from the world-level view (a kingdom, a factory floor, a garden) through individual glamoured elements, down through the unveiled node graph, through Python code, to machine instructions. At every level, the glamour should feel natural and inevitable — as if there were no other way it *could* look.

### Lexicon Additions

| Term | Concept | Origin |
|------|---------|--------|
| **Glamour** | A metaphorical visual representation veiling complexity | Enchantment that makes something appear different |
| **Unveil** | Remove a glamour to see the underlying structure | Lift the veil, see through the enchantment |
| **Enchant** | Apply a glamour to a knot or subgraph | Cast the visual transformation |
| **Facade** | The interactive surface of a glamour (clickable controls) | The outward-facing interface |

### Glamour Quality Spectrum

- **Perfect Glamour**: Every underlying capability has a metaphorical interactive representation. No hidden states, no confusion. The metaphor IS the interface. Many controls feel like just one thing. (Aspiration)
- **Good Glamour**: Most capabilities represented, some details glossed over, but the essential flow is intuitive. (Realistic target)
- **Thin Glamour**: Surface-level visual replacement — looks different but doesn't add understanding. (Minimum viable)
- **Broken Glamour**: Misrepresents the underlying behavior, creates confusion. (Avoid)

---

## Existing Prototype: ComfyUI-LOKI Glamour System

We have an existing glamour prototype implemented as a ComfyUI extension at `ComfyUI-LOKI/nodes/glamour/`. This provides a foundation of proven patterns to build on.

### What Exists

**Python backend** (`glamour_node.py`, `glamour_utils.py`):
- `GlamourNode` — a ComfyUI `OUTPUT_NODE` with `enable_controls`, `glamour_state` (All Glamoured/Mixed/All Veiled), and `transparency` inputs
- `GlamourImageManager` — hash-based image ID generation (`{nodeType}_{nodeId}_{hash}`), file lookup with WebP/PNG precedence, storage in `{output}/Glamour/` subfolder
- API endpoints for image path resolution and timestamp-based cache invalidation

**JavaScript frontend** (3 modules, ~1,450 lines):
- `glamour.js` — Core extension: per-node glamour state (`glamourStates` Map), `generateNodeHash()` for deterministic config hashing, overlay creation/positioning via DOMMatrix canvas transforms, master toggle button, state synchronization
- `glamour-ui.js` — Layered visual composition (aurora gradient z:1, image z:2, text z:3), transparency/blend modes, hover-reveal text overlays, animated northern lights fallback
- `glamour-images.js` — Image loading with URL precedence (specific hash → type fallback → rainbow gradient), 1-second polling for asset updates, cache busting

### Reusable Patterns

| Pattern | Prototype Implementation | Weaver Adaptation |
|---------|------------------------|-------------------|
| **Hash-based asset IDs** | `{nodeType}_{nodeId}_{configHash}` | `{knotType}_{knotId}_{dataHash}` for glamour asset caching |
| **Layered composition** | Aurora (z:1) → Image (z:2) → Controls (z:3) | Backdrop → Glamour visual → Facade controls |
| **Canvas transform alignment** | DOMMatrix from canvas context | PixiJS worldTransform (same concept, native support) |
| **Polling + cache bust** | 1s interval, timestamp comparison | WebSocket push (upgrade from polling) |
| **State sync with loop prevention** | `settingWidgetInternally` flag | React state + useEffect deps (cleaner) |
| **Fallback chain** | Hash image → Type image → Rainbow gradient | Hash asset → Type asset → Theme default → Aurora |
| **Transparency blend** | `mixBlendMode: lighten` at 0.85 opacity | Configurable per-theme blend modes |

### What's Missing in the Prototype

- No facade interaction (controls mapped to underlying node parameters)
- No subgraph glamours (only per-node)
- No fractal zoom / nested glamours
- No AI integration for metaphor selection
- Limited to image overlays — no vector/interactive elements
- Widget rendering partially implemented
- No theme system (single hardcoded visual style)

---

## Deployment Strategy: Dual Target

Weaver will exist in two forms that share core code:

### 1. Standalone Weaver Webapp
- Full control over rendering, interaction, layout
- React + PixiJS glamour renderer
- Not constrained by ComfyUI's canvas/widget system
- Primary development target — move fast, experiment freely
- Communicates with ComfyUI/n8n as backend engines via adapters

### 2. ComfyUI Overlay Extension (ComfyUI-LOKI)
- Evolves the existing glamour prototype
- Runs inside ComfyUI's LiteGraph canvas
- Uses ComfyUI's native node system + our overlay layer
- Constrained by ComfyUI's DOM/canvas architecture
- Shares `packages/glamour/` types, themes, and asset pipeline with standalone

### Convergence Plan
- Phase 1-3: Develop in standalone Weaver (unconstrained)
- Phase 3+: Port proven glamour themes back to ComfyUI-LOKI extension
- Share: `packages/glamour/src/types.ts`, theme definitions, asset generation pipeline
- Diverge: rendering layer (PixiJS vs DOM overlay), interaction model (React vs LiteGraph widgets)
- Long-term: Weaver webapp uses ComfyUI as its execution engine, while ComfyUI-LOKI brings glamours to users who prefer ComfyUI's native interface

---

## Engine Abstraction: ComfyUI + n8n

Weaver is engine-agnostic. The adapter layer (`packages/adapters/`) translates between Weaver's Weave format and execution engines.

### ComfyUI (Primary)
- Image generation, model inference, creative workflows
- Bidirectional adapter already implemented and tested
- SD 1.5 portable running on port 4188

### n8n (Secondary — Backburnered)
- Automation, API orchestration, data processing
- Bidirectional adapter already implemented in `packages/adapters/src/n8n/`
- Knot type mappings needed for n8n's node library
- Glamour themes should account for n8n-style knots (API calls as messenger birds, data transforms as workshops, triggers as alarm bells)
- Full implementation deferred, but the architecture must represent n8n workflows without special-casing

### Adapter Contract
Both adapters implement the same interface — any Weave can be translated to either engine format. The glamour system operates on Weave data, never on engine-specific formats. This means a glamour theme works identically whether the underlying engine is ComfyUI, n8n, or something future.

---

## Phase 1: Complete Classic Editor ✅ COMPLETE

All Phase 1 features implemented and working:

- **1A. Selection + Properties Panel** — `useSelection` hook, `PropertiesPanel` with knot/thread editing, `DataEditor` for key-value pairs, `updateKnot`/`updateThread` actions
- **1B. Deletion** — Delete/Backspace removes selected knot (`cut`) or thread (`snip`)
- **1C. Context Menus** — Right-click on knots (Edit Label, Duplicate, Delete), threads (Edit Label, Add/Edit Gate, Delete), canvas (Add Knot)
- **1D. Knot Type Registry** — `KnotTypeDefinition` with categories, colors, ports. ComfyUI types auto-registered. `CATEGORY_META` for visual styling.
- **1E. Type-Specific Rendering** — `KnotNode.tsx` renders with category colors, type labels, styled handles
- **1F. Keyboard Shortcuts** — Delete, Ctrl+Z/Y undo/redo, Ctrl+S save, Escape clear selection
- **1G. Validation** — `validateWeave()` with error/warning visual indicators
- **ComfyUI Service Management** — Start/stop ComfyUI from sidebar, live log streaming, queue to ComfyUI

**63 tests pass. All Phase 1 features verified working.**

---

## Phase 2: Glamour Engine ✅ COMPLETE

Decoupled graph data from visual representation. Built the abstraction layer that makes renderer swapping possible.

### 2A. Package: `packages/glamour/` ✅

```
packages/glamour/
  tsconfig.json
  src/
    index.ts              — re-exports all types and functions
    types.ts              — ~250 lines: all glamour type definitions
    registry.ts           — RendererRegistry + ThemeRegistry
    animation.ts          — buildTimeline + interpolateHighlights
    asset-resolver.ts     — hash-based asset resolution with fallback chain
    __tests__/
      registry.test.ts    — 9 tests
      animation.test.ts   — 15 tests
      asset-resolver.test.ts — 14 tests
```

Added `#weaver/glamour` to root `package.json` imports, all tsconfig references, Vite aliases, and vitest config.

### 2B. Core Interface: `WeaveRendererProps` ✅

```typescript
interface WeaveRendererProps {
  weave: Weave
  selection: Selection | null
  traceResult: TraceResult | null
  animationState: AnimationState | null
  onWeaveAction: (action: WeaveAction) => void
  onSelectionChange: (selection: Selection | null) => void
}
```

`WeaveAction` (13-member union) and `Selection`/`SelectionType` extracted from app hooks to `#weaver/glamour`. App hooks re-export for backward compatibility.

### 2C. Core Interface: `GlamourTheme` ✅

Full type definition with `enchantKnot`, `enchantThread`, `enchantWave`, `canMerge`, `enchantSubgraph`, `describeWeave`, `describeKnot`, `sceneConfig`, and `aiSystemPrompt`. Runtime implementation deferred to Phase 3 (needs PixiJS renderer).

### 2D. Asset Resolution ✅

`GlamourAssetResolver` class with:
- `hashKnotConfig(knot)` — deterministic djb2 hash from LOKI prototype
- 4-level fallback chain: exact hash → knot type → theme default → aurora gradient
- Register, invalidate, clear operations
- Configurable base path

### 2E. ClassicRenderer Extraction ✅

Surgical extraction of `Canvas.tsx` into `packages/app/src/renderers/ClassicRenderer.tsx`:
- Implements `WeaveRendererProps` interface
- No internal `useWeave()` — receives weave + dispatch as props
- `ReactFlowProvider` moved inside (only ClassicRenderer uses `useReactFlow()`)
- Consumes `animationState?.activeKnots/activeThreads` for highlight rendering
- `Canvas.tsx` replaced with backward-compat re-export

Highlight rendering added to:
- `KnotNode.tsx` — CSS box-shadow glow (color from highlight, pulse animation)
- `ThreadEdge.tsx` — animated stroke color/width, glow layer, dash progress

### 2F. Three-Tab Switching: Unveiled / ComfyUI / Glamour ✅

`ViewMode = 'unveiled' | 'comfyui' | 'glamour'`

**ViewTabs component** — tab bar above canvas with three tabs:
- **Unveiled** (active) — ClassicRenderer showing raw Weaver graph
- **ComfyUI** (enabled) — native ComfyUI graph view
- **Glamour** (disabled, "Phase 3" badge) — placeholder for PixiJS renderer

**ComfyUIRenderer** — shows the current Weave in ComfyUI's native format:
- When ComfyUI service is running: embedded iframe loading ComfyUI's web UI on :4188
- When ComfyUI is offline: formatted JSON viewer showing the `toComfyUIApi()` output with collapsible per-node sections, syntax highlighting, and node counts
- Status indicator shows service state (running/starting/stopped/error)

**App.tsx restructured** — `ViewTabs` + conditional renderer mounting. Shared `rendererProps` object. All panels (Sidebar, Properties, Trace, Image) are renderer-agnostic.

### 2G. Facade Interaction ✅ (Types only)

`FacadeDefinition`, `FacadeControl` (8 control types: dial/slider/toggle/select/color/text/button/display), `FacadeBinding` with knot data path bindings, transforms, min/max/step. Runtime interaction deferred to Phase 3 (facades need a Glamour renderer to render them).

### 2H. Wave Animation Engine ✅

**`packages/glamour/src/animation.ts`**:
- `buildTimeline(traceResult, options?)` — converts TraceResult → AnimationTimeline with colored events per step (wave=#4af, gate pass=#4a4, gate block=#c44, arrive=#4a4)
- `interpolateHighlights(timeline, progress)` — returns Maps of KnotHighlight and ThreadHighlight at any 0-1 progress position

**`packages/app/src/hooks/useWaveAnimation.ts`**:
- `requestAnimationFrame` loop driving progress 0→1 over timeline duration
- Auto-plays when `traceResult` changes
- Returns `{ animationState, play, stop }`

Wired into `App.tsx` — `useWaveAnimation(traceResult)` feeds `animationState` to all renderers.

### Verification

- **101 tests pass** (63 existing + 38 new glamour tests)
- `npm run typecheck` clean across all packages
- Tab switching: Unveiled ↔ ComfyUI ↔ Glamour (disabled)
- Unveiled tab: all Phase 1 features work unchanged
- ComfyUI tab: shows iframe when service running, JSON fallback otherwise
- Glamour tab: shows Phase 3 placeholder
- Wave animation: trace result → knots/threads highlight with colored glows

---

## Phase 3: First Glamour — "The Loom" ✅ COMPLETE

The weaving lexicon from CLAUDE.md IS the first glamour theme. The names we already use became literal visual elements.

### 3A. Technology: PixiJS v8 ✅

PixiJS v8 with direct API (no @pixi/react — it doesn't support v8 yet). WebGL rendering with sprite composition, pan/zoom camera, and interactive events.

### 3B. Loom Theme ✅

```
packages/glamour/src/themes/loom/
  index.ts   — LoomTheme implementing GlamourTheme interface
  assets/    — 8 hand-crafted SVGs: spindle, dye-vat, heddle-frame,
               winding-frame, cloth-beam, fiber-bundle, shuttle, tied-knot
```

Full GlamourTheme implementation with `enchantKnot`, `enchantThread`, `enchantWave`, `describeWeave`, `describeKnot`, `aiSystemPrompt`, and facade controls. 27 tests in `loom-theme.test.ts`.

### 3C. GlamourRenderer ✅

`packages/app/src/renderers/GlamourRenderer.tsx` (~865 lines):
- Creates PixiJS Application on mount, manages world container + camera
- For each knot: loads SVG sprite via `theme.enchantKnot()`, places at world coordinates
- For each thread: draws colored bezier curves via `theme.enchantThread()`
- **Facade controls**: CSS-synced HTML overlays (sliders, dropdowns, text inputs) positioned in world space via CSS transform mirroring
- **Click → selection**: `pixiClickedRef` bridges PixiJS FederatedEvent and DOM click systems
- **Alt+click**: partial unveil — shows original knot type/label beneath the glamour
- **Pan/zoom**: wheel zoom, middle-mouse-drag pan, fit-to-view on load
- **Scene diffing**: compares current sprites against incoming weave, adds/removes/repositions

### 3D. Lessons Learned: Loom Metaphor Quality ≈ 3/10

The Loom metaphor exposed critical quality gaps:
- "Dye Vat" for text prompts has weak **explanatory power** — a non-programmer doesn't get it
- Steps/CFG as generic sliders with opaque labels lacks **truthfulness** — controls don't map intuitively
- Missing scheduler, sampler_name, denoise = poor **completeness**
- "Passes"/"Tension" labels don't convey what changing them does = low **intuitive interaction**
- Thread colors worked, individual elements didn't decompose = mixed **fractal consistency**

This experience directly informed the Phase 4 MetaphorEngine design: we need to evaluate and iterate on metaphors, not ship the first idea.

### 3E. ComfyUI Infrastructure (Deferred)

Model management, workflow templates, and dependency resolution (3G in original plan) deferred to a future phase. The existing SD 1.5 portable setup and manual workflow management work for current needs.

### Verification (Phase 3)

- ✅ Load demo-txt2img → switch to Glamour tab → loom scene renders
- ✅ Click loom elements → selects corresponding knot → Properties Panel opens
- ✅ Facade controls (sliders, dropdowns, text) modify underlying knot data
- ✅ Alt+click → partial unveil shows original knot beneath glamour
- ✅ Pan/zoom camera with fit-to-view
- ✅ Facade overlays stay aligned during pan/zoom (CSS transform mirroring)
- ✅ Switch to Unveiled tab → same graph, classic node rendering
- ✅ 128 tests pass (101 from Phase 2 + 27 Loom theme tests)

---

## Phase 3+: ComfyUI Native Graph Tab Evolution

The ComfyUI tab added in Phase 2 is the foundation. It evolves in later phases:

### Bidirectional Editing (Phase 3+)
Changes made in the ComfyUI iframe propagate back to the Weave via `fromComfyUIWeb()`. This creates a live bridge: edit in Weaver's Unveiled view OR in ComfyUI's native UI, both stay in sync. The ComfyUI tab becomes a full editing environment, not just a viewer.

### Unveiling Stack (Phase 5)
The ComfyUI tab becomes one layer in the unveiling stack:
```
Glamour → Unveiled (Weaver graph) → ComfyUI (native graph) → Code (Python)
```
Each level is a tab showing the same workflow at a different abstraction depth. The tabs represent unveiling: strip away the glamour to see nodes, strip away nodes to see ComfyUI's native format, strip that away to see Python code.

---

## Phase 4: AI Integration — In Progress

Two AI roles in the Weaver system:
- **The Weaver**: Sonnet/Opus developer brain. Builds workflows from conversation, picks out the right ComfyUI nodes, tunes parameters, wires things correctly. Needs deep technical understanding and tool-calling.
- **The Loci**: Haiku-class ambient spirit. Inhabits the space. Reads the weave schema, the user context, the session mood. Adjusts glamours dynamically as it sees fit. Doesn't edit code — it only outputs MetaphorManifests (structured JSON). Cheap enough to always be watching.

This separation is the key to scaling beyond a dev tool. In a live site/game/group session, the Weaver only fires when functionality needs to change. The Loci runs continuously, tuning the visual metaphor to the current context.

### 4A. Server AI Route ✅

`packages/server/src/routes/ai.ts` — Express router at `/api/ai`:
- **`POST /chat`**: SSE streaming chat with Claude. Agentic tool loop — keeps calling until no more tool_use stop reasons.
- **`GET /status`**: Returns whether API key is configured, model name, tool count.
- **15 tool definitions**: All graph operations (`weaver_create`, `weaver_mark`, `weaver_thread`, `weaver_cut`, `weaver_snip`, `weaver_branch`, `weaver_join`, `weaver_gate`, `weaver_trace`, `weaver_list`, `weaver_load`) + glamour tools (`weaver_describe_weave`, `weaver_describe_knot`, `weaver_suggest_metaphor`, `weaver_refine_metaphor`).
- Theme-aware system prompt: injects active theme's `aiSystemPrompt` + weave context.
- Tool executions broadcast weave changes via existing WebSocket.

### 4B. MetaphorEngine — The Loci ✅

**Types** in `packages/glamour/src/metaphor-engine.ts`:
- `WeaveSchema`, `WeaveSchemaKnot`, `WeaveSchemaThread` — structural workflow summary
- `MetaphorContext` — audience, session type, mood, domain
- `MetaphorManifest` — complete theme specification with mappings, thread styles, scores
- `MetaphorScores` — 5 weighted criteria (explanatory power 0.30, truthfulness 0.25, completeness 0.20, intuitive interaction 0.15, fractal consistency 0.10)
- `MetaphorStability` — controls how much the Loci can change (`locked` / `guided` / `adaptive`)
- `MetaphorEngine` interface — `propose()`, `refine()`, `reevaluate()`
- Helper: `weaveToSchema()` extracts schema from a Weave
- Helper: `calculateOverallScore()` computes weighted average

**Implementation** in `packages/server/src/agents/metaphor-agent.ts`:
- `LLMMetaphorEngine` class implementing `MetaphorEngine`
- Uses Haiku model by default for cheap, fast metaphor generation
- Focused system prompt with scoring criteria learned from the Loom 3/10
- Produces valid JSON manifests with honest self-scoring

### 4C. AI-Generated Glamour Assets ✅

`packages/server/src/agents/asset-generator.ts`:
- `generateAsset(prompt, knotType, knotId, size)` — builds minimal txt2img ComfyUI workflow, queues it, caches result
- `generateManifestAssets(manifest, knotIdMap)` — batch generation from MetaphorManifest, fire-and-forget background jobs
- Hash-based caching in `data/output/glamour-assets/{hash}.png` (djb2 hash of prompt + knot type)
- WebSocket broadcast on completion: `{ type: 'glamour-asset', knotId, hash, url }`
- Static serving at `/api/output/glamour-assets/`

### 4D. AIChatPanel ✅

`packages/app/src/components/AIChatPanel.tsx`:
- Collapsible right-side panel toggled via "AI" button in ViewTabs header
- Message history: user messages (right-aligned), assistant messages (left-aligned)
- SSE stream consumption: text deltas, tool use cards, tool results
- Tool call cards: collapsible, show tool name + result JSON
- Streaming indicator (pulsing dots)
- Sends current weaveId + themeId (when in Glamour view) with each message
- Status check: shows setup instructions when `ANTHROPIC_API_KEY` not set

Wired into `App.tsx`: AI panel replaces Properties panel when open, "AI" button in header bar.

### 4E. Glamour Narration ✅ (Wiring)

- When Glamour view is active, themeId is sent with chat messages
- System prompt includes the active theme's `aiSystemPrompt`
- Claude narrates using theme vocabulary: `describeWeave()` and `describeKnot()` available as tools
- Without a theme active, Claude uses standard weaving terminology

### Phase 4 Verification

- ✅ `npm install` — @anthropic-ai/sdk installed
- ✅ `npx tsc -b` — typecheck clean across all packages
- ✅ `npx vitest run` — 157 tests pass (128 existing + 29 new)
- Set `ANTHROPIC_API_KEY` env var → AI chat panel activates
- Type "Create a simple txt2img workflow" → Claude builds knots + threads via tools → weave appears in all views
- AI narrates using active theme vocabulary
- `weaver_suggest_metaphor` → Loci proposes ranked metaphors with honest scores
- Without API key → chat panel shows setup instructions, all other features work

### Phase 4 — Future Work

- **Background Loci watcher**: Re-scores when weave changes, pushes updated manifests via WebSocket
- **Group sessions**: Multiple users vote on metaphor quality, engine adjusts
- **MetaphorManifest → runtime GlamourTheme**: Convert Loci output to a live-rendered theme
- **Browser-only mode**: Could run entirely client-side with a small model
- **ComfyUI Manager integration**: Model management, workflow templates, dependency resolution

---

## Phase 5: Multiple Glamours + World System

### 5A. Additional Glamour Themes

**Factory**: Knots=machines, threads=conveyor belts, waves=products on conveyors, gates=QC checkpoints. Facades: dials, gauges, levers. Merge: assembly line = multi-knot glamour.

**Garden**: Knots=plants/features, threads=irrigation channels, waves=water flow, gates=valves. Facades: watering can, pruning shears, seed selection. Merge: flower bed = grouped processing.

**Kingdom**: Knots=buildings, threads=roads, waves=messengers/caravans, gates=city gates with guards. Facades: building interiors, workshop tools. Merge: district = functional area.

### 5B. Glamour Plugin System
- Themes loadable from `data/glamours/` (JSON manifest + asset bundle)
- AI can generate entirely new glamour themes from a natural language description
- Theme manifest: `{ id, name, mappings, assets, sceneConfig, facadeDefinitions }`
- Community can share glamour themes
- ComfyUI-LOKI can load the same theme manifests, adapting rendering to its overlay system

### 5C. World-Level Glamours
- `GlamourWorld` ties multiple Weaves into one scene under a unified glamour
- Multiple workflows = different sections of the same factory/garden/kingdom
- Cross-weave connections visible as roads between buildings, irrigation between beds, etc.
- The whole system becomes one living world — zoom out to see the kingdom, zoom into a building to see a workshop's workflow, zoom into a workbench to see individual operations
- This is the ultimate expression of fractal consistency: the glamour holds from world → district → building → room → workbench → tool → individual operation

### 5D. Code View Tab (Deepest Unveil)
- Fourth tab alongside Glamour, Unveiled, and ComfyUI: "Code"
- Shows generated Python/TypeScript representation of the workflow
- This is the deepest level of unveiling — past the glamour, past the node graph, past ComfyUI, to the actual code
- Read-only initially, later bidirectional (edit code → update graph)
- Completes the unveiling stack: Glamour → Unveiled → ComfyUI → Code → (eventually) Machine Code

### 5E. Mixed Glamours
- Different parts of the same weave can use different glamour themes
- The data processing section might be a factory, while the creative section is a garden
- AI recommends which glamour fits best for each section
- Smooth visual transitions at the boundary between glamour themes

### 5F. n8n Full Integration
- Complete n8n adapter with full knot type mappings
- n8n-specific glamour elements for its unique node types (webhooks, cron triggers, database ops)
- Mixed-engine weaves: ComfyUI knots + n8n knots in the same graph, unified under one glamour
- Glamour naturally abstracts away which engine runs which part

### Verification
- Switch between Loom, Factory, Garden glamours on same workflow
- Partial glamouring: some sections glamoured, others unveiled
- Multiple workflows visible in one world scene
- Code tab shows Python equivalent
- AI generates a brand-new glamour theme from description
- Same glamour theme renders in both Weaver webapp and ComfyUI-LOKI extension

---

## Critical Files Reference

| File | Role | Phase |
|------|------|-------|
| `packages/core/src/types.ts` | Foundation types (Knot, Thread, Weave) | 1D ✅ |
| `packages/core/src/operations.ts` | Pure graph operations (11 ops, tested) | — ✅ |
| `packages/core/src/knot-types.ts` | KnotTypeDefinition + registry | 1D ✅ |
| `packages/core/src/validation.ts` | Weave validation | 1G ✅ |
| `packages/glamour/src/types.ts` | All glamour type definitions (~250 lines) | 2A ✅ |
| `packages/glamour/src/registry.ts` | RendererRegistry + ThemeRegistry | 2A ✅ |
| `packages/glamour/src/animation.ts` | buildTimeline + interpolateHighlights | 2H ✅ |
| `packages/glamour/src/asset-resolver.ts` | Hash-based asset lookup (from LOKI) | 2D ✅ |
| `packages/glamour/src/metaphor-engine.ts` | MetaphorEngine types + scoring helpers | 4B ✅ |
| `packages/glamour/src/themes/loom/index.ts` | Loom theme (GlamourTheme impl, 8 SVGs) | 3B ✅ |
| `packages/app/src/renderers/ClassicRenderer.tsx` | ReactFlow "Unveiled" renderer | 2E ✅ |
| `packages/app/src/renderers/ComfyUIRenderer.tsx` | ComfyUI native graph view | 2F ✅ |
| `packages/app/src/renderers/GlamourRenderer.tsx` | PixiJS v8 glamour renderer (~865 lines) | 3D ✅ |
| `packages/app/src/components/ViewTabs.tsx` | Three-tab view switching | 2F ✅ |
| `packages/app/src/components/AIChatPanel.tsx` | AI chat panel with SSE streaming | 4D ✅ |
| `packages/app/src/hooks/useWaveAnimation.ts` | rAF-driven animation playback | 2H ✅ |
| `packages/app/src/components/Canvas.tsx` | Backward-compat re-export | 2E ✅ |
| `packages/app/src/components/KnotNode.tsx` | Knot rendering + highlight glow | 1E, 2E ✅ |
| `packages/app/src/components/ThreadEdge.tsx` | Thread rendering + highlight stroke | 1E, 2E ✅ |
| `packages/app/src/components/PropertiesPanel.tsx` | Selected element editor | 1A ✅ |
| `packages/app/src/components/ContextMenu.tsx` | Right-click menus | 1C ✅ |
| `packages/app/src/hooks/useWeave.tsx` | State management + undo/redo | 1A ✅ |
| `packages/app/src/hooks/useSelection.ts` | Ephemeral selection state | 1A ✅ |
| `packages/app/src/lib/xyflow-bridge.ts` | Weave ↔ XYFlow + highlights | 2E ✅ |
| `packages/app/src/App.tsx` | Root shell with ViewTabs + renderers + AI panel | 2F, 4D ✅ |
| `packages/server/src/routes/ai.ts` | AI chat endpoint with SSE + 15 tools | 4A ✅ |
| `packages/server/src/agents/metaphor-agent.ts` | LLMMetaphorEngine (Loci implementation) | 4B ✅ |
| `packages/server/src/agents/asset-generator.ts` | ComfyUI bridge for glamour asset gen | 4C ✅ |
| `packages/server/src/agents/graph-tools.ts` | 16 graph operation wrappers | — ✅ |
| `ComfyUI-LOKI/nodes/glamour/` | Existing prototype (refine alongside) | Future |

---

## Execution Order

```
Phase 1A-C, 1F (Selection, Props, Delete, Context, Shortcuts) ── ✅ COMPLETE
Phase 1D (Type Registry) ── ✅ COMPLETE
Phase 1E (Type Rendering) ── ✅ COMPLETE
Phase 1G (Validation) ── ✅ COMPLETE
                ↓
Phase 2A-B (Glamour types + package) ── ✅ COMPLETE
Phase 2C-D (Asset Resolution, Interfaces) ── ✅ COMPLETE
Phase 2E-F (Extract Classic/Unveiled, Tab Switch, ComfyUI view) ── ✅ COMPLETE
Phase 2G-H (Facade types, Wave Animation) ── ✅ COMPLETE
                ↓
Phase 3A (PixiJS v8 setup) ── ✅ COMPLETE
Phase 3B-D (Loom glamour + GlamourRenderer) ── ✅ COMPLETE
Phase 3E (ComfyUI infrastructure) ── DEFERRED
                ↓
Phase 4A (AI server route + SSE streaming) ── ✅ COMPLETE
Phase 4B (MetaphorEngine — The Loci) ── ✅ COMPLETE
Phase 4C (Asset generator) ── ✅ COMPLETE
Phase 4D (AIChatPanel + App wiring) ── ✅ COMPLETE
Phase 4E (Glamour narration) ── ✅ COMPLETE
Phase 4 Future (Background Loci, group sessions, manifest→theme) ── PENDING
                ↓
Phase 5 (Multiple glamours, world system, code view, n8n) ── depends on all above
```

## Test Coverage

- **packages/core**: 41 tests (operations, helpers, serialization)
- **packages/runtime**: 22 tests (trace, gate-eval)
- **packages/glamour**: 65 tests (registry, animation, asset-resolver, loom-theme, metaphor-engine)
- **packages/server**: 13 tests (ai-route)
- **Total: 157 tests, all passing**

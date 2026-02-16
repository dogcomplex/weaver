# Weaver — From Graph Editor to Living Metaphorical Worlds

## Context

Weaver is a visual graph programming platform built across 8 phases — core types, runtime, adapters, server, frontend, MCP, and ComfyUI integration. It's fully functional: you can create knots, connect them, save/load, trace execution, queue to ComfyUI, and see generated images inline. **63 tests pass, server + frontend run, ComfyUI portable with SD 1.5 generates images end-to-end.**

However, the frontend is currently a **workflow viewer**, not a full editor. You can't edit knot properties, delete things, see type-specific visuals, or build workflows from scratch in the UI. More importantly — the UI is just another node-and-wire graph editor.

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

## Phase 1: Complete Classic Editor (table stakes)

Make the node editor fully usable before building metaphors on top.

### 1A. Selection + Properties Panel
- `packages/app/src/hooks/useSelection.ts` — ephemeral `{ type: 'knot'|'thread', id }` state
- `packages/app/src/components/PropertiesPanel.tsx` — right sidebar showing selected knot/thread fields, editable inputs (label, type, data key-value pairs, gate expressions)
- `packages/app/src/components/fields/DataEditor.tsx` — JSON key-value editor for `knot.data.inputs`
- Add `updateKnot` and `updateThread` actions to `useWeave` reducer
- Wire `onNodeClick`/`onEdgeClick`/`onPaneClick` in Canvas.tsx
- **This is critical**: users currently can't change prompts, parameters, or any settings in the UI

### 1B. Deletion
- Delete key removes selected knot (via existing `cut` operation) or thread (via `snip`)
- Canvas.tsx gets `onKeyDown` handler checking selection state
- Operations already exist and are tested in core — just needs UI wiring

### 1C. Context Menus
- `packages/app/src/components/ContextMenu.tsx` — positioned at cursor, dismissed on click-away
- Knot menu: Delete, Duplicate, Edit Label, Veil
- Thread menu: Delete, Add Gate, Edit Label
- Canvas menu: Add Knot (by type), Paste
- Wire `onNodeContextMenu`, `onEdgeContextMenu`, `onPaneContextMenu` in Canvas.tsx

### 1D. Knot Type Registry
- `packages/core/src/knot-types.ts` — `KnotTypeDefinition` interface with `type`, `label`, `category`, `defaultData`, `color`, `inputs: PortDefinition[]`, `outputs: PortDefinition[]`
- Registry auto-populates from imported ComfyUI workflows (introspects `class_type` + slot info)
- Built-in types: `default`, `input`, `output`, `gate`, `veiled`
- **Extensibility hook**: Phase 2 will add `metaphorMapping` field to `KnotTypeDefinition`
- **n8n awareness**: Registry can also populate from n8n node definitions (same `KnotTypeDefinition`, different source)

### 1E. Type-Specific Knot Rendering
- Rework `KnotNode.tsx` — look up type in registry, color-code by category, show typed input/output handles with labels
- Thread labels show connection type (MODEL, CLIP, LATENT, IMAGE)
- Gated threads get diamond icon or dashed line

### 1F. Inline Editing + Keyboard Shortcuts
- Double-click knot label → inline edit field
- Ctrl+S save, Delete/Backspace delete, Ctrl+A select all, Ctrl+C/V copy/paste
- `packages/app/src/hooks/useKeyboardShortcuts.ts`

### 1G. Validation
- `packages/core/src/validation.ts` — `validateWeave()` checks required inputs, type compatibility, orphans
- Visual indicators on knots (red border for errors, yellow for warnings)

### Verification
- Can build a ComfyUI txt2img workflow entirely from the UI (add typed knots, connect them, edit prompts)
- Delete, undo, redo all work
- Properties panel shows and edits all knot data
- `npm test` still passes 63+ tests

---

## Phase 2: Glamour Engine (the critical abstraction)

Decouple graph data from visual representation. The Glamour system veils underlying complexity with interactive metaphorical facades. This is the architectural keystone.

### 2A. New Package: `packages/glamour/`
Add `#weaver/glamour` to root `package.json` imports.

```
packages/glamour/src/
  types.ts              — Glamour, GlamourTheme, GlamourElement, Facade, etc.
  registry.ts           — manages available renderers and themes
  classic-renderer.ts   — wraps existing ReactFlow canvas as a WeaveRenderer (the "unveiled" view)
  glamour-renderer.ts   — PixiJS-based renderer consuming GlamourTheme
  scene.ts              — scene graph (elements → sprites, connections → paths)
  facade.ts             — interactive controls mapped to graph operations
  animation.ts          — WaveAnimator: TraceResult → AnimationTimeline
  layout.ts             — position mapping from graph space to scene space
  asset-resolver.ts     — hash-based asset lookup with fallback chain (from LOKI prototype)
  themes/loom/          — first glamour theme (Phase 3)
```

### 2B. Core Interface: `WeaveRenderer`
```typescript
interface WeaveRenderer {
  id: string
  name: string
  Component: React.ComponentType<WeaveRendererProps>
  editable: boolean
}
interface WeaveRendererProps {
  weave: Weave
  selection: Selection | null
  traceResult: TraceResult | null
  onWeaveChange: (action: WeaveAction) => void
  onSelectionChange: (sel: Selection | null) => void
}
```
Every renderer gets the same props. The Properties Panel, Sidebar, and TracePanel are **renderer-agnostic** — they work with Weave data, not visual representation. Only the central canvas area swaps between renderers.

### 2C. Core Interface: `GlamourTheme`
```typescript
interface GlamourTheme {
  id: string; name: string; description: string

  /** Enchant a knot — produce its glamoured visual representation */
  enchantKnot(knot, context): GlamourElement

  /** Enchant a thread — produce its glamoured visual path */
  enchantThread(thread, src, tgt, context): GlamourConnection

  /** Enchant a wave — produce its data flow animation */
  enchantWave(wave, knot, context): GlamourAnimation

  /** Can this theme glamour a subgraph as a single entity? */
  canMerge(knotIds: KnotId[], context): boolean

  /** Enchant a subgraph — merge multiple knots into one glamour element */
  enchantSubgraph(knotIds: KnotId[], context): GlamourElement

  /** Describe the weave in this theme's metaphorical language */
  describeWeave(weave): string
  describeKnot(knot, weave): string

  /** Scene config: background, layout, ambient effects */
  sceneConfig: GlamourSceneConfig

  /** System prompt for AI to explain/build in this theme's vocabulary */
  aiSystemPrompt: string
}
```

A `GlamourElement` has:
- `visual`: sprite, SVG, HTML component, OR `{ type: 'generated', prompt }` (AI-generated via ComfyUI)
- `facade`: interactive controls mapped to graph operations — a turning gear for numeric params, a color wheel for colors, etc. A perfect facade represents all underlying capabilities in metaphorical form.
- `veils`: which knot IDs this glamour covers (1 for single, N for merged subgraph)
- `label`, `tooltip`, `position`, `size`
- `depth`: how many levels of unveiling are possible below this glamour

### 2D. Asset Resolution (from LOKI prototype)
Port the hash-based asset system:
```typescript
interface GlamourAssetResolver {
  /** Generate deterministic hash from knot configuration */
  hashKnot(knot: Knot): string

  /** Resolve asset with fallback chain: hash → type → theme default → aurora */
  resolveAsset(knotId: KnotId, knotType: string, hash: string): GlamourAsset

  /** Cache management */
  invalidate(knotId: KnotId): void
}
```
Upgrade from LOKI's polling to WebSocket-based push notifications for asset updates.

### 2E. Extract Classic Renderer (the "Unveiled" view)
Refactor current `Canvas.tsx` internals into `ClassicRenderer` implementing `WeaveRendererProps`. Canvas.tsx becomes a thin shell that delegates to the active renderer. The Classic view IS the first level of unveiling — it shows the raw graph without any glamour.

### 2F. Tab Switching: Glamour ↔ Unveiled
- `packages/app/src/components/ViewTabs.tsx` — "Glamour" | "Unveiled" tab bar above canvas
- Mount/unmount renderers on switch (save viewport state in refs for instant restore)
- Both tabs share the same Properties Panel, Sidebar, TracePanel
- Future: unveiling can be partial — click a single glamour element to unveil just that part while the rest stays glamoured

### 2G. Facade Interaction (Bidirectional)
When user interacts with a glamour facade (turns a gear, adjusts a slider dial, clicks a color vat) → facade maps the interaction to a graph operation (updateKnot data, connect, delete). The change propagates back and the glamour re-renders. Facades are the key to "perfect glamours" — every underlying parameter should have a metaphorical control surface that feels like it *belongs* in the scene.

### 2H. Wave Animation Engine
- `WaveAnimator` converts `TraceResult` → `AnimationTimeline` (keyframes with positions along paths)
- Classic/Unveiled renderer: highlights nodes/edges with colored pulses
- Glamour renderer: moves sprites along connection paths (shuttles, products, water, messengers)

### Verification
- Tab switching works: Glamour ↔ Unveiled
- Selection, properties editing, deletion all work in both views
- `npm test` passes with new glamour package tests

---

## Phase 3: First Glamour — "The Loom"

The weaving lexicon from CLAUDE.md IS the first glamour theme. The names we already use become literal visual elements. This glamour should be fractal — zoom into the heddle frame and it contains a smaller loom of its own.

### 3A. Technology: PixiJS v8 + @pixi/react
- WebGL sprite rendering, tweened animations, interaction events
- Handles many animated sprites (waves as shuttles) at 60fps
- Add `pixi.js`, `@pixi/react` to root package.json
- Layered composition model (mirrors LOKI prototype's z-index stacking: backdrop → visual → controls)

### 3B. Loom Glamour Mappings

| Knot Type | Glamour Element | Facade Controls |
|-----------|----------------|-----------------|
| `CheckpointLoaderSimple` | Spindle/distaff holding raw fiber | Rotate spindle to select model |
| `CLIPTextEncode` | Dye vat with colored liquid | Adjust color/tap vat to edit prompt text |
| `KSampler` | Heddle frame (central loom) | Levers for steps/CFG, wheel for sampler |
| `VAEDecode` | Winding frame | Crank to preview decode |
| `SaveImage` | Finished cloth on beam | Unroll to see the output image |
| `EmptyLatentImage` | Raw fiber bundle | Stretch/compress for dimensions |
| `default` | Tied knot | Click to inspect |
| *n8n trigger* | *Alarm bell / starting horn* | *Click to fire* |
| *n8n HTTP request* | *Messenger bird* | *Scroll for URL, ribbon for headers* |
| *n8n transform* | *Spinning wheel* | *Dial for transform type* |

**Threads** = literal threads stretching between loom elements. Color by data type:
- MODEL: thick dark fiber
- CLIP: thin colored thread (warm=positive, cool=negative)
- LATENT: translucent shimmering thread
- IMAGE: bright full-color thread

**Waves** = shuttles (boat-shaped tools carrying weft across warp). Visible movement from element to element during trace execution.

**Gates** = heddles (wire frames lifting/lowering threads). Rise = condition passes, stay down = blocked.

**Subgraph glamours**: The positive CLIP + negative CLIP could merge into a single "dyeing station" glamour. The whole KSampler+VAE chain could merge into "the working loom." AI decides.

### 3C. SVG Asset Pipeline
- Ship initial assets as SVGs in `packages/glamour/src/themes/loom/assets/`
- `spindle.svg`, `dye-vat.svg`, `heddle-frame.svg`, `shuttle.svg`, etc.
- Phase 4 adds AI-generated upgrades via ComfyUI
- Asset resolver uses hash-based lookup (from LOKI prototype) with SVG → generated image upgrade path

### 3D. PixiJS GlamourRenderer
- On mount: create PixiJS Application, attach to DOM
- For each knot: `theme.enchantKnot()` → create PixiJS sprite with facade
- For each thread: `theme.enchantThread()` → draw Graphics path
- Wire facade interactions → graph operations
- On Weave change: diff and update scene (add/remove/reposition)
- On trace: `theme.enchantWave()` → animate shuttle sprites along paths
- Partial unveil: click an element with Alt → shows the unveiled knot(s) beneath just that one glamour

### 3E. Coordinate Mapping + Fractal Zoom
- Loom is horizontal (warp left→right). Graph positions map with configurable scale.
- Branching (vertical spread) = multiple threads on different heddles
- **Zoom levels**: At high zoom, see the full tapestry. Zoom into a section → the glamour elements expand to show more detail, potentially revealing their own internal subgraph as a smaller loom

### 3F. ComfyUI-LOKI Backport
- Port Loom theme definition to work with LOKI's overlay system
- Reuse theme mappings, adapt rendering from PixiJS sprites to DOM overlays
- Keep LOKI's aurora gradient as fallback while Loom assets load
- Shared asset pipeline: same SVGs, same hash-based resolution

### Verification
- Load demo-txt2img → switch to Glamour tab → see the workflow as a loom scene
- Click loom elements → selects corresponding knot → Properties Panel works
- Turn a gear/adjust a facade control → underlying knot data changes
- Run trace → shuttles visually carry data across the loom
- Switch to Unveiled tab → same graph, classic node rendering

---

## Phase 4: AI Integration

### 4A. Chat Panel in Frontend
- `packages/app/src/components/AIChatPanel.tsx` — conversational interface
- `packages/server/src/routes/ai.ts` — proxies to Claude API
- User: "Create a workflow that generates a portrait" → Claude produces graph operations → Weave built automatically → renders in both Glamour and Unveiled views
- AI has full access to glamour tools: enchant, unveil, merge subgraphs, create facades

### 4B. Glamour Narration
- When a GlamourTheme is active, Claude explains using that theme's `aiSystemPrompt`
- "The spindle holds your model's raw fiber. The dye vats color the thread with your positive and negative prompts..."
- Hover-tooltip shows both technical description AND glamoured description
- AI should find its OWN best metaphors unrestricted — the theme provides vocabulary, but Claude picks what fits

### 4C. AI-Generated Glamour Assets
- `GlamourVisual` type `{ type: 'generated', prompt }` triggers ComfyUI image generation
- `packages/server/src/agents/asset-generator.ts` queues ComfyUI jobs for each glamour element
- Generated assets cached in `data/output/glamour-assets/` and swapped in via WebSocket
- Initial SVG = fallback shown instantly; AI art arrives async
- AI can generate ENTIRELY NEW glamour themes from a description — not just use pre-built ones
- Reuse LOKI prototype's `Glamour/` subfolder convention for ComfyUI-generated assets

### 4D. AI Glamour Quality Assessment
- AI evaluates its own glamours: "Is this a perfect glamour? What capabilities are missing from the facade?"
- Suggests improvements: "The KSampler glamour doesn't expose the scheduler setting — adding a dial for that"
- Reports glamour depth: "This glamour has 3 levels of unveiling available"
- Measures against the "perfect glamour" standard: does it feel like one thing the user already knows?

### Verification
- Type "create a txt2img workflow" in chat → workflow appears
- Glamour view shows AI-generated art for each loom element
- AI explains what each element does in glamour metaphor terms
- AI identifies thin glamours and suggests improvements

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
- Third tab alongside Glamour and Unveiled: "Code"
- Shows generated Python/TypeScript representation of the workflow
- This is the deepest level of unveiling — past the glamour, past the node graph, to the actual code
- Read-only initially, later bidirectional (edit code → update graph)
- Represents the fractal principle: Glamour → Nodes → Code → (eventually) Machine Code

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

| File | Role | Modified In |
|------|------|------------|
| `packages/core/src/types.ts` | Foundation types (Knot, Thread, Weave) | Phase 1D |
| `packages/core/src/operations.ts` | Pure graph operations (11 ops, tested) | — |
| `packages/core/src/knot-types.ts` | **NEW** KnotTypeDefinition + registry | Phase 1D |
| `packages/core/src/validation.ts` | **NEW** Weave validation | Phase 1G |
| `packages/app/src/components/Canvas.tsx` | Graph canvas (→ thin renderer shell) | Phase 1, 2E |
| `packages/app/src/components/KnotNode.tsx` | Knot rendering (→ type-specific) | Phase 1E |
| `packages/app/src/components/PropertiesPanel.tsx` | **NEW** Selected element editor | Phase 1A |
| `packages/app/src/components/ContextMenu.tsx` | **NEW** Right-click menus | Phase 1C |
| `packages/app/src/components/ViewTabs.tsx` | **NEW** Glamour/Unveiled tab switching | Phase 2F |
| `packages/app/src/components/AIChatPanel.tsx` | **NEW** AI chat interface | Phase 4A |
| `packages/app/src/hooks/useWeave.tsx` | State management + undo/redo | Phase 1A |
| `packages/app/src/hooks/useSelection.ts` | **NEW** Ephemeral selection state | Phase 1A |
| `packages/app/src/lib/xyflow-bridge.ts` | Weave ↔ XYFlow translation | Phase 2E |
| `packages/glamour/src/types.ts` | **NEW** Glamour, GlamourTheme, Facade interfaces | Phase 2A |
| `packages/glamour/src/asset-resolver.ts` | **NEW** Hash-based asset lookup (from LOKI) | Phase 2D |
| `packages/glamour/src/classic-renderer.ts` | **NEW** ReactFlow as "Unveiled" renderer | Phase 2E |
| `packages/glamour/src/glamour-renderer.ts` | **NEW** PixiJS glamour renderer | Phase 3D |
| `packages/glamour/src/themes/loom/` | **NEW** First glamour theme | Phase 3B |
| `packages/server/src/routes/ai.ts` | **NEW** Claude API proxy | Phase 4A |
| `ComfyUI-LOKI/nodes/glamour/` | Existing prototype (refine alongside) | Phase 3F+ |

---

## Execution Order

```
Phase 1A-C, 1F (Selection, Props, Delete, Context, Shortcuts) ── parallel
Phase 1D (Type Registry) ── independent
Phase 1E (Type Rendering) ── depends on 1D
Phase 1G (Validation) ── depends on 1D
                ↓
Phase 2A-B (Glamour types + package) ── can overlap with late Phase 1
Phase 2C-D (Asset Resolution, Interfaces) ── depends on 2A
Phase 2E-F (Extract Classic/Unveiled, Tab Switch) ── depends on 2A
Phase 2G-H (Facade Interaction, Animation) ── depends on 2A
                ↓
Phase 3A (PixiJS setup) ── depends on 2E
Phase 3B-E (Loom glamour + renderer) ── depends on 2A + 3A
Phase 3F (ComfyUI-LOKI backport) ── depends on 3B
                ↓
Phase 4A-D (AI chat, glamour narration, asset gen) ── partially parallel with Phase 3
                ↓
Phase 5 (Multiple glamours, world system, code view, n8n) ── depends on all above
```

## Starting Now: Phase 1

The immediate next session implements Phase 1A-1G. The properties panel is the highest-priority single item — it unlocks the ability to actually edit workflows without touching JSON.

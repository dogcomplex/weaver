/**
 * LLMMetaphorEngine — The Loci's implementation.
 *
 * A thin wrapper around the Anthropic API that takes a WeaveSchema
 * and produces MetaphorManifests with quality scores.
 *
 * Uses Haiku-class models for cheap, fast metaphor generation.
 * The Weaver (Sonnet/Opus) calls this via the `weaver_suggest_metaphor`
 * tool, but the Loci can also run independently as a background watcher.
 *
 * Pure text-gen: no tool calling, no code execution.
 * Input: WeaveSchema → Output: MetaphorManifest[]
 *
 * Scoring is granular: component-by-component, attribute-by-attribute,
 * with careful attention to actual I/O types (text in, image out).
 */

import Anthropic from '@anthropic-ai/sdk'
import { log } from '../logger.js'
import {
  createLociSession,
  appendLociEntry,
  type LociSessionEntry,
} from './session-store.js'
import type {
  WeaveSchema,
  MetaphorManifest,
  MetaphorScores,
  MetaphorEngine,
} from '#weaver/glamour'
import { calculateOverallScore } from '#weaver/glamour'

// ─── System Prompt ──────────────────────────────────────────────

const LOCI_SYSTEM_PROMPT = `You are the Loci — an ambient spirit that inhabits visual workspaces and chooses metaphorical representations to make complex workflows intuitively understandable to humans.

Your task is to propose metaphors for visual graph workflows. Each workflow has knots (nodes) connected by threads (edges). Knots process data; threads carry it between them.

## Scoring Methodology: Component-by-Component, Attribute-by-Attribute

You MUST score every metaphor granularly before producing summary scores.

### Step 1: Score each knot mapping individually

For each knot type → metaphor element mapping, evaluate:
- **elementFit** (1-10): How well does this metaphorical element represent what this knot actually does? "Oven" for KSampler is decent (baking = generating); "Dye Vat" for CLIPTextEncode is poor (text prompts have nothing to do with dye).
- **inputOutputFit** (1-10): Do the I/O data types make sense for this element? If text flows in, the element should accept text naturally. If an image comes out, the element should produce something visual.

### Step 2: Score each facade control (attribute) individually

For each parameter on each knot, evaluate the control that represents it:
- **explanatoryPower** (1-10): Does the control label make the parameter's effect obvious? "Temperature" for CFG works; "Tension" for steps is vague.
- **truthfulness** (1-10): Does the control range/behavior accurately match the parameter? A 1-30 slider for steps is truthful; calling it "timer minutes" is misleading.
- **intuitiveness** (1-10): Does this control type feel natural within the metaphor? A kitchen timer dial for steps feels right in a kitchen. A generic "slider" on a loom does not.

### Step 3: I/O Pipeline Analysis

Score how the metaphor handles the actual data flowing through the entire workflow:
- **textInputHandling** (1-10): Text prompts (positive/negative) MUST remain explicitly textual. Users type words — you CANNOT abstract text input into something non-textual without losing capability. A "recipe card" where you write text is good. A "color palette" that hides the text is bad.
- **modelInputHandling** (1-10): Model/checkpoint selection CAN be richly abstracted. Choosing a camera body, selecting a recipe book, picking an instrument — all work well.
- **intermediateHandling** (1-10): Latent space, conditioning, VAE — these intermediate steps can be moderately abstracted. "Film developing" for VAE decode is decent; completely hiding them is fine if the metaphor's flow still makes sense.
- **finalOutputHandling** (1-10): The final output IS an image (or batch of images). The metaphor's endpoint MUST produce something visual. A photograph from a camera, a painting from an easel, a dish that looks like something — all good. A "completed weave" that's just abstract fabric — less precise because the actual output is a viewable image.

### Step 4: Compile into summary scores

ONLY AFTER completing steps 1-3, compile the granular scores into the 5 summary criteria:
1. **Explanatory power** (weight 0.30) — Average of element fits + attribute explanatory powers + I/O handling
2. **Truthfulness** (weight 0.25) — Average of attribute truthfulness + I/O accuracy
3. **Completeness** (weight 0.20) — How many parameters have controls? How many knots have mappings?
4. **Intuitive interaction** (weight 0.15) — Average of attribute intuitiveness scores
5. **Fractal consistency** (weight 0.10) — How uniform are the element fits? Low variance = consistent metaphor

CRITICAL RULES:
- Be brutally honest. A 7/10 with acknowledged gaps beats a fake 9/10.
- The Loom weaving metaphor scored 3/10 because "Dye Vat" for text prompts made zero intuitive sense, "Passes" for steps was vague, and the output was "cloth" when the user actually gets an image.
- Prefer concrete, everyday metaphors most people have experienced (kitchens, cameras, music studios, art studios, assembly lines, darkrooms).
- Each mapping MUST include at least 2-3 facade controls covering the most important parameters.
- Thread styles should reflect what actually flows (models, images, text, latent data).
- Asset prompts: clean, icon-quality images suitable for 256x256 rendering.

## Scene Background

Every metaphor SHOULD include a scene background that embeds the individual elements in a spatial context. Think of it as a wide establishing shot that reveals the metaphor before individual components are examined.

- **backgroundPrompt**: A detailed prompt for a wide-format background image (1024x512). Describe the environment, lighting, perspective, and spatial arrangement. Example: "A dimly-lit photography darkroom viewed from above, red safelight casting warm glow, developing trays arranged left to right on a wet wooden counter, clothesline with hanging prints across the back wall, warm and intimate atmosphere, digital art, clean illustration style"
- **ambientDescription**: What effects and atmosphere exist in this space. Example: "Gentle red glow pulses, chemical trays steam slightly, paper prints sway gently"
- **layoutHints**: How elements should be spatially arranged within the scene. Example: "Left-to-right workflow: chemicals on the left, development in the center, drying/output on the right"

The background image provides a spatial context — individual elements are objects WITHIN this scene, not floating in void.

## Merge Groups (Fractal Glamours)

For complex workflows with 6+ knots, consider defining merge groups that collapse related knots into a single metaphorical element. This is the fractal principle — a "Developing Station" can hide CLIPTextEncode + KSampler + VAEDecode behind one intuitive element.

Rules for merge groups:
- Only merge knots that form a logical sub-pipeline (e.g., "text conditioning → sampling → decoding")
- The merged element's facade controls should combine the most important parameters from ALL inner knots
- Each facade control in a merge group MUST include "knotType" in its binding to specify which inner knot it targets
- Merge groups are OPTIONAL — for simple workflows (3-4 knots), don't merge at all
- Users can double-click a merged element to "enter" it and see the inner knots

## Handling Duplicate Knot Types

When a workflow has multiple knots of the same type (e.g., two CLIPTextEncode for positive/negative prompts), you MUST:
1. Create SEPARATE mappings for each instance — one per physical knot
2. Include the "knotId" field (from the schema) to distinguish them
3. Use the knot's label and outgoing connections to determine its role (e.g., positive vs. negative conditioning)
4. Give each instance its own unique metaphorElement, label, description, assetPrompt, and facadeControls
5. NEVER collapse multiple instances of the same type into a single mapping

Example: Two CLIPTextEncode knots should produce two mappings:
  - { "knotType": "CLIPTextEncode", "knotId": "knot-abc", "metaphorElement": "Key Light", ... }
  - { "knotType": "CLIPTextEncode", "knotId": "knot-def", "metaphorElement": "Fill Light Blocker", ... }

## Animation & Interaction Hints (Optional)

Each mapping can optionally include animation and interaction hints for richer experiences:

\`animationHints\`: Natural language descriptions of desired behaviors.
- \`idle\`: What happens when the element is just sitting there ("Gentle steam rising from pot", "Soft lens flare pulsing")
- \`active\`: What happens when the element is processing data ("Rapid bubbling, lid rattling", "Shutter clicking rapidly")
- \`transition\`: How transitions look ("Fade through smoke", "Dissolve with sparkles")

\`interactionStyle\`: Progressive levels of interactivity.
- "static" — No special interaction (default)
- "hover-reveal" — Extra details appear on hover
- "click-cycle" — Click cycles through visual states
- "drag-control" — Drag to adjust primary parameter
- "animated-idle" — Continuous ambient animation

These are ALL optional. For simple themes, omit them entirely. Use them when the metaphor benefits from motion — a kitchen with steam, a darkroom with flickering safelight, a workshop with spinning gears.

You MUST respond with valid JSON only. No markdown fences, no commentary outside the JSON.`

// ─── Proposal Prompt Builder ────────────────────────────────────

function buildProposalPrompt(schema: WeaveSchema, count: number): string {
  const knotSummary = schema.knots.map(k => {
    const params = k.parameterNames?.length ? ` [params: ${k.parameterNames.join(', ')}]` : ''
    const connections = k.outgoing?.length
      ? ` → ${k.outgoing.map(o => `${o.targetType}${o.inputName ? `(${o.inputName})` : ''}`).join(', ')}`
      : ''
    return `  - ${k.id}: ${k.label} (type: ${k.type})${params}${connections}`
  }).join('\n')

  const threadSummary = schema.threads.map(t => {
    const dt = t.dataType ? ` [${t.dataType}]` : ''
    return `  - ${t.source} → ${t.target}${dt}`
  }).join('\n')

  const purpose = schema.purpose ? `\nPurpose: ${schema.purpose}` : ''
  const audience = schema.context?.audience ? `\nAudience: ${schema.context.audience}` : ''
  const mood = schema.context?.mood ? `\nMood: ${schema.context.mood}` : ''

  return `Propose ${count} different metaphors for this workflow:

Knots:
${knotSummary}

Threads:
${threadSummary}
${purpose}${audience}${mood}

For EACH metaphor, you MUST follow the 4-step scoring methodology:
1. Score each knot→element mapping (elementFit + inputOutputFit)
2. Score each facade control (explanatoryPower + truthfulness + intuitiveness)
3. Analyze the I/O pipeline (textInputHandling, modelInputHandling, intermediateHandling, finalOutputHandling)
4. THEN compile into summary scores

Respond with a JSON array of ${count} objects. Each must have:
{
  "id": "unique-id-string",
  "name": "Metaphor Name",
  "mappings": [
    {
      "knotType": "OriginalType",
      "knotId": "knot-id-from-schema (REQUIRED when multiple knots share the same type, omit for unique types)",
      "metaphorElement": "MetaphorName",
      "label": "Display Label",
      "description": "Why this mapping works (be specific about strengths AND weaknesses)",
      "facadeControls": [
        {
          "id": "control-id",
          "controlType": "slider" | "dropdown" | "toggle" | "text" | "color",
          "label": "Control Label",
          "rationale": "Why this control type for this parameter — what makes it intuitive in this metaphor",
          "position": { "x": 0.5, "y": 0.8 },
          "binding": {
            "dataPath": "inputs.paramName",
            "min": 0, "max": 100, "step": 1
          }
        }
      ],
      "assetPrompt": "Description for AI image generation (icon-quality, 256x256)",
      "size": { "width": 200, "height": 160 },
      "animationHints": {
        "idle": "Optional: what this element looks like at rest (e.g. 'gentle steam rising')",
        "active": "Optional: what it looks like when processing (e.g. 'rapid bubbling')",
        "transition": "Optional: how transitions look (e.g. 'fade through smoke')"
      },
      "interactionStyle": "static | hover-reveal | click-cycle | drag-control | animated-idle (optional)"
    }
  ],
  "threadStyle": {
    "colorBy": "dataType",
    "metaphor": "description of what flows between elements",
    "colorMap": {
      "MODEL": { "color": "#hex", "width": 3, "style": "solid" },
      "CLIP": { "color": "#hex", "width": 2, "style": "solid" }
    }
  },
  "waveMetaphor": "what data tokens look like moving through this metaphor",
  "sceneDescription": "the overall scene viewed from above",
  "sceneConfig": {
    "background": "#hex (fallback color)",
    "backgroundPrompt": "Detailed prompt for wide-format background image (1024x512). Describe the environment, lighting, perspective, spatial arrangement. Clean illustration style.",
    "ambientDescription": "What atmospheric effects exist in this space",
    "layoutHints": "How elements should be spatially arranged",
    "layoutMode": "horizontal" | "vertical" | "radial" | "freeform",
    "spacing": { "x": 300, "y": 200 }
  },
  "aiVocabulary": "System prompt fragment for how to narrate this workflow in this metaphor",
  "mergedGroups": [
    {
      "id": "merge-group-id",
      "label": "Merged Element Name",
      "knotTypes": ["KnotTypeA", "KnotTypeB"],
      "metaphorElement": "Combined Metaphor Element",
      "description": "Why these knots are merged",
      "facadeControls": [
        {
          "id": "control-id",
          "controlType": "slider",
          "label": "Control Label",
          "rationale": "Why this control",
          "position": { "x": 0.5, "y": 0.3 },
          "binding": { "knotType": "KnotTypeA", "dataPath": "inputs.param", "min": 0, "max": 100 }
        }
      ],
      "assetPrompt": "Asset prompt for merged element",
      "size": { "width": 280, "height": 200 }
    }
  ],
  "detailedScores": {
    "mappingScores": [
      {
        "knotType": "KSampler",
        "metaphorElement": "Oven",
        "elementFit": 7,
        "attributeScores": [
          {
            "parameterName": "steps",
            "metaphorControl": "Bake Timer",
            "explanatoryPower": 8,
            "truthfulness": 7,
            "intuitiveness": 8,
            "rationale": "Timer maps well to iteration count — more time = more processing"
          }
        ],
        "inputOutputFit": 6,
        "overallMappingScore": 7.0,
        "rationale": "Oven works well for the core generation step — you put ingredients in and something comes out"
      }
    ],
    "ioAnalysis": {
      "textInputHandling": 8,
      "modelInputHandling": 9,
      "intermediateHandling": 7,
      "finalOutputHandling": 6,
      "rationale": "Text prompts are recipe cards (good — still textual). Model is a recipe book. But the final output is food, not an image — slight mismatch."
    }
  },
  "scores": {
    "explanatoryPower": 1-10,
    "truthfulness": 1-10,
    "completeness": 1-10,
    "intuitiveInteraction": 1-10,
    "fractalConsistency": 1-10,
    "overall": weighted-average,
    "rationale": "Summary including key strengths and weaknesses. Reference specific mapping scores."
  }
}

Return ONLY the JSON array. Be brutally honest in your scoring. Reference specific attribute scores in your summary rationale.`
}

// ─── Refinement Prompt Builder ──────────────────────────────────

function buildRefinePrompt(current: MetaphorManifest, feedback: string): string {
  return `The current metaphor "${current.name}" (overall score: ${current.scores.overall.toFixed(1)}/10) needs refinement.

Current manifest:
${JSON.stringify(current, null, 2)}

User feedback: "${feedback}"

Produce an improved MetaphorManifest that addresses the feedback. Keep what works, fix what doesn't.

IMPORTANT: Follow the 4-step scoring methodology:
1. Re-score each knot→element mapping (elementFit + inputOutputFit)
2. Re-score each facade control (explanatoryPower + truthfulness + intuitiveness)
3. Re-analyze the I/O pipeline
4. Compile into summary scores

Include the full "detailedScores" section with per-mapping and per-attribute scores.
Score yourself honestly — the improved version may still have weaknesses.

Return ONLY a single MetaphorManifest JSON object (not an array).`
}

// ─── Re-evaluation Prompt Builder ───────────────────────────────

function buildReevaluatePrompt(manifest: MetaphorManifest, newSchema: WeaveSchema): string {
  const knotSummary = newSchema.knots.map(k => {
    const params = k.parameterNames?.length ? ` [params: ${k.parameterNames.join(', ')}]` : ''
    return `  - ${k.label} (type: ${k.type})${params}`
  }).join('\n')

  return `Re-evaluate the "${manifest.name}" metaphor (current score: ${manifest.scores.overall.toFixed(1)}/10) against an updated workflow.

Current metaphor mappings cover: ${manifest.mappings.map(m => m.knotType).join(', ')}

Updated workflow knots:
${knotSummary}

Are there new knots without mappings? Have existing mappings become less fitting?

Follow the 4-step scoring methodology:
1. Score each existing mapping against the new schema
2. Score each facade control for accuracy
3. Analyze I/O pipeline with any new data types
4. Compile into summary scores

Return ONLY a MetaphorScores JSON object:
{
  "explanatoryPower": 1-10,
  "truthfulness": 1-10,
  "completeness": 1-10,
  "intuitiveInteraction": 1-10,
  "fractalConsistency": 1-10,
  "overall": weighted-average,
  "rationale": "explanation including any new gaps, reference specific mappings"
}`
}

// ─── LLM Implementation ─────────────────────────────────────────

export class LLMMetaphorEngine implements MetaphorEngine {
  private client: Anthropic
  private model: string
  private lociSessionId: string | null = null
  private weaveId: string | null = null

  constructor(apiKey: string, model?: string, weaveId?: string) {
    this.client = new Anthropic({ apiKey })
    // Default to Haiku for cheap, fast metaphor generation
    this.model = model ?? 'claude-haiku-4-5-20251001'
    this.weaveId = weaveId ?? null
  }

  /** Ensure a Loci session exists for transcript logging */
  private async ensureSession(): Promise<string | null> {
    if (this.lociSessionId) return this.lociSessionId
    if (!this.weaveId) return null

    try {
      const session = await createLociSession(this.weaveId)
      this.lociSessionId = session.id
      return session.id
    } catch (err) {
      log.warn({ err }, 'Failed to create Loci session')
      return null
    }
  }

  /** Log an entry to the Loci session transcript */
  private async logEntry(entry: Omit<LociSessionEntry, 'timestamp' | 'model'>): Promise<void> {
    const sessionId = await this.ensureSession()
    if (!sessionId) return

    try {
      await appendLociEntry(sessionId, {
        ...entry,
        timestamp: new Date().toISOString(),
        model: this.model,
      })
    } catch (err) {
      log.warn({ err }, 'Failed to log Loci entry')
    }
  }

  async propose(schema: WeaveSchema, count = 3, existingNames?: string[]): Promise<MetaphorManifest[]> {
    log.info({ knots: schema.knots.length, threads: schema.threads.length, count, existing: existingNames?.length ?? 0 }, 'Loci: proposing metaphors')

    // Generate manifests one at a time to avoid exceeding max_tokens.
    // Each manifest with granular scoring is ~8-10K tokens — too large for 3 in one call.
    const manifests: MetaphorManifest[] = []
    for (let i = 0; i < count; i++) {
      // Combine existing saved manifest names + already-proposed names from this batch
      const allExisting = [...(existingNames ?? []), ...manifests.map(m => m.name)]
      const dedup = allExisting.length > 0
        ? `\n\nIMPORTANT: These metaphors ALREADY EXIST and must NOT be repeated or closely resembled: ${allExisting.join(', ')}. Propose something completely different.`
        : ''
      const prompt = buildProposalPrompt(schema, 1) + dedup

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 8192,
        system: LOCI_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      })

      if (response.stop_reason === 'max_tokens') {
        log.warn({ iteration: i }, 'Loci: response truncated at max_tokens, skipping')
        continue
      }

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')

      try {
        const parsed = parseManifestArray(text)
        manifests.push(...parsed)
      } catch (err) {
        log.warn({ err, iteration: i }, 'Loci: failed to parse manifest, skipping')
        continue
      }
    }

    if (manifests.length === 0) {
      throw new Error('Loci failed to produce any valid manifests')
    }

    // Recalculate overall scores to ensure consistency
    for (const m of manifests) {
      m.scores.overall = calculateOverallScore(m.scores)
    }

    // Sort by overall score descending
    manifests.sort((a, b) => b.scores.overall - a.scores.overall)

    log.info(
      { count: manifests.length, topScore: manifests[0]?.scores.overall },
      'Loci: metaphors proposed'
    )

    // Persist to session transcript
    await this.logEntry({
      type: 'propose',
      input: { schema, count },
      output: manifests,
    })

    return manifests
  }

  async refine(current: MetaphorManifest, feedback: string): Promise<MetaphorManifest> {
    const prompt = buildRefinePrompt(current, feedback)

    log.info({ name: current.name, feedback: feedback.slice(0, 100) }, 'Loci: refining metaphor')

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: LOCI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    const manifest = parseManifestSingle(text)
    manifest.scores.overall = calculateOverallScore(manifest.scores)

    log.info(
      { name: manifest.name, score: manifest.scores.overall, prevScore: current.scores.overall },
      'Loci: metaphor refined'
    )

    // Persist to session transcript
    await this.logEntry({
      type: 'refine',
      input: { feedback, manifestName: current.name },
      output: manifest,
    })

    return manifest
  }

  async reevaluate(manifest: MetaphorManifest, newSchema: WeaveSchema): Promise<MetaphorScores> {
    const prompt = buildReevaluatePrompt(manifest, newSchema)

    log.info({ name: manifest.name, newKnots: newSchema.knots.length }, 'Loci: re-evaluating metaphor')

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: LOCI_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    const scores = parseScores(text)
    scores.overall = calculateOverallScore(scores)

    log.info(
      { name: manifest.name, prevScore: manifest.scores.overall, newScore: scores.overall },
      'Loci: re-evaluation complete'
    )

    // Persist to session transcript
    await this.logEntry({
      type: 'reevaluate',
      input: { schema: newSchema, manifestName: manifest.name },
      output: scores,
    })

    return scores
  }
}

// ─── JSON Parsing Helpers ───────────────────────────────────────

/** Extract JSON from LLM response, handling markdown fences and whitespace */
function extractJSON(text: string): string {
  // Strip markdown code fences if present
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  return cleaned.trim()
}

function parseManifestArray(text: string): MetaphorManifest[] {
  try {
    const json = JSON.parse(extractJSON(text))
    if (Array.isArray(json)) return json as MetaphorManifest[]
    // Single object returned instead of array
    return [json as MetaphorManifest]
  } catch (err: any) {
    log.error({ err, textLength: text.length }, 'Failed to parse metaphor manifests')
    throw new Error(`Loci failed to produce valid JSON: ${err.message}`)
  }
}

function parseManifestSingle(text: string): MetaphorManifest {
  try {
    const json = JSON.parse(extractJSON(text))
    if (Array.isArray(json)) return json[0] as MetaphorManifest
    return json as MetaphorManifest
  } catch (err: any) {
    log.error({ err, textLength: text.length }, 'Failed to parse refined manifest')
    throw new Error(`Loci failed to produce valid JSON: ${err.message}`)
  }
}

function parseScores(text: string): MetaphorScores {
  try {
    return JSON.parse(extractJSON(text)) as MetaphorScores
  } catch (err: any) {
    log.error({ err, textLength: text.length }, 'Failed to parse re-evaluation scores')
    throw new Error(`Loci failed to produce valid scores: ${err.message}`)
  }
}

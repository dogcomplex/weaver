/**
 * Loom Theme — The First Glamour
 *
 * The weaving lexicon from CLAUDE.md becomes literal visual elements.
 * Each ComfyUI knot type maps to a loom component:
 *   CheckpointLoader → Spindle, CLIPTextEncode → Dye Vat,
 *   KSampler → Heddle Frame, VAEDecode → Winding Frame,
 *   SaveImage → Cloth Beam, EmptyLatentImage → Fiber Bundle,
 *   default → Tied Knot.
 *
 * Threads are literal threads colored by data type.
 * Waves are shuttles carrying weft across the warp.
 */
// ─── Asset Paths ────────────────────────────────────────────────
/** Base path for Loom SVG assets (relative to glamour package) */
const ASSET_BASE = '/glamour/loom';
const ASSETS = {
    spindle: `${ASSET_BASE}/spindle.svg`,
    'dye-vat': `${ASSET_BASE}/dye-vat.svg`,
    'heddle-frame': `${ASSET_BASE}/heddle-frame.svg`,
    'winding-frame': `${ASSET_BASE}/winding-frame.svg`,
    'cloth-beam': `${ASSET_BASE}/cloth-beam.svg`,
    'fiber-bundle': `${ASSET_BASE}/fiber-bundle.svg`,
    'tied-knot': `${ASSET_BASE}/tied-knot.svg`,
    shuttle: `${ASSET_BASE}/shuttle.svg`,
};
/** Map ComfyUI knot types to their loom visual equivalents */
function getLoomMapping(knot) {
    switch (knot.type) {
        case 'CheckpointLoaderSimple':
            return {
                asset: 'spindle',
                label: 'Spindle',
                description: 'The spindle holds the raw fiber of your model — all potential forms wound tight, waiting to be drawn out and spun into thread.',
                size: { width: 100, height: 120 },
                facade: null, // select control for model deferred to later
            };
        case 'CLIPTextEncode':
            return {
                asset: 'dye-vat',
                label: 'Dye Vat',
                description: 'The dye vat colors the thread with meaning. Drop in your words and the fibers absorb their essence.',
                size: { width: 100, height: 100 },
                facade: {
                    controls: [
                        {
                            id: 'prompt-text',
                            controlType: 'text',
                            binding: {
                                knotId: knot.id,
                                dataPath: 'inputs.text',
                            },
                            label: 'Dye Recipe',
                            position: { x: 0.5, y: 0.85 },
                        },
                    ],
                },
            };
        case 'KSampler':
            return {
                asset: 'heddle-frame',
                label: 'Heddle Frame',
                description: 'The heddle frame is the heart of the loom — lifting and lowering threads in precise patterns to weave the fabric of your image.',
                size: { width: 120, height: 100 },
                facade: {
                    controls: [
                        {
                            id: 'steps-slider',
                            controlType: 'slider',
                            binding: {
                                knotId: knot.id,
                                dataPath: 'inputs.steps',
                                min: 1,
                                max: 100,
                                step: 1,
                            },
                            label: 'Passes',
                            position: { x: 0.2, y: 0.9 },
                        },
                        {
                            id: 'cfg-slider',
                            controlType: 'slider',
                            binding: {
                                knotId: knot.id,
                                dataPath: 'inputs.cfg',
                                min: 1,
                                max: 30,
                                step: 0.5,
                            },
                            label: 'Tension',
                            position: { x: 0.8, y: 0.9 },
                        },
                    ],
                },
            };
        case 'VAEDecode':
            return {
                asset: 'winding-frame',
                label: 'Winding Frame',
                description: 'The winding frame draws the hidden pattern out from latent space, cranking until the image reveals itself on the thread.',
                size: { width: 100, height: 100 },
                facade: null,
            };
        case 'SaveImage':
            return {
                asset: 'cloth-beam',
                label: 'Cloth Beam',
                description: 'The cloth beam receives the finished fabric — your woven image, rolled and ready to display.',
                size: { width: 100, height: 100 },
                facade: null,
            };
        case 'EmptyLatentImage':
            return {
                asset: 'fiber-bundle',
                label: 'Fiber Bundle',
                description: 'A bundle of raw fibers — the blank canvas of potential, sized and ready to be spun into latent thread.',
                size: { width: 100, height: 100 },
                facade: {
                    controls: [
                        {
                            id: 'width-slider',
                            controlType: 'slider',
                            binding: {
                                knotId: knot.id,
                                dataPath: 'inputs.width',
                                min: 64,
                                max: 2048,
                                step: 64,
                            },
                            label: 'Width',
                            position: { x: 0.3, y: 0.9 },
                        },
                        {
                            id: 'height-slider',
                            controlType: 'slider',
                            binding: {
                                knotId: knot.id,
                                dataPath: 'inputs.height',
                                min: 64,
                                max: 2048,
                                step: 64,
                            },
                            label: 'Height',
                            position: { x: 0.7, y: 0.9 },
                        },
                    ],
                },
            };
        default:
            return {
                asset: 'tied-knot',
                label: 'Tied Knot',
                description: 'A tied knot in the weave — a point where threads meet and hold.',
                size: { width: 80, height: 80 },
                facade: null,
            };
    }
}
// ─── Thread Color Mapping ───────────────────────────────────────
/** Map data types to thread visual styles */
function getThreadVisual(thread, sourceKnot, targetKnot) {
    // Infer data type from source knot's output or thread data
    const dataType = inferDataType(thread, sourceKnot);
    switch (dataType) {
        case 'MODEL':
            return { color: '#6a9a6a', width: 4, style: 'solid' };
        case 'CLIP':
            return { color: '#9a6a9a', width: 2, style: 'solid' };
        case 'CONDITIONING':
            return { color: '#9a6aaa', width: 2.5, style: 'solid' };
        case 'LATENT':
            return { color: '#aa9a5a', width: 3, style: 'animated' };
        case 'IMAGE':
            return { color: '#5a9aaa', width: 3.5, style: 'solid' };
        case 'VAE':
            return { color: '#aa6a5a', width: 2, style: 'dashed' };
        default:
            return { color: '#4a4a6a', width: 2, style: 'solid' };
    }
}
/** Infer the data type flowing through a thread from its source knot */
function inferDataType(thread, sourceKnot) {
    // Check thread data for explicit type
    if (thread.data?.type && typeof thread.data.type === 'string') {
        return thread.data.type;
    }
    // Infer from source knot type
    switch (sourceKnot.type) {
        case 'CheckpointLoaderSimple':
            return 'MODEL'; // Primary output; also outputs CLIP and VAE
        case 'CLIPTextEncode':
            return 'CONDITIONING';
        case 'KSampler':
            return 'LATENT';
        case 'VAEDecode':
            return 'IMAGE';
        case 'EmptyLatentImage':
            return 'LATENT';
        default:
            return '*';
    }
}
// ─── Loom Theme Implementation ──────────────────────────────────
const sceneConfig = {
    background: '#0a0a0a',
    layoutMode: 'horizontal',
    spacing: { x: 300, y: 200 },
};
export const LoomTheme = {
    id: 'loom',
    name: 'The Loom',
    description: 'The weaving lexicon made visible — spindles, dye vats, heddle frames, and shuttles transform your workflow into a living tapestry.',
    enchantKnot(knot, context) {
        const mapping = getLoomMapping(knot);
        // If this knot is unveiled, show a thin glamour (raw info)
        if (context.unveiledKnots.has(knot.id)) {
            return {
                veils: [knot.id],
                visual: { type: 'color', fill: '#1a1a2e', stroke: '#3a3a5a', shape: 'rect' },
                facade: null,
                label: `${knot.label} [${knot.type}]`,
                tooltip: mapping.description,
                position: knot.position,
                size: { width: mapping.size.width, height: 40 },
                depth: 1,
            };
        }
        const visual = { type: 'svg', path: ASSETS[mapping.asset] };
        return {
            veils: [knot.id],
            visual,
            facade: mapping.facade,
            label: mapping.label,
            tooltip: mapping.description,
            position: knot.position,
            size: mapping.size,
            depth: 2,
        };
    },
    enchantThread(thread, sourceKnot, targetKnot, _context) {
        return {
            threadId: thread.id,
            visual: getThreadVisual(thread, sourceKnot, targetKnot),
            label: thread.label,
        };
    },
    enchantWave(_wave, _knot, _context) {
        // Shuttle movement: enter → cross → exit
        return {
            duration: 300,
            keyframes: [
                { time: 0, properties: { x: -30, opacity: 0 }, easing: 'easeIn' },
                { time: 0.3, properties: { x: 0, opacity: 1 }, easing: 'easeOut' },
                { time: 0.7, properties: { x: 0, opacity: 1 }, easing: 'easeIn' },
                { time: 1, properties: { x: 30, opacity: 0 }, easing: 'easeOut' },
            ],
            loop: false,
        };
    },
    canMerge(_knotIds, _context) {
        // Phase 3: no subgraph merging
        return false;
    },
    enchantSubgraph(_knotIds, _context) {
        throw new Error('Subgraph glamours not implemented in Phase 3 — use canMerge() to check first');
    },
    describeWeave(weave) {
        const knotCount = weave.knots.size;
        const threadCount = weave.threads.size;
        if (knotCount === 0) {
            return 'An empty loom awaits — no fibers have been placed, no threads strung.';
        }
        return `A tapestry of ${knotCount} element${knotCount !== 1 ? 's' : ''} woven across the loom, connected by ${threadCount} thread${threadCount !== 1 ? 's' : ''}. The warp is strung and ready to weave.`;
    },
    describeKnot(knot, _weave) {
        const mapping = getLoomMapping(knot);
        return mapping.description;
    },
    sceneConfig,
    aiSystemPrompt: `You are describing a weaving workflow using the Loom glamour theme.
Use weaving terminology exclusively:
- Knots are loom components: spindles (model loaders), dye vats (text encoders), heddle frames (samplers), winding frames (VAE decoders), cloth beams (image savers), fiber bundles (latent images)
- Connections are literal threads colored by data type (dark fiber for MODEL, colored thread for CLIP, shimmering thread for LATENT, bright thread for IMAGE)
- Data flow is a shuttle carrying weft thread across the warp
- Execution is "weaving" — the loom processes fibers into finished cloth
- The whole workflow is a tapestry being woven on the loom

Describe what each component does using this metaphor naturally. The user should understand the workflow through the act of weaving without needing to know the technical terms underneath.`,
};
//# sourceMappingURL=index.js.map
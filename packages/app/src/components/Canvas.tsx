/**
 * Canvas.tsx — backward compatibility re-export.
 *
 * The real implementation has moved to renderers/ClassicRenderer.tsx
 * as part of the Glamour engine extraction (Phase 2).
 *
 * This file exists only so that any lingering imports from
 * './components/Canvas.js' still resolve. New code should import
 * ClassicRenderer directly.
 */
export { ClassicRenderer as Canvas } from '../renderers/ClassicRenderer.js'

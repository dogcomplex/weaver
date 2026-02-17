// Types
export type {
  // Shared (extracted from app)
  SelectionType,
  Selection,
  ViewMode,
  WeaveAction,

  // Renderer abstraction
  WeaveRendererDefinition,
  WeaveRendererProps,

  // Glamour theme
  EnchantContext,
  GlamourTheme,
  GlamourSceneConfig,

  // Glamour elements
  GlamourElement,
  GlamourConnection,
  GlamourVisual,
  GlamourConnectionVisual,

  // Facade
  FacadeDefinition,
  FacadeControl,
  FacadeControlType,
  FacadeBinding,

  // Animation
  AnimationState,
  AnimationTimeline,
  AnimationEvent,
  KnotHighlight,
  ThreadHighlight,
  GlamourAnimation,
  GlamourKeyframe,

  // Asset resolution
  GlamourAsset,
  AssetResolution,
} from './types.js'

// Registry
export { RendererRegistry, ThemeRegistry } from './registry.js'

// Animation
export { buildTimeline, interpolateHighlights } from './animation.js'

// Asset resolution
export { hashKnotConfig, GlamourAssetResolver } from './asset-resolver.js'

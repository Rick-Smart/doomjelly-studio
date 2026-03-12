// Shared constants & factory functions

export const MAX_HISTORY = 50;
export const MAX_COLOUR_HISTORY = 20;
export const MAX_ZOOM = 64;

// Common pixel-art sprite sizes, roughly ordered smallest → largest.
// 16×16 and 32×32 are the most popular for modern indie games.
export const CANVAS_SIZES = [
  { label: "8×8", w: 8, h: 8 },
  { label: "16×16", w: 16, h: 16 },
  { label: "16×32", w: 16, h: 32 },
  { label: "32×32", w: 32, h: 32 },
  { label: "32×64", w: 32, h: 64 },
  { label: "48×48", w: 48, h: 48 },
  { label: "64×64", w: 64, h: 64 },
  { label: "128×128", w: 128, h: 128 },
  { label: "256×256", w: 256, h: 256 },
];

export const TOOL_GROUPS = [
  {
    label: "Select",
    tools: [
      { id: "select-rect", icon: "⬚", title: "Rect Select (M)" },
      { id: "select-lasso", icon: "⌾", title: "Lasso Select" },
      { id: "select-wand", icon: "⁂", title: "Magic Wand (W)" },
      { id: "move", icon: "✥", title: "Move Selection (V)" },
    ],
  },
  {
    label: "Draw",
    tools: [
      { id: "pencil", icon: "✏", title: "Pencil (P)" },
      { id: "eraser", icon: "⌫", title: "Eraser (E)" },
      { id: "fill", icon: "▨", title: "Fill Bucket (F)" },
      { id: "picker", icon: "⊕", title: "Color Picker (I)" },
    ],
  },
  {
    label: "Shape",
    tools: [
      { id: "line", icon: "╱", title: "Line (L)" },
      { id: "rect", icon: "□", title: "Rectangle (R)" },
      { id: "ellipse", icon: "○", title: "Ellipse (O)" },
      { id: "spray", icon: "⋮⋮", title: "Spray (A)" },
    ],
  },
];

export const BRUSH_TYPES = [
  { id: "round", label: "Round", title: "Round brush — circular stamp" },
  {
    id: "square",
    label: "Square",
    title: "Square brush — axis-aligned square stamp",
  },
  {
    id: "diamond",
    label: "Diamond",
    title: "Diamond brush — 45° rotated square (Manhattan distance)",
  },
  { id: "cross", label: "Cross", title: "Cross brush — plus-shaped stamp" },
  {
    id: "star",
    label: "Star",
    title: "Star brush — 8-point star (cross + diagonals)",
  },
  { id: "ring", label: "Ring", title: "Ring brush — hollow circle outline" },
  {
    id: "slash",
    label: "Slash",
    title: "Slash brush — NE diagonal line (45°)",
  },
  {
    id: "bslash",
    label: "BSlash",
    title: "Back-slash brush — NW diagonal line (45°)",
  },
  {
    id: "pixel",
    label: "Pixel",
    title: "Pixel brush — always paints exactly 1×1 regardless of size",
  },
  {
    id: "dither",
    label: "Dither",
    title: "Dither brush — checkerboard 25% pattern",
  },
  {
    id: "dither2",
    label: "50% Dith",
    title: "Dither brush — checkerboard 50% fill",
  },
];

export const BLEND_MODES = [
  { id: "normal", label: "Normal" },
  { id: "multiply", label: "Multiply" },
  { id: "screen", label: "Screen" },
  { id: "overlay", label: "Overlay" },
  { id: "lighter", label: "Add" },
  { id: "color-dodge", label: "Dodge" },
  { id: "color-burn", label: "Burn" },
  { id: "hard-light", label: "Hard Lt" },
  { id: "soft-light", label: "Soft Lt" },
  { id: "difference", label: "Diff" },
  { id: "exclusion", label: "Excl" },
];

export const PANEL_TABS = [
  { id: "palette", icon: "🎨", label: "Palette" },
  { id: "brush", icon: "🖌", label: "Brush" },
  { id: "selection", icon: "⬚", label: "Select" },
  { id: "layers", icon: "⧉", label: "Layers" },
  { id: "canvas", icon: "📐", label: "Canvas" },
  { id: "view", icon: "🖼", label: "View" },
];

let _layerIdCounter = 1;
export function makeLayer(name) {
  return {
    id: `layer-${_layerIdCounter++}`,
    name,
    visible: true,
    opacity: 1.0,
    locked: false,
    blendMode: "normal",
    hasMask: false,
  };
}

let _frameIdCounter = 0;
export function makeFrame(name) {
  return { id: `frame-${_frameIdCounter++}`, name };
}

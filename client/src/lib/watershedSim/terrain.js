// Terrain generation, hydrology routing, land-use assignment for the
// Watershed Defender V2 simulation. Pure JS, no React, no DOM.
//
// Coordinate system: offset (col, row) for a pointy-top hex grid. Cells
// indexed in a flat array of length cols*rows; access via cellIndex(c,r).
//
// World inspiration: a generic Northern Ontario / Great Lakes drainage —
// forested headwaters (north/top), agricultural midslope, urban + industrial
// near the lake outlet (south/bottom). Simulated, NOT real measurements.

export const LAND_USE = Object.freeze({
  FOREST:      'forest',
  RIPARIAN:    'riparian',
  AGRICULTURE: 'agriculture',
  URBAN:       'urban',
  INDUSTRIAL:  'industrial',
  WETLAND:     'wetland',       // can become this via intervention
  LAKE:        'lake',
  STREAM:      'stream',
})

// Hex grid neighbour offsets for offset (col, row) coords, pointy-top, even-r.
// Order is deterministic so flow direction ties resolve consistently.
const NEIGHBOR_OFFSETS_EVEN_R = [
  [-1,  0], [+1,  0], [-1, -1], [ 0, -1], [-1, +1], [ 0, +1],
]
const NEIGHBOR_OFFSETS_ODD_R = [
  [-1,  0], [+1,  0], [ 0, -1], [+1, -1], [ 0, +1], [+1, +1],
]

export function neighborOffsets(row) {
  return (row & 1) === 0 ? NEIGHBOR_OFFSETS_EVEN_R : NEIGHBOR_OFFSETS_ODD_R
}

// ── Deterministic value-noise (no external dep) ──────────────────────────────
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0
  h = (h ^ (h >> 13)) * 1274126177 | 0
  return ((h >>> 0) / 0xffffffff)
}
function smoothstep(t) { return t * t * (3 - 2 * t) }
function lerp(a, b, t) { return a + (b - a) * t }
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = smoothstep(x - xi), yf = smoothstep(y - yi)
  const v00 = hash(xi, yi, seed)
  const v10 = hash(xi + 1, yi, seed)
  const v01 = hash(xi, yi + 1, seed)
  const v11 = hash(xi + 1, yi + 1, seed)
  return lerp(lerp(v00, v10, xf), lerp(v01, v11, xf), yf)
}
function fractalNoise(x, y, seed, octaves = 4) {
  let total = 0, amp = 1, freq = 1, max = 0
  for (let i = 0; i < octaves; i++) {
    total += valueNoise(x * freq, y * freq, seed + i * 31) * amp
    max += amp
    amp *= 0.5
    freq *= 2
  }
  return total / max
}

// ── Grid construction ────────────────────────────────────────────────────────
export function createTerrain({ cols = 24, rows = 18, seed = 1, lakeRows = 2 } = {}) {
  const n = cols * rows
  const cells = new Array(n)
  const idx = (c, r) => r * cols + c
  const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows

  // Pass 1 — elevation: high at top, sloping toward lake at bottom + noise
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const baseSlope = 1 - r / (rows - 1)         // 1 (top) → 0 (bottom)
      const noise = fractalNoise(c / 4, r / 4, seed, 4)
      let elev = baseSlope * 0.65 + noise * 0.35
      // Force the bottom lakeRows to be a flat lake basin
      if (r >= rows - lakeRows) elev = -0.2
      cells[idx(c, r)] = {
        c, r,
        elev,
        landUse: null,             // set in pass 3
        isStream: false,           // set in pass 2
        flowAcc: 1,                // set in pass 2 (self-contribution = 1)
        flowToward: null,          // [c, r] of downstream neighbour, set in pass 2
        // Per-tick state (mutated by hydrology engine)
        nutrient: 0,    // mg/L equivalent (N+P combined for simplicity)
        sediment: 0,    // NTU equivalent
        chloride: 0,    // mg/L (conservative — accumulates)
        toxics: 0,      // arbitrary index, slow accumulator
        // Intervention placed on this cell (string id from interventions.js, or null)
        intervention: null,
        interventionAge: 0,        // years since placed; ramps performance
      }
    }
  }

  // Pass 2 — flow direction (D6: lowest neighbour) + accumulation
  // First, compute flowToward for every land cell
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[idx(c, r)]
      if (cell.elev < 0) continue       // lake — no outflow
      let lowest = cell.elev
      let target = null
      for (const [dc, dr] of neighborOffsets(r)) {
        const nc = c + dc, nr = r + dr
        if (!inBounds(nc, nr)) continue
        const ne = cells[idx(nc, nr)]
        if (ne.elev < lowest) { lowest = ne.elev; target = [nc, nr] }
      }
      cell.flowToward = target
    }
  }
  // Sort cells from highest to lowest, then propagate accumulation downstream.
  // Standard O(n log n) flow accumulation algorithm.
  const order = cells
    .filter(c => c.elev >= 0)
    .slice()
    .sort((a, b) => b.elev - a.elev)
  for (const cell of order) {
    if (!cell.flowToward) continue
    const [tc, tr] = cell.flowToward
    cells[idx(tc, tr)].flowAcc += cell.flowAcc
  }
  // Stream threshold: cells whose drainage area exceeds ~3% of the grid
  const streamThreshold = Math.max(8, Math.floor(n * 0.03))
  for (const cell of cells) {
    if (cell.elev >= 0 && cell.flowAcc >= streamThreshold) cell.isStream = true
  }

  // Pass 3 — land use assignment
  const headwaterEnd = Math.floor(rows * 0.30)
  const agriEnd      = Math.floor(rows * 0.70)
  const urbanEnd     = rows - lakeRows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[idx(c, r)]
      if (cell.elev < 0) { cell.landUse = LAND_USE.LAKE; continue }
      // Streams / riparian first
      if (cell.isStream) {
        cell.landUse = LAND_USE.STREAM
        continue
      }
      // Riparian buffer: any non-stream cell adjacent to a stream
      let nearStream = false
      for (const [dc, dr] of neighborOffsets(r)) {
        const nc = c + dc, nr = r + dr
        if (!inBounds(nc, nr)) continue
        if (cells[idx(nc, nr)].isStream) { nearStream = true; break }
      }
      // Land-use band assignment
      const bandNoise = fractalNoise(c / 6 + 99, r / 6 + 99, seed + 7)
      if (r < headwaterEnd) {
        cell.landUse = nearStream ? LAND_USE.RIPARIAN : LAND_USE.FOREST
      } else if (r < agriEnd) {
        // Mid-slope: mostly ag, occasional forest patches
        if (nearStream && bandNoise > 0.35) cell.landUse = LAND_USE.RIPARIAN
        else if (bandNoise > 0.78) cell.landUse = LAND_USE.FOREST
        else cell.landUse = LAND_USE.AGRICULTURE
      } else if (r < urbanEnd) {
        // Lower mid: industrial pockets, mostly urban
        if (bandNoise > 0.72) cell.landUse = LAND_USE.INDUSTRIAL
        else cell.landUse = LAND_USE.URBAN
      } else {
        cell.landUse = LAND_USE.LAKE
      }
    }
  }

  // Identify the outlet cell (lake cell with highest flow accumulation feeding it)
  let outletCell = null
  let maxIncoming = 0
  for (let c = 0; c < cols; c++) {
    const r = rows - lakeRows
    const lake = cells[idx(c, r)]
    let incoming = 0
    for (const [dc, dr] of neighborOffsets(r)) {
      const nc = c + dc, nr = r + dr
      if (!inBounds(nc, nr)) continue
      const ne = cells[idx(nc, nr)]
      if (ne.flowToward && ne.flowToward[0] === c && ne.flowToward[1] === r) {
        incoming += ne.flowAcc
      }
    }
    if (incoming > maxIncoming) { maxIncoming = incoming; outletCell = lake }
  }

  return {
    cols, rows, lakeRows, seed, n,
    cells,
    idx,
    inBounds,
    outletCell,
    streamThreshold,
  }
}

// Pixel position of a hex centre given size in pixels (radius from centre to vertex).
export function hexToPixel(c, r, size) {
  const x = size * Math.sqrt(3) * (c + 0.5 * (r & 1))
  const y = size * 1.5 * r
  return { x, y }
}

// Six vertices of a pointy-top hex centred at (cx, cy) with given size.
export function hexCorners(cx, cy, size) {
  const out = new Array(6)
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i - 30)
    out[i] = { x: cx + size * Math.cos(ang), y: cy + size * Math.sin(ang) }
  }
  return out
}

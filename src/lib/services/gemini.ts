import * as FileSystem from 'expo-file-system/legacy';
import {
  PuzzleData,
  Domino,
  Region,
  Cell,
  ConstraintType,
  RegionConstraint,
  dominoId,
  REGION_COLORS,
  cellKey,
  ExtractionConfidence,
} from '../types/puzzle';

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_VIBECODE_OPENROUTER_API_KEY;
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

interface ExtractedCell {
  row: number;
  col: number;
}

interface ExtractedRegion {
  cells: ExtractedCell[];
  constraint_type: string;
  constraint_value?: number;
  color_description?: string;
  region_id?: string;
}

interface ExtractedDomino {
  pips: [number, number];
}

interface GridExtractionResponse {
  width: number;
  height: number;
  ascii_grid: string[];
  regions: {
    id: string;
    cells: string[]; // "R#,C#" format
    size: number;
    constraint_type: string;
    constraint_value?: number;
  }[];
  holes: string[]; // "R#,C#" format
  unconstrained_regions: string[]; // region IDs with "any" constraint
}

interface DominoExtractionResponse {
  dominoes: [number, number][];
}

export interface GridSizeHint {
  cols: number;
  rows: number;
  dominoCount: number;
}

// Re-export ExtractionConfidence from puzzle types for convenience
export type { ExtractionConfidence } from '../types/puzzle';

// Compare two domino arrays and return similarity score (0-1)
function compareDominoArrays(a: ExtractedDomino[], b: ExtractedDomino[]): { score: number; mismatches: number[] } {
  if (a.length !== b.length) {
    return { score: 0, mismatches: [] };
  }

  let matches = 0;
  const mismatches: number[] = [];

  for (let i = 0; i < a.length; i++) {
    const aVal = `${a[i].pips[0]},${a[i].pips[1]}`;
    const bVal = `${b[i].pips[0]},${b[i].pips[1]}`;
    // Check both orientations (dominoes can be read left-to-right or right-to-left)
    const bReversed = `${b[i].pips[1]},${b[i].pips[0]}`;

    if (aVal === bVal || aVal === bReversed) {
      matches++;
    } else {
      mismatches.push(i);
    }
  }

  return { score: matches / a.length, mismatches };
}

// Compare two grid responses and return similarity score (0-1) plus uncertain cells/regions
interface GridComparisonResult {
  score: number;
  warnings: string[];
  uncertainCells: string[];    // Cells that differ between passes
  uncertainRegions: string[];  // Regions with constraint disagreement
}

function compareGridResponses(a: GridExtractionResponse, b: GridExtractionResponse): GridComparisonResult {
  const warnings: string[] = [];
  const uncertainCells: string[] = [];
  const uncertainRegions: string[] = [];

  // Check dimensions
  if (a.width !== b.width || a.height !== b.height) {
    warnings.push(`Grid dimensions differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
    return { score: 0.5, warnings, uncertainCells, uncertainRegions };
  }

  // Check region count
  if (a.regions.length !== b.regions.length) {
    warnings.push(`Region count differs: ${a.regions.length} vs ${b.regions.length}`);
  }

  // Compare cells per region by building cell sets
  const aCells = new Set(a.regions.flatMap(r => r.cells));
  const bCells = new Set(b.regions.flatMap(r => r.cells));

  // Find cells that are uncertain (in one pass but not the other)
  for (const cell of aCells) {
    if (!bCells.has(cell)) {
      // Convert "R#,C#" format to "row,col" format
      const match = cell.match(/R(\d+),C(\d+)/);
      if (match) {
        uncertainCells.push(`${match[1]},${match[2]}`);
      }
    }
  }
  for (const cell of bCells) {
    if (!aCells.has(cell)) {
      const match = cell.match(/R(\d+),C(\d+)/);
      if (match) {
        const key = `${match[1]},${match[2]}`;
        if (!uncertainCells.includes(key)) {
          uncertainCells.push(key);
        }
      }
    }
  }

  let cellMatches = 0;
  for (const cell of aCells) {
    if (bCells.has(cell)) cellMatches++;
  }
  const cellScore = (aCells.size + bCells.size) > 0
    ? (2 * cellMatches) / (aCells.size + bCells.size)
    : 1;

  if (cellScore < 0.9) {
    warnings.push(`Cell positions differ significantly (${Math.round(cellScore * 100)}% match)`);
  }

  // Compare constraint types and track uncertain regions
  let constraintMatches = 0;
  for (const aRegion of a.regions) {
    const bRegion = b.regions.find(r => {
      // Match regions by overlapping cells
      const aRegionCells = new Set(aRegion.cells);
      const bRegionCells = new Set(r.cells);
      let overlap = 0;
      for (const c of aRegionCells) {
        if (bRegionCells.has(c)) overlap++;
      }
      return overlap >= aRegion.cells.length * 0.5;
    });

    if (bRegion && aRegion.constraint_type === bRegion.constraint_type) {
      if (aRegion.constraint_type === 'sum' || aRegion.constraint_type === 'less' || aRegion.constraint_type === 'greater') {
        if (aRegion.constraint_value === bRegion.constraint_value) {
          constraintMatches++;
        } else {
          warnings.push(`Constraint value differs for region: ${aRegion.constraint_value} vs ${bRegion.constraint_value}`);
          uncertainRegions.push(aRegion.id);
        }
      } else {
        constraintMatches++;
      }
    } else if (bRegion) {
      // Constraint type differs - mark region as uncertain
      uncertainRegions.push(aRegion.id);
    }
  }

  const constraintScore = a.regions.length > 0 ? constraintMatches / a.regions.length : 1;

  return {
    score: (cellScore + constraintScore) / 2,
    warnings,
    uncertainCells,
    uncertainRegions,
  };
}

// ==========================================
// Auto-detect grid dimensions from image
// Uses a fast model for quick dimension counting
// ==========================================
const DIMENSION_DETECTION_PROMPT = `You are analyzing a NYT Pips puzzle screenshot. Count the grid dimensions and dominoes.

## YOUR TASK
Look at the puzzle image and count:
1. The number of COLUMNS in the grid (colored cells across)
2. The number of ROWS in the grid (colored cells down)
3. The number of DOMINOES in the tray at the bottom

## IMPORTANT
- Count the BOUNDING BOX of the colored grid area (max columns, max rows)
- The grid may have irregular shapes (L, U, etc.) - count the full extent
- Dominoes are in a tray at the bottom, usually 2 rows of 4 = 8 dominoes
- Each domino has TWO halves with dots

## OUTPUT FORMAT
Return ONLY this JSON:
{"cols": <number>, "rows": <number>, "dominoes": <number>, "confidence": <0.0-1.0>}

Example: {"cols": 5, "rows": 4, "dominoes": 8, "confidence": 0.95}`;

export interface DetectedDimensions {
  cols: number;
  rows: number;
  dominoCount: number;
  confidence: number;
}

export async function detectGridDimensions(imageBase64: string): Promise<DetectedDimensions> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  console.log('[AI] Auto-detecting grid dimensions...');

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vibecode.com',
        'X-Title': 'Pips Solver',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Fast model for quick detection
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing puzzle images. Be precise and quick. Output only JSON.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: DIMENSION_DETECTION_PROMPT,
              },
            ],
          },
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const result: DetectedDimensions = {
      cols: parsed.cols || 5,
      rows: parsed.rows || 5,
      dominoCount: parsed.dominoes || 8,
      confidence: parsed.confidence || 0.5,
    };

    console.log('[AI] Detected dimensions:', result);
    return result;
  } catch (error) {
    console.warn('[AI] Dimension detection failed:', error);
    // Return default values on failure
    return {
      cols: 5,
      rows: 5,
      dominoCount: 8,
      confidence: 0.0,
    };
  }
}

// Check if a set of cells forms a contiguous region (connected by edges)
function checkRegionContiguity(cells: ExtractedCell[]): boolean {
  if (cells.length <= 1) return true;

  const cellSet = new Set(cells.map(c => `${c.row},${c.col}`));
  const visited = new Set<string>();
  const queue: ExtractedCell[] = [cells[0]];
  visited.add(`${cells[0].row},${cells[0].col}`);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = [
      { row: current.row - 1, col: current.col },
      { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 },
      { row: current.row, col: current.col + 1 },
    ];

    for (const n of neighbors) {
      const key = `${n.row},${n.col}`;
      if (cellSet.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(n);
      }
    }
  }

  return visited.size === cells.length;
}

// ==========================================
// Domino Extraction with GPT-5.2 (best for precise counting - halved error rates)
// Fallback: Qwen3-VL-235B (open-source, 32-language OCR, rivals GPT-5)
// ==========================================
const DOMINO_EXTRACTION_PROMPT = `You are analyzing domino tiles from a NYT Pips puzzle game screenshot.

## YOUR TASK
Count the pip dots on each domino tile in the DOMINO TRAY and report the values.

## DOMINO TRAY LOCATION
The domino tray is at the BOTTOM of the puzzle screen, below the main grid.
Dominoes are displayed horizontally in rows (typically 2 rows of 4 dominoes = 8 total).

## DOMINO ANATOMY
Each domino is a rectangular tile with TWO halves separated by a thin line:
- LEFT half contains 0-6 pips
- RIGHT half contains 0-6 pips
The dominoes have a white/cream background with black dots.

## PIP COUNTING GUIDE (CRITICAL - study these patterns)
- **0 pips**: Completely BLANK - no dots at all, just empty white space
- **1 pip**: Single dot in the CENTER of the half
- **2 pips**: Two dots positioned DIAGONALLY (opposite corners)
- **3 pips**: Three dots in a DIAGONAL LINE (corner to corner through center)
- **4 pips**: Four dots in the FOUR CORNERS (no center dot)
- **5 pips**: Four corner dots PLUS one CENTER dot (X pattern with center)
- **6 pips**: Six dots in TWO VERTICAL COLUMNS of three (|||)

## VISUAL EXAMPLES (ASCII representation)
0: [     ]     1: [  •  ]     2: [ •   ]     3: [ •   ]
   [     ]        [     ]        [   • ]        [  •  ]
   [     ]        [     ]        [     ]        [   • ]

4: [ • • ]     5: [ • • ]     6: [ • • ]
   [     ]        [  •  ]        [ • • ]
   [ • • ]        [ • • ]        [ • • ]

## READING ORDER
1. Find the domino tray at the BOTTOM of the image
2. Read dominoes LEFT to RIGHT in the TOP row first
3. Then read LEFT to RIGHT in the BOTTOM row
4. Typical layout: 4 dominoes per row, 2 rows = 8 dominoes total

## OUTPUT FORMAT
Return ONLY a JSON array of [left_pips, right_pips] pairs:
[[left1, right1], [left2, right2], ...]

Example for 8 dominoes: [[6, 6], [2, 1], [2, 2], [6, 0], [1, 2], [3, 3], [4, 2], [4, 5]]

## CRITICAL RULES
- Count EVERY visible domino in the tray, no exceptions
- Do NOT skip, merge, or assume any dominoes
- Do NOT normalize or sort - preserve exact left/right order as shown
- Output values in reading order (top-left to bottom-right)
- Each half can only be 0, 1, 2, 3, 4, 5, or 6 - never higher
- Double-check 5 vs 6 pips (5 has center dot + 4 corners, 6 has 2 columns of 3)

## COMMON MISTAKES TO AVOID
- Confusing 5 and 6 pips (most common error!)
  - 5 = X pattern with center: ⁙ (corners + middle)
  - 6 = two columns: ⁘ (3 dots in each column, no center)
- Missing blank (0 pip) halves - they exist and must be counted
- Counting shadow or reflection as extra pips
- Missing dominoes at edges of the tray

## EXAMPLE OUTPUT
For a puzzle with 8 dominoes arranged in 2 rows of 4:
Row 1: [3|2] [6|6] [0|4] [5|1]
Row 2: [2|2] [4|3] [1|0] [6|5]

Output: [[3,2], [6,6], [0,4], [5,1], [2,2], [4,3], [1,0], [6,5]]`;

async function extractDominoesFromImage(
  base64Image: string,
  expectedCount?: number
): Promise<ExtractedDomino[]> {
  console.log('[AI] Extracting dominoes with GPT-5.2...');
  console.log('[AI] API Key check - present:', !!OPENROUTER_API_KEY, 'length:', OPENROUTER_API_KEY?.length || 0);

  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured. Please add EXPO_PUBLIC_VIBECODE_OPENROUTER_API_KEY in the ENV tab.');
  }

  let prompt = DOMINO_EXTRACTION_PROMPT;
  if (expectedCount) {
    prompt = `${DOMINO_EXTRACTION_PROMPT}

## EXPECTED COUNT
There should be EXACTLY ${expectedCount} dominoes in the image.
If you count a different number, re-check carefully before outputting.`;
  }

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vibecode.com',
      'X-Title': 'Pips Solver',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5.2',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at counting dots on domino tiles. Be extremely precise. Count each half of each domino separately. Output only the JSON array requested, nothing else.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AI] GPT-5.2 API error:', errorText);
    throw new Error(`GPT-5.2 API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  console.log('[AI] GPT-5.2 domino response:', text);

  // Parse the response - handle various formats
  // Could be: [(3,5), (0,0)] or [[3,5], [0,0]] or [{"pips": [3,5]}]
  let dominoes: ExtractedDomino[] = [];

  // Try parsing as tuple format: [(3,5), (0,0)]
  const tupleMatch = text.match(/\[\s*\([\s\S]*?\)\s*\]/);
  if (tupleMatch) {
    const tupleStr = tupleMatch[0];
    const tupleRegex = /\((\d+)\s*,\s*(\d+)\)/g;
    let match;
    while ((match = tupleRegex.exec(tupleStr)) !== null) {
      dominoes.push({ pips: [parseInt(match[1]), parseInt(match[2])] });
    }
  }

  // If that didn't work, try JSON array format
  if (dominoes.length === 0) {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (Array.isArray(item) && item.length === 2) {
              dominoes.push({ pips: [item[0], item[1]] });
            } else if (item.pips && Array.isArray(item.pips)) {
              dominoes.push({ pips: [item.pips[0], item.pips[1]] });
            }
          }
        }
      } catch (e) {
        console.warn('[AI] Could not parse JSON array:', e);
      }
    }
  }

  console.log('[AI] Parsed dominoes:', dominoes.map(d => d.pips));
  return dominoes;
}

// ==========================================
// Grid Extraction with Gemini 3 Pro (#1 on Vision leaderboard - best for spatial reasoning)
// Fallback: Qwen3-VL-235B (open-source alternative, rivals Gemini 2.5 Pro)
// ==========================================
const GRID_EXTRACTION_PROMPT = `You are analyzing a NYT Pips puzzle screenshot. This is a domino placement puzzle with colored regions and constraint badges.

## CRITICAL: UNDERSTANDING THE PUZZLE IMAGE

The puzzle has TWO distinct parts:
1. **GRID AREA** (main portion): Contains colored cells with dashed boundaries forming regions
2. **DOMINO TRAY** (bottom): Shows available dominoes - IGNORE THIS for grid extraction

## REAL PIPS PUZZLE CHARACTERISTICS

### GRID SHAPES - INCLUDING DISCONNECTED ISLANDS
Pips puzzles have IRREGULAR shapes, NOT rectangular grids. Common patterns include:
- U-shapes (open at top or bottom)
- L-shapes
- Staircases
- Grids with holes in the middle
- **DISCONNECTED ISLANDS**: Some puzzles have TWO OR MORE separate groups of cells that are NOT connected to each other. These are still valid puzzles! Map BOTH/ALL islands.

### CELL APPEARANCE
- Colored cells: Have pastel background colors (pink, light blue, mint green, lavender, peach, light yellow, gray)
- Cells contain either: nothing (empty playable cell) OR domino pips if already placed
- Holes: Areas with NO cell at all (not colored) - these are gaps in the puzzle shape

### REGION BOUNDARIES
Regions are bounded by DASHED LINES (not solid lines):
- Same-colored cells separated by dashed lines = DIFFERENT regions
- Watch for dashed lines WITHIN a color area to identify separate regions

### CONSTRAINT BADGES (CRITICAL)
Constraints appear as small COLORED DIAMOND badges positioned at region edges/corners.
The diamond color often matches or complements the region color.

**Badge Types You Will See:**

1. **NUMBER ONLY** (e.g., "3", "5", "8", "12")
   - This is a SUM constraint
   - The total of all pips in that region must equal this number
   - Example: Badge shows "8" → pips in region must sum to 8

2. **EQUALS SIGN** ("=")
   - This is an EQUAL constraint
   - All pip values in the region must be the same
   - Example: Region with 4 cells showing "=" must have all same pip values

3. **LESS THAN** ("<" followed by number, e.g., "<2", "<4")
   - This is a LESS constraint
   - Each pip value in the region must be less than the number
   - Example: "<4" means all pips must be 0, 1, 2, or 3

4. **GREATER THAN** (">" followed by number, e.g., ">2")
   - This is a GREATER constraint
   - Each pip value in the region must be greater than the number
   - Example: ">2" means all pips must be 3, 4, 5, or 6

5. **NO BADGE** (no diamond visible for a region)
   - This is an ANY constraint (no restriction on pips)

## STEP-BY-STEP ANALYSIS

### STEP 1: Identify Grid Shape
- Look at the overall shape of the colored cell area
- Note where holes/gaps exist (no cells)
- Count actual COLUMNS and ROWS of the bounding box

### STEP 2: Map Each Position
Using Row 0 = TOP, Col 0 = LEFT:
- Colored cell → belongs to a region
- No cell (gap/hole) → mark as hole

### STEP 3: Identify Regions by DASHED BOUNDARIES
- Trace the dashed lines to find region boundaries
- Same color ≠ same region (dashed lines can split colors)
- Each distinct bounded area is its own region

### STEP 4: Read Constraint Badges
For each region, find its diamond badge (if any):
- Note the badge color and position
- Read the symbol/number inside
- Map to constraint type (sum/equal/less/greater/any)

## OUTPUT FORMAT

Provide ONLY this JSON (no other text):
{
  "width": <number of columns>,
  "height": <number of rows>,
  "ascii_grid": ["<row0 with letters for regions, # for holes>", ...],
  "regions": [
    {
      "id": "A",
      "cells": ["R0,C0", "R0,C1", "R1,C0"],
      "size": 3,
      "constraint_type": "sum",
      "constraint_value": 8
    },
    {
      "id": "B",
      "cells": ["R0,C2", "R0,C3"],
      "size": 2,
      "constraint_type": "equal"
    },
    {
      "id": "C",
      "cells": ["R1,C2"],
      "size": 1,
      "constraint_type": "less",
      "constraint_value": 4
    }
  ],
  "holes": ["R1,C1", "R2,C3"],
  "unconstrained_regions": ["D", "E"]
}

## CONSTRAINT TYPE MAPPING
- Number alone (3, 5, 8, 12) → "sum" with constraint_value = that number
- "=" symbol → "equal" (no constraint_value needed)
- "<N" → "less" with constraint_value = N
- ">N" → "greater" with constraint_value = N
- No badge → "any" (add region ID to unconstrained_regions)

## VALIDATION CHECKLIST
Before outputting, verify:
□ Every grid position is either in a region OR in holes
□ Each region's cells are contiguous (connected by edges) - but DIFFERENT regions can be disconnected from each other
□ The overall grid CAN have disconnected "islands" of cells - this is valid!
□ Constraint types match the badge symbols exactly
□ Sum constraints have numeric values matching the badge number
□ Less/greater constraints have the threshold number as constraint_value

## FEW-SHOT EXAMPLES

### Example 1: Simple 5x4 L-Shaped Grid
ASCII visualization:
\`\`\`
AABBB
A#CCC
DDEEF
DDE##
\`\`\`
Output:
{
  "width": 5,
  "height": 4,
  "ascii_grid": ["AABBB", "A#CCC", "DDEEF", "DDE##"],
  "regions": [
    {"id": "A", "cells": ["R0,C0", "R0,C1", "R1,C0"], "size": 3, "constraint_type": "sum", "constraint_value": 7},
    {"id": "B", "cells": ["R0,C2", "R0,C3", "R0,C4"], "size": 3, "constraint_type": "equal"},
    {"id": "C", "cells": ["R1,C2", "R1,C3", "R1,C4"], "size": 3, "constraint_type": "sum", "constraint_value": 9},
    {"id": "D", "cells": ["R2,C0", "R2,C1", "R3,C0", "R3,C1"], "size": 4, "constraint_type": "less", "constraint_value": 4},
    {"id": "E", "cells": ["R2,C2", "R2,C3", "R3,C2"], "size": 3, "constraint_type": "any"},
    {"id": "F", "cells": ["R2,C4"], "size": 1, "constraint_type": "greater", "constraint_value": 2}
  ],
  "holes": ["R1,C1", "R3,C3", "R3,C4"],
  "unconstrained_regions": ["E"]
}

### Example 2: U-Shaped Grid (Open at Bottom)
ASCII visualization:
\`\`\`
AABB
A##B
CCDD
\`\`\`
Output:
{
  "width": 4,
  "height": 3,
  "ascii_grid": ["AABB", "A##B", "CCDD"],
  "regions": [
    {"id": "A", "cells": ["R0,C0", "R0,C1", "R1,C0"], "size": 3, "constraint_type": "sum", "constraint_value": 5},
    {"id": "B", "cells": ["R0,C2", "R0,C3", "R1,C3"], "size": 3, "constraint_type": "equal"},
    {"id": "C", "cells": ["R2,C0", "R2,C1"], "size": 2, "constraint_type": "sum", "constraint_value": 6},
    {"id": "D", "cells": ["R2,C2", "R2,C3"], "size": 2, "constraint_type": "any"}
  ],
  "holes": ["R1,C1", "R1,C2"],
  "unconstrained_regions": ["D"]
}

### Example 3: Disconnected Islands (TWO SEPARATE GROUPS)
ASCII visualization:
\`\`\`
AAB##CCD
AAB##CCD
###EE###
###EE###
\`\`\`
Output:
{
  "width": 8,
  "height": 4,
  "ascii_grid": ["AAB##CCD", "AAB##CCD", "###EE###", "###EE###"],
  "regions": [
    {"id": "A", "cells": ["R0,C0", "R0,C1", "R1,C0", "R1,C1"], "size": 4, "constraint_type": "sum", "constraint_value": 10},
    {"id": "B", "cells": ["R0,C2", "R1,C2"], "size": 2, "constraint_type": "equal"},
    {"id": "C", "cells": ["R0,C5", "R0,C6", "R1,C5", "R1,C6"], "size": 4, "constraint_type": "less", "constraint_value": 3},
    {"id": "D", "cells": ["R0,C7", "R1,C7"], "size": 2, "constraint_type": "sum", "constraint_value": 8},
    {"id": "E", "cells": ["R2,C3", "R2,C4", "R3,C3", "R3,C4"], "size": 4, "constraint_type": "any"}
  ],
  "holes": ["R0,C3", "R0,C4", "R1,C3", "R1,C4", "R2,C0", "R2,C1", "R2,C2", "R2,C5", "R2,C6", "R2,C7", "R3,C0", "R3,C1", "R3,C2", "R3,C5", "R3,C6", "R3,C7"],
  "unconstrained_regions": ["E"]
}

## IMPORTANT: DISCONNECTED GRIDS
If the puzzle has two or more SEPARATE groups of colored cells with holes/gaps between them, this is called a "disconnected" or "island" grid. This is VALID. Map ALL islands. Do NOT assume all cells must be connected.

## COMMON NYT PIPS PATTERNS TO WATCH FOR
- L-shapes: Column on left + row at bottom (or variations)
- U-shapes: Two columns connected at top or bottom
- Staircase: Diagonal stepping pattern
- Center hole: Full grid with empty middle cells
- Islands: Multiple disconnected cell groups
- Same-color split: One color divided by dashed lines into 2+ regions`;

// Build grid data from ascii_grid when JSON is truncated
function buildGridFromAscii(width: number, height: number, asciiLines: string[]): GridExtractionResponse {
  const regions: GridExtractionResponse['regions'] = [];
  const holes: string[] = [];
  const regionMap = new Map<string, string[]>(); // letter -> cells

  for (let row = 0; row < asciiLines.length && row < height; row++) {
    const line = asciiLines[row];
    for (let col = 0; col < line.length && col < width; col++) {
      const char = line[col];
      const coord = `R${row},C${col}`;

      if (char === '#' || char === '.' || char === ' ') {
        holes.push(coord);
      } else {
        // It's a region letter
        if (!regionMap.has(char)) {
          regionMap.set(char, []);
        }
        regionMap.get(char)!.push(coord);
      }
    }
  }

  // Convert region map to regions array (all as 'any' constraint since we lost that info)
  for (const [id, cells] of regionMap) {
    regions.push({
      id,
      cells,
      size: cells.length,
      constraint_type: 'any', // Default to 'any' since we lost constraint info
    });
  }

  console.log('[AI] Built grid from ascii:', { regions: regions.length, holes: holes.length });

  return {
    width,
    height,
    ascii_grid: asciiLines,
    regions,
    holes,
    unconstrained_regions: regions.map(r => r.id),
  };
}

async function extractGridFromImage(
  base64Image: string,
  sizeHint?: GridSizeHint,
  attempt: number = 1
): Promise<GridExtractionResponse> {
  console.log(`[AI] Extracting grid with Gemini 3 Pro Preview (attempt ${attempt})...`);

  let prompt = GRID_EXTRACTION_PROMPT;

  if (sizeHint) {
    const expectedCells = sizeHint.dominoCount * 2;
    const totalGridCells = sizeHint.cols * sizeHint.rows;
    const expectedHoles = totalGridCells - expectedCells;

    prompt = `${GRID_EXTRACTION_PROMPT}

## KNOWN PUZZLE PARAMETERS (User-provided, MUST match your output):
- Grid dimensions: EXACTLY ${sizeHint.cols} columns × ${sizeHint.rows} rows
- Expected colored cells: EXACTLY ${expectedCells} (for ${sizeHint.dominoCount} dominoes × 2 cells each)
- Expected holes: EXACTLY ${expectedHoles}
- Total positions: ${totalGridCells}

## IMPORTANT: THIS MAY BE A DISCONNECTED GRID
If the colored cells form TWO OR MORE separate groups with gaps/holes between them, this is called a "disconnected" or "island" grid. This is VALID and EXPECTED. Map ALL islands carefully.

## GRID COORDINATE REFERENCE
${Array.from({ length: sizeHint.rows }, (_, r) =>
  `Row ${r}: ${Array.from({ length: sizeHint.cols }, (_, c) => `(${r},${c})`).join(' ')}`
).join('\n')}

## FINAL REQUIREMENTS
Your output MUST have:
- width: ${sizeHint.cols}
- height: ${sizeHint.rows}
- Total region cells: ${expectedCells}
- Total holes: ${expectedHoles}
- ascii_grid: ${sizeHint.rows} rows, each with ${sizeHint.cols} characters`;
  }

  // Use different models based on attempt - fallback if first fails
  // Attempt 1: gemini-3-pro-preview (best quality)
  // Attempt 2+: gemini-2.5-flash (faster, less reasoning-heavy)
  const model = attempt === 1 ? 'google/gemini-3-pro-preview' : 'google/gemini-2.5-flash';

  console.log(`[AI] Using model: ${model}`);

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vibecode.com',
      'X-Title': 'Pips Solver',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a visual puzzle analyst specializing in grid-based logic puzzles. Your task is to precisely extract the structure of a puzzle grid from an image.

CRITICAL RULES:
1. Be EXTREMELY precise about cell positions - Row 0 is TOP, Col 0 is LEFT
2. Regions are defined by DASHED BOUNDARIES, not just color similarity
3. Each region must be CONTIGUOUS (cells connected by edges)
4. Read constraint badges EXACTLY as shown - don't guess or infer
5. Every grid position must be classified as either a region cell or a hole
6. DISCONNECTED GRIDS ARE VALID: If the puzzle has multiple separate "islands" of cells, map ALL of them. Do not assume all cells must form one connected shape.
7. Output ONLY valid JSON, no explanations or markdown
8. DO NOT spend tokens explaining your reasoning - just output the JSON directly`
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 32000, // Increased to allow room for both reasoning and output
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI] ${model} grid API error:`, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  let text = data.choices?.[0]?.message?.content?.trim() || '';
  console.log(`[AI] ${model} grid response length:`, text.length);
  console.log(`[AI] ${model} grid response preview:`, text.slice(0, 500));

  // Check for empty response - common when model uses all tokens on reasoning
  if (!text || text.length < 10) {
    // Check if there's reasoning content (model spent all tokens thinking)
    const reasoning = data.choices?.[0]?.message?.reasoning;
    const finishReason = data.choices?.[0]?.finish_reason || data.choices?.[0]?.native_finish_reason;

    console.error('[AI] Empty or too short content from Gemini');
    console.error('[AI] Finish reason:', finishReason);
    console.error('[AI] Has reasoning:', !!reasoning, reasoning ? `(${reasoning.length} chars)` : '');

    if (finishReason === 'length' || finishReason === 'MAX_TOKENS') {
      throw new Error('Model ran out of tokens (spent on reasoning). Retrying with different approach...');
    }

    throw new Error('Gemini returned empty response - may be a complex/disconnected grid. Retrying...');
  }

  // Clean and parse JSON
  let cleanedText = text;
  cleanedText = cleanedText.replace(/```json\s*/gi, '');
  cleanedText = cleanedText.replace(/```\s*/g, '');
  cleanedText = cleanedText.trim();

  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse grid response');
  }

  let gridData: GridExtractionResponse;
  try {
    gridData = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    // Try to fix truncated JSON by adding missing closing brackets
    console.warn('[AI] JSON parse failed, attempting to fix truncated response...');
    let fixedJson = jsonMatch[0];

    // Count unclosed brackets
    let openBraces = 0;
    let openBrackets = 0;
    for (const char of fixedJson) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }

    // Add missing closing brackets
    while (openBrackets > 0) {
      fixedJson += ']';
      openBrackets--;
    }
    while (openBraces > 0) {
      fixedJson += '}';
      openBraces--;
    }

    try {
      gridData = JSON.parse(fixedJson);
      console.log('[AI] Successfully parsed after fixing truncated JSON');
    } catch (e2) {
      // If still failing, try to extract what we can from ascii_grid
      console.warn('[AI] Still failed after fix, trying to extract from ascii_grid...');

      // Try to at least get width/height/ascii_grid from partial response
      const widthMatch = cleanedText.match(/"width"\s*:\s*(\d+)/);
      const heightMatch = cleanedText.match(/"height"\s*:\s*(\d+)/);
      const asciiMatch = cleanedText.match(/"ascii_grid"\s*:\s*\[([\s\S]*?)\]/);

      if (widthMatch && heightMatch && asciiMatch) {
        const width = parseInt(widthMatch[1]);
        const height = parseInt(heightMatch[1]);
        const asciiLines = asciiMatch[1].match(/"([^"]+)"/g)?.map((s: string) => s.replace(/"/g, '')) || [];

        console.log('[AI] Extracted partial data:', { width, height, asciiLines });

        // Build regions from ascii_grid
        gridData = buildGridFromAscii(width, height, asciiLines);
      } else {
        throw new Error(`Could not parse grid response: ${parseError}`);
      }
    }
  }

  console.log('[AI] Parsed grid:', {
    width: gridData.width,
    height: gridData.height,
    regions: gridData.regions?.length,
    holes: gridData.holes?.length,
  });

  // Validate and potentially fix the grid data
  gridData = validateAndFixGridData(gridData, sizeHint);

  return gridData;
}

// Validate grid data and fix common issues
function validateAndFixGridData(
  gridData: GridExtractionResponse,
  sizeHint?: GridSizeHint
): GridExtractionResponse {
  const fixed = { ...gridData };

  // Ensure arrays exist
  fixed.regions = fixed.regions || [];
  fixed.holes = fixed.holes || [];
  fixed.ascii_grid = fixed.ascii_grid || [];

  // Apply size hint if provided
  if (sizeHint) {
    fixed.width = sizeHint.cols;
    fixed.height = sizeHint.rows;
  }

  // Collect all cells from regions
  const allRegionCells = new Set<string>();
  for (const region of fixed.regions) {
    for (const coord of region.cells || []) {
      const cell = parseCoordinate(coord);
      if (cell) {
        allRegionCells.add(`${cell.row},${cell.col}`);
      }
    }
  }

  // Collect all holes
  const allHoles = new Set<string>();
  for (const coord of fixed.holes) {
    const cell = parseCoordinate(coord);
    if (cell) {
      allHoles.add(`${cell.row},${cell.col}`);
    }
  }

  // Check for cells that are in both (shouldn't happen)
  const overlap = [...allRegionCells].filter(c => allHoles.has(c));
  if (overlap.length > 0) {
    console.warn(`[AI] Found ${overlap.length} cells in both regions and holes, removing from holes`);
    // Remove overlapping cells from holes (regions take priority)
    fixed.holes = fixed.holes.filter(coord => {
      const cell = parseCoordinate(coord);
      return cell ? !allRegionCells.has(`${cell.row},${cell.col}`) : true;
    });
  }

  // If we have size hints, check if all grid positions are accounted for
  if (sizeHint) {
    const expectedTotal = sizeHint.cols * sizeHint.rows;
    const actualTotal = allRegionCells.size + allHoles.size - overlap.length;

    if (actualTotal !== expectedTotal) {
      console.warn(`[AI] Grid coverage issue: ${actualTotal} cells accounted for, expected ${expectedTotal}`);

      // Find missing cells
      const missingCells: string[] = [];
      for (let r = 0; r < sizeHint.rows; r++) {
        for (let c = 0; c < sizeHint.cols; c++) {
          const key = `${r},${c}`;
          if (!allRegionCells.has(key) && !allHoles.has(key)) {
            missingCells.push(`R${r},C${c}`);
          }
        }
      }

      if (missingCells.length > 0) {
        console.warn(`[AI] Missing cells: ${missingCells.join(', ')}`);
        // Add missing cells as holes (conservative approach)
        fixed.holes = [...fixed.holes, ...missingCells];
      }
    }

    // Validate cell counts
    const expectedCells = sizeHint.dominoCount * 2;
    const actualCells = allRegionCells.size;
    if (actualCells !== expectedCells) {
      console.warn(`[AI] Cell count mismatch: ${actualCells} region cells, expected ${expectedCells}`);
    }
  }

  // Validate each region's contiguity
  for (const region of fixed.regions) {
    const cells: ExtractedCell[] = [];
    for (const coord of region.cells || []) {
      const cell = parseCoordinate(coord);
      if (cell) cells.push(cell);
    }

    if (cells.length > 1 && !checkRegionContiguity(cells)) {
      console.warn(`[AI] Region ${region.id} is not contiguous!`);
    }
  }

  return fixed;
}

// Parse "R#,C#" format to Cell
function parseCoordinate(coord: string): ExtractedCell | null {
  const match = coord.match(/R(\d+)\s*,\s*C(\d+)/i);
  if (match) {
    return { row: parseInt(match[1]), col: parseInt(match[2]) };
  }
  // Also try simple "row,col" format
  const simpleMatch = coord.match(/(\d+)\s*,\s*(\d+)/);
  if (simpleMatch) {
    return { row: parseInt(simpleMatch[1]), col: parseInt(simpleMatch[2]) };
  }
  return null;
}

// Convert grid extraction response to regions with cells
function convertGridResponseToRegions(gridData: GridExtractionResponse): {
  regions: ExtractedRegion[];
  validCells: ExtractedCell[];
  holes: ExtractedCell[];
} {
  const regions: ExtractedRegion[] = [];
  const validCells: ExtractedCell[] = [];
  const holes: ExtractedCell[] = [];

  // Parse holes
  for (const holeCoord of gridData.holes || []) {
    const cell = parseCoordinate(holeCoord);
    if (cell) {
      holes.push(cell);
    }
  }
  const holeSet = new Set(holes.map(h => `${h.row},${h.col}`));

  // Parse regions
  for (const region of gridData.regions || []) {
    const cells: ExtractedCell[] = [];
    for (const coord of region.cells || []) {
      const cell = parseCoordinate(coord);
      if (cell && !holeSet.has(`${cell.row},${cell.col}`)) {
        cells.push(cell);
        validCells.push(cell);
      }
    }

    // Normalize constraint type
    let constraintType = (region.constraint_type || 'any').toLowerCase();
    if (constraintType === '=' || constraintType === 'equals' || constraintType === 'same') {
      constraintType = 'equal';
    } else if (constraintType === '≠' || constraintType === 'unique' || constraintType === 'distinct') {
      constraintType = 'different';
    } else if (constraintType === '>' || constraintType === 'gt') {
      constraintType = 'greater';
    } else if (constraintType === '<' || constraintType === 'lt') {
      constraintType = 'less';
    } else if (constraintType === 'σ' || constraintType === 'total' || /^\d+$/.test(constraintType)) {
      constraintType = 'sum';
    } else if (constraintType === 'none' || constraintType === 'unknown' || constraintType === '') {
      constraintType = 'any';
    }

    regions.push({
      cells,
      constraint_type: constraintType,
      constraint_value: region.constraint_value,
      region_id: region.id,
    });
  }

  return { regions, validCells, holes };
}

// ==========================================
// NEW: Dual Extraction API
// ==========================================
export type ExtractionStage = 'idle' | 'cropping' | 'dominoes' | 'grid' | 'solving';

export async function extractPuzzleFromDualImages(
  dominoImageUri: string,
  gridImageUri: string,
  sizeHint?: GridSizeHint,
  onProgress?: (stage: ExtractionStage) => void
): Promise<PuzzleData> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured. Please add it in the ENV tab.');
  }

  console.log('[AI] Starting dual image extraction...');
  onProgress?.('cropping');

  // Read both images as base64
  const [dominoBase64, gridBase64] = await Promise.all([
    FileSystem.readAsStringAsync(dominoImageUri, {
      encoding: 'base64',
    }),
    FileSystem.readAsStringAsync(gridImageUri, {
      encoding: 'base64',
    }),
  ]);

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[AI] Dual extraction attempt ${attempt}/${MAX_RETRIES}...`);

      // Extract dominoes first
      onProgress?.('dominoes');
      const dominoResult = await extractDominoesFromImage(dominoBase64, sizeHint?.dominoCount);

      // Two-pass grid extraction for verification (improves accuracy on complex puzzles)
      onProgress?.('grid');
      console.log('[AI] Running two-pass grid verification...');

      // First pass with lower temperature (more deterministic)
      const gridPass1 = await extractGridFromImage(gridBase64, sizeHint, 1);

      // Second pass with higher temperature (for verification)
      const gridPass2 = await extractGridFromImage(gridBase64, sizeHint, 2);

      // Compare results and choose the best one
      const comparison = compareGridResponses(gridPass1, gridPass2);
      console.log(`[AI] Grid comparison score: ${(comparison.score * 100).toFixed(1)}%`);

      if (comparison.warnings.length > 0) {
        console.warn('[AI] Grid extraction warnings:', comparison.warnings);
      }

      // Use the first pass result (lower temperature = more consistent)
      // unless it has issues and the second pass looks better
      let gridResult = gridPass1;
      if (comparison.score < 0.8) {
        // Low agreement - check which one has more complete cells
        const pass1Cells = gridPass1.regions.reduce((acc, r) => acc + r.cells.length, 0);
        const pass2Cells = gridPass2.regions.reduce((acc, r) => acc + r.cells.length, 0);

        if (sizeHint) {
          const expectedCells = sizeHint.dominoCount * 2;
          const pass1Diff = Math.abs(pass1Cells - expectedCells);
          const pass2Diff = Math.abs(pass2Cells - expectedCells);

          if (pass2Diff < pass1Diff) {
            console.log('[AI] Using second pass result (better cell count match)');
            gridResult = gridPass2;
          }
        } else if (pass2Cells > pass1Cells) {
          console.log('[AI] Using second pass result (more cells found)');
          gridResult = gridPass2;
        }
      }

      // Convert grid response to our format
      const { regions, validCells, holes } = convertGridResponseToRegions(gridResult);

      // Validate counts
      if (sizeHint) {
        const expectedCells = sizeHint.dominoCount * 2;
        if (validCells.length !== expectedCells) {
          throw new Error(`Cell count mismatch: got ${validCells.length}, expected ${expectedCells}`);
        }
        if (dominoResult.length !== sizeHint.dominoCount) {
          throw new Error(`Domino count mismatch: got ${dominoResult.length}, expected ${sizeHint.dominoCount}`);
        }
      }

      // Build confidence metadata including uncertain cells/regions
      const confidence: ExtractionConfidence = {
        overall: comparison.score,
        dominoConfidence: 1.0, // Domino extraction is typically more reliable
        gridConfidence: comparison.score,
        warnings: comparison.warnings,
        uncertainCells: comparison.uncertainCells,
        uncertainRegions: comparison.uncertainRegions,
      };

      // Build puzzle data with confidence information
      const puzzleData = buildPuzzleData(
        gridResult.width || sizeHint?.cols || 5,
        gridResult.height || sizeHint?.rows || 5,
        validCells,
        regions,
        dominoResult,
        confidence
      );

      console.log('[AI] Dual extraction successful!', {
        dominoes: puzzleData.availableDominoes.length,
        cells: puzzleData.validCells.length,
        regions: puzzleData.regions.length,
        confidence: `${(confidence.overall * 100).toFixed(0)}%`,
        warnings: confidence.warnings.length,
        uncertainCells: confidence.uncertainCells.length,
        uncertainRegions: confidence.uncertainRegions.length,
      });

      return puzzleData;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[AI] Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < MAX_RETRIES) {
        console.log('[AI] Retrying...');
      }
    }
  }

  throw lastError || new Error('Failed to extract puzzle after multiple attempts');
}

function buildPuzzleData(
  width: number,
  height: number,
  validCells: ExtractedCell[],
  extractedRegions: ExtractedRegion[],
  extractedDominoes: ExtractedDomino[],
  confidence?: ExtractionConfidence
): PuzzleData {
  // Convert valid cells
  const cells: Cell[] = validCells.map((c) => ({
    row: c.row,
    col: c.col,
  }));

  // Valid constraint types
  const constraintTypeMap: Record<string, ConstraintType> = {
    'sum': 'sum',
    'equal': 'equal',
    'different': 'different',
    'greater': 'greater',
    'less': 'less',
    'any': 'any',
  };

  // Convert regions
  const regions: Region[] = extractedRegions.map((r, index) => {
    const constraintType = constraintTypeMap[r.constraint_type] || 'any';
    const constraint: RegionConstraint = {
      type: constraintType,
      value: r.constraint_value,
    };

    return {
      id: r.region_id || `region-${index}`,
      cells: (r.cells || []).map((c) => ({ row: c.row, col: c.col })),
      color: REGION_COLORS[index % REGION_COLORS.length],
      constraint,
    };
  });

  // Ensure all valid cells belong to a region
  const regionCells = new Set<string>();
  for (const region of regions) {
    for (const cell of region.cells) {
      regionCells.add(`${cell.row},${cell.col}`);
    }
  }

  // Find orphan cells
  const orphanCells: Cell[] = [];
  for (const cell of cells) {
    const key = `${cell.row},${cell.col}`;
    if (!regionCells.has(key)) {
      orphanCells.push(cell);
    }
  }

  if (orphanCells.length > 0) {
    console.warn(`[AI] Found ${orphanCells.length} orphan cells, adding to 'any' region`);
    regions.push({
      id: `region-orphan`,
      cells: orphanCells,
      color: REGION_COLORS[regions.length % REGION_COLORS.length],
      constraint: { type: 'any' },
    });
  }

  // Convert dominoes
  const availableDominoes: Domino[] = extractedDominoes.map((d, index) => {
    const pips: [number, number] = [
      Math.max(0, Math.min(6, d.pips[0] ?? 0)),
      Math.max(0, Math.min(6, d.pips[1] ?? 0)),
    ];
    return {
      id: `${dominoId(pips)}-${index}`,
      pips,
    };
  });

  return {
    width,
    height,
    validCells: cells,
    regions,
    availableDominoes,
    blockedCells: [],
    confidence,
  };
}

// ==========================================
// LEGACY: Single Image Extraction (kept for backwards compatibility)
// ==========================================
const EXTRACTION_PROMPT = `Analyze this NYT Pips puzzle screenshot. Extract the puzzle data precisely.

## COORDINATE SYSTEM (CRITICAL!)
- Row 0 is the TOP row of the grid
- Col 0 is the LEFT column
- (row, col) = (vertical position from top, horizontal position from left)
- Adjacent cells share an edge (not diagonal)

## THE PIPS PUZZLE GAME

Pips is a domino placement puzzle where:
- You place dominoes on a grid of cells
- Each domino covers exactly 2 adjacent cells (horizontal or vertical)
- Colored regions have constraints on pip values

## PUZZLE LAYOUT

The puzzle has TWO parts:
1. **GRID AREA** (main): Colored cells forming an irregular shape (L, U, staircase, etc.)
2. **DOMINO TRAY** (bottom): 2 rows of domino tiles to be placed

## VISUAL IDENTIFICATION

### COLORED CELLS (valid/playable):
- Have PASTEL background colors (pink, light blue, mint, lavender, peach, yellow, gray)
- These are where you place dominoes

### HOLES (blocked/non-playable):
- Areas with NO cell visible (gaps in the puzzle shape)
- NOT dark cells - just absence of colored cells

### REGIONS:
- Bounded by DASHED LINES (not solid)
- Same color with dashed line between = DIFFERENT regions

### CONSTRAINT BADGES (colored diamond shapes):
Badges appear at region edges/corners. Read the symbol inside:

- **NUMBER (3, 5, 8, 12)** = SUM constraint (pips must total this number)
- **"=" symbol** = EQUAL constraint (all pips must be same value)
- **"<N" (like <2, <4)** = LESS constraint (each pip < N)
- **">N" (like >2)** = GREATER constraint (each pip > N)
- **No badge** = ANY constraint (no restriction)

## STEP 1: READ THE DOMINOES CAREFULLY

Look at the domino tray at the BOTTOM of the screen.
Dominoes are arranged in ROWS. Read LEFT to RIGHT, TOP row to BOTTOM row.

HOW TO COUNT PIPS (dots) ON EACH HALF:
- 0 pips: BLANK - no dots at all
- 1 pip: ONE dot in the center
- 2 pips: TWO dots diagonally
- 3 pips: THREE dots in a diagonal line
- 4 pips: FOUR dots in corners
- 5 pips: FIVE dots - four corners + center
- 6 pips: SIX dots in two columns of 3

Record as [left_pips, right_pips] for each domino.

## STEP 2: IDENTIFY REGIONS BY DASHED BOUNDARIES

Trace the dashed lines to find region boundaries.
Each distinct bounded area is its own region with its own constraint.

## STEP 3: MAP THE GRID

Scan the grid systematically:
- Start at top-left (0,0)
- Go left to right, then next row
- Note each cell's region assignment

## OUTPUT FORMAT (JSON only):

{
  "width": 4,
  "height": 3,
  "holes": [{"row": 0, "col": 0}],
  "valid_cells": [{"row": 0, "col": 1}, {"row": 0, "col": 2}],
  "regions": [
    {
      "cells": [{"row": 0, "col": 1}, {"row": 0, "col": 2}],
      "constraint_type": "sum",
      "constraint_value": 8,
      "color_description": "pink"
    },
    {
      "cells": [{"row": 1, "col": 0}, {"row": 1, "col": 1}],
      "constraint_type": "equal",
      "color_description": "blue"
    },
    {
      "cells": [{"row": 2, "col": 0}],
      "constraint_type": "less",
      "constraint_value": 4,
      "color_description": "green"
    }
  ],
  "available_dominoes": [{"pips": [3, 5]}, {"pips": [0, 0]}]
}

## CONSTRAINT TYPE MAPPING
- Number badge (3, 5, 8, 12) → "sum" + constraint_value
- "=" badge → "equal"
- "<N" badge → "less" + constraint_value = N
- ">N" badge → "greater" + constraint_value = N
- No badge → "any"

## VALIDATION:
1. Each region's cells must be CONTIGUOUS (connected by edges)
2. valid_cells count = dominoes × 2
3. All region cells combined = valid_cells
4. Return ONLY JSON`;

interface PuzzleExtractionResponse {
  width: number;
  height: number;
  holes?: ExtractedCell[];
  valid_cells: ExtractedCell[];
  regions: ExtractedRegion[];
  available_dominoes: ExtractedDomino[];
}

export async function extractPuzzleFromImage(
  imageUri: string,
  sizeHint?: GridSizeHint
): Promise<PuzzleData> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured. Please add it in the ENV tab.');
  }

  // Read image as base64
  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: 'base64',
  });

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[AI] Attempt ${attempt}/${MAX_RETRIES}...`);
      const result = await attemptExtraction(base64Image, sizeHint, attempt);

      // If we have sizeHint, validate strictly
      if (sizeHint) {
        const expectedCells = sizeHint.dominoCount * 2;
        const actualCells = result.validCells.length;
        const actualDominoes = result.availableDominoes.length;

        if (actualCells !== expectedCells) {
          throw new Error(`Cell count mismatch: got ${actualCells}, expected ${expectedCells}`);
        }
        if (actualDominoes !== sizeHint.dominoCount) {
          throw new Error(`Domino count mismatch: got ${actualDominoes}, expected ${sizeHint.dominoCount}`);
        }
      }

      console.log('[AI] Extraction successful!');
      return result;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[AI] Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < MAX_RETRIES) {
        console.log('[AI] Retrying...');
      }
    }
  }

  throw lastError || new Error('Failed to extract puzzle after multiple attempts');
}

async function attemptExtraction(
  base64Image: string,
  sizeHint: GridSizeHint | undefined,
  attempt: number
): Promise<PuzzleData> {
  // Build the prompt for grid/regions (Gemini)
  let promptText = EXTRACTION_PROMPT;
  let systemPrompt = 'You are an expert at analyzing puzzle images. Extract data precisely and return only valid JSON.';

  if (sizeHint) {
    const expectedCells = sizeHint.dominoCount * 2;
    const totalGridCells = sizeHint.cols * sizeHint.rows;
    const holes = totalGridCells - expectedCells;

    systemPrompt = `You are an expert at analyzing NYT Pips puzzle images.

MATH CONSTRAINT (CANNOT BE VIOLATED):
- Total grid: ${totalGridCells} positions
- valid_cells: EXACTLY ${expectedCells}
- holes: EXACTLY ${holes}
- valid_cells + holes = ${totalGridCells} (every position is ONE or the OTHER, never both)

A position is EITHER a valid_cell OR a hole. NEVER BOTH.`;

    promptText = `PUZZLE MATH (ABSOLUTE):
- Grid: ${sizeHint.cols} columns × ${sizeHint.rows} rows = ${totalGridCells} positions total
- Dominoes: ${sizeHint.dominoCount}
- valid_cells needed: EXACTLY ${expectedCells} (= dominoes × 2)
- holes needed: EXACTLY ${holes} (= total - valid_cells)

CRITICAL RULES:
1. Each grid position is EITHER in valid_cells OR in holes, NEVER BOTH
2. valid_cells.length + holes.length MUST equal ${totalGridCells}
3. Puzzles often have IRREGULAR shapes - holes can be ANYWHERE (corners, edges, middle)

HOW TO IDENTIFY:
- COLORED cells (any visible color: pink, blue, green, yellow, orange, etc.) → valid_cells
- EMPTY/BLANK cells (white, gray, black, no color fill) → holes

SCAN STRATEGY FOR IRREGULAR GRIDS:
Go row by row, left to right. For each position, ask: "Does this cell have a colored background?"
- Yes → add to valid_cells
- No → add to holes

GRID COORDINATES (row 0 = top, col 0 = left):
${Array.from({ length: sizeHint.rows }, (_, r) =>
  `Row ${r}: ${Array.from({ length: sizeHint.cols }, (_, c) => `(${r},${c})`).join(' ')}`
).join('\n')}

FINAL CHECKLIST:
□ valid_cells has exactly ${expectedCells} items
□ holes has exactly ${holes} items
□ Every position (0,0) to (${sizeHint.rows - 1},${sizeHint.cols - 1}) is in exactly ONE array
□ Constraints match what you see on colored regions

${EXTRACTION_PROMPT}`;
  }

  console.log('[AI] Starting grid extraction with Gemini 3 Flash Preview...', sizeHint ? `expecting ${sizeHint.dominoCount * 2} cells` : 'no hints');

  // Increase temperature slightly on retries to get different results
  const temperature = 0.1 + (attempt - 1) * 0.1;

  // Use Gemini 3 Flash Preview for grid/regions (fast, cost-effective)
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vibecode.com',
      'X-Title': 'Pips Solver',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: promptText,
            },
          ],
        },
      ],
      max_tokens: 8000,
      temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AI] API error:', errorText);
    throw new Error(`Failed to analyze image: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    console.error('[AI] No text in response:', JSON.stringify(data));
    throw new Error('No response from AI');
  }

  console.log('[AI] Raw response length:', text.length);

  // Clean up the response - remove markdown code blocks and thinking tokens
  let cleanedText = text.trim();

  // Remove Qwen thinking tokens (wrapped in <think>...</think>)
  cleanedText = cleanedText.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Remove any other XML-like tags that might wrap the response
  cleanedText = cleanedText.replace(/<\/?[a-z_]+>/gi, '');

  // Remove various markdown formats
  const codeBlockPatterns = [
    /^```json\s*/i,
    /^```\s*/,
    /\s*```$/,
  ];

  for (const pattern of codeBlockPatterns) {
    cleanedText = cleanedText.replace(pattern, '');
  }
  cleanedText = cleanedText.trim();

  // Try to extract JSON if there's extra text
  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanedText = jsonMatch[0];
  }

  console.log('[AI] Cleaned response preview:', cleanedText.slice(0, 200) + '...');

  let extractedResponse: PuzzleExtractionResponse;
  try {
    extractedResponse = JSON.parse(cleanedText);
  } catch (e) {
    // Try to fix truncated JSON by adding closing brackets
    console.warn('[AI] Initial parse failed, attempting to fix truncated JSON...');

    // Count unclosed brackets
    let openBraces = 0;
    let openBrackets = 0;
    for (const char of cleanedText) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }

    // Add missing closing brackets
    let fixedText = cleanedText;
    while (openBrackets > 0) {
      fixedText += ']';
      openBrackets--;
    }
    while (openBraces > 0) {
      fixedText += '}';
      openBraces--;
    }

    try {
      extractedResponse = JSON.parse(fixedText);
      console.log('[AI] Successfully parsed after fixing truncated JSON');
    } catch (e2) {
      console.error('[AI] Failed to parse response even after fix:', cleanedText.slice(0, 500));
      throw new Error('Could not parse AI response. Please try again.');
    }
  }

  // Log what the AI returned before validation
  console.log('[AI] Raw extraction:', {
    width: extractedResponse.width,
    height: extractedResponse.height,
    validCellCount: extractedResponse.valid_cells?.length ?? 0,
    holeCount: extractedResponse.holes?.length ?? 0,
    regionCount: extractedResponse.regions?.length ?? 0,
    dominoCount: extractedResponse.available_dominoes?.length ?? 0,
  });

  // Log Gemini's domino values (for debugging - these will be replaced by GPT-5.2)
  console.log('[AI] Gemini Dominoes (will be replaced):', extractedResponse.available_dominoes?.map(d => d.pips));

  // Use GPT-5.2 for domino pip values if we know the count
  const dominoCount = sizeHint?.dominoCount ?? extractedResponse.available_dominoes?.length ?? 0;
  if (dominoCount > 0) {
    try {
      const gptDominoes = await extractDominoesFromImage(base64Image, dominoCount);
      if (gptDominoes.length === dominoCount) {
        console.log('[AI] Replacing Gemini dominoes with GPT-5.2 dominoes');
        extractedResponse.available_dominoes = gptDominoes;
      } else {
        console.warn(`[AI] GPT-5.2 returned ${gptDominoes.length} dominoes, expected ${dominoCount}. Keeping Gemini values.`);
      }
    } catch (gptError) {
      console.warn('[AI] GPT-5.2 domino extraction failed, keeping Gemini values:', gptError);
    }
  }

  // Log final domino values being used
  console.log('[AI] Final Dominoes:', extractedResponse.available_dominoes?.map(d => d.pips));

  // Early validation - if sizeHint provided, check raw counts
  if (sizeHint) {
    const expectedCells = sizeHint.dominoCount * 2;
    const totalGridCells = sizeHint.cols * sizeHint.rows;
    const rawValidCells = extractedResponse.valid_cells?.length ?? 0;
    const rawHoles = extractedResponse.holes?.length ?? 0;
    const rawDominoes = extractedResponse.available_dominoes?.length ?? 0;

    // Check if AI returned way off values
    if (rawValidCells === 0) {
      throw new Error(`AI returned 0 valid cells, expected ${expectedCells}`);
    }
    if (rawDominoes === 0) {
      throw new Error(`AI returned 0 dominoes, expected ${sizeHint.dominoCount}`);
    }

    // Check for overlapping cells (AI bug where same cell is in both arrays)
    const validSet = new Set((extractedResponse.valid_cells || []).map(c => `${c.row},${c.col}`));
    const holeSet = new Set((extractedResponse.holes || []).map(c => `${c.row},${c.col}`));
    const overlap = [...validSet].filter(c => holeSet.has(c));
    if (overlap.length > 0) {
      throw new Error(`AI returned ${overlap.length} cells in BOTH valid_cells and holes. Invalid.`);
    }

    // Check total adds up
    if (rawValidCells + rawHoles !== totalGridCells) {
      throw new Error(`valid_cells(${rawValidCells}) + holes(${rawHoles}) = ${rawValidCells + rawHoles}, expected ${totalGridCells}`);
    }
  }

  // Always validate domino count if sizeHint provided
  if (sizeHint) {
    const rawDominoes = extractedResponse.available_dominoes?.length ?? 0;
    if (rawDominoes === 0) {
      throw new Error(`AI returned 0 dominoes, expected ${sizeHint.dominoCount}`);
    }
  }

  // Validate and fix the extraction, passing size hint to enforce dimensions
  const fixedResponse = validateAndFixExtraction(extractedResponse, sizeHint);

  // Convert to our puzzle format
  const puzzleData = convertToPuzzleData(fixedResponse);

  console.log('[AI] Extracted puzzle:', {
    grid: `${puzzleData.width}x${puzzleData.height}`,
    cells: puzzleData.validCells.length,
    regions: puzzleData.regions.length,
    dominoes: puzzleData.availableDominoes.length,
    expectedCells: puzzleData.availableDominoes.length * 2,
  });

  return puzzleData;
}

function validateAndFixExtraction(response: PuzzleExtractionResponse, sizeHint?: GridSizeHint): PuzzleExtractionResponse {
  const fixed = { ...response };

  // Ensure arrays exist
  fixed.valid_cells = fixed.valid_cells || [];
  fixed.holes = fixed.holes || [];
  fixed.regions = fixed.regions || [];
  fixed.available_dominoes = fixed.available_dominoes || [];

  // Fix grid dimensions - use sizeHint if provided, otherwise use AI response
  if (sizeHint) {
    // Trust user-provided dimensions over AI calculation
    fixed.width = sizeHint.cols;
    fixed.height = sizeHint.rows;
  } else {
    fixed.width = Math.max(1, fixed.width || 5);
    fixed.height = Math.max(1, fixed.height || 4);
  }

  // REGIONS are the source of truth for valid cells
  // The AI explicitly assigns cells to colored regions, so those are definitely valid
  // If a cell appears in both holes AND a region, it's a valid cell (AI made an error in holes)

  // First, build the set of all cells that appear in regions
  const cellsFromRegions = new Set<string>();
  for (const region of fixed.regions) {
    for (const cell of region.cells || []) {
      cellsFromRegions.add(`${cell.row},${cell.col}`);
    }
  }

  // Also include cells from valid_cells list
  const allValidCells = new Set<string>(cellsFromRegions);
  for (const cell of fixed.valid_cells) {
    allValidCells.add(`${cell.row},${cell.col}`);
  }

  // Fix holes: remove any cell that's actually valid (appears in regions or valid_cells)
  // This handles the case where AI incorrectly marks a colored cell as a hole
  fixed.holes = fixed.holes.filter(c => !allValidCells.has(`${c.row},${c.col}`));
  const holeSet = new Set(fixed.holes.map(c => `${c.row},${c.col}`));

  // Build final valid_cells from all sources, excluding true holes
  fixed.valid_cells = [];
  const validCellSet = new Set<string>();
  for (const key of allValidCells) {
    if (!holeSet.has(key)) {
      const [row, col] = key.split(',').map(Number);
      fixed.valid_cells.push({ row, col });
      validCellSet.add(key);
    }
  }

  // Clean up region cells to exclude any true holes
  for (const region of fixed.regions) {
    region.cells = (region.cells || []).filter(c => !holeSet.has(`${c.row},${c.col}`));
  }

  // Validate region contiguity - warn if cells aren't connected
  for (const region of fixed.regions) {
    if (region.cells && region.cells.length > 1) {
      const isContiguous = checkRegionContiguity(region.cells);
      if (!isContiguous) {
        console.warn(`[AI] Region "${region.color_description}" has non-contiguous cells:`,
          region.cells.map(c => `(${c.row},${c.col})`).join(', '));
      }
    }
  }

  // Fix domino pips - clamp to 0-6
  // If sizeHint provided, enforce EXACT domino count
  if (sizeHint?.dominoCount) {
    // Truncate to exact count if too many
    if (fixed.available_dominoes.length > sizeHint.dominoCount) {
      console.log(`[AI] Truncating dominoes from ${fixed.available_dominoes.length} to ${sizeHint.dominoCount}`);
      fixed.available_dominoes = fixed.available_dominoes.slice(0, sizeHint.dominoCount);
    }
    // Don't pad if too few - let validation catch it and retry
  }

  for (const domino of fixed.available_dominoes) {
    if (!Array.isArray(domino.pips) || domino.pips.length !== 2) {
      domino.pips = [0, 0];
    } else {
      domino.pips = [
        Math.max(0, Math.min(6, Math.round(domino.pips[0] ?? 0))),
        Math.max(0, Math.min(6, Math.round(domino.pips[1] ?? 0))),
      ] as [number, number];
    }
  }

  // Check cell count vs domino count - log warning but don't auto-fix
  // Auto-fixing would require guessing region assignments which only the AI can determine
  const expectedCells = fixed.available_dominoes.length * 2;
  const actualCells = fixed.valid_cells.length;

  if (actualCells !== expectedCells) {
    console.warn(`[AI] Cell mismatch: ${actualCells} cells vs ${fixed.available_dominoes.length} dominoes (expected ${expectedCells} cells). User may need to edit manually.`);
  }

  // Ensure all valid cells belong to a region
  const regionCells = new Set<string>();
  for (const region of fixed.regions) {
    for (const cell of region.cells || []) {
      regionCells.add(`${cell.row},${cell.col}`);
    }
  }

  // Find orphan cells (valid but not in any region)
  const orphanCells: ExtractedCell[] = [];
  for (const cell of fixed.valid_cells) {
    const key = `${cell.row},${cell.col}`;
    if (!regionCells.has(key)) {
      orphanCells.push(cell);
    }
  }

  // Add orphan cells to an "any" region - user can reassign in edit mode
  if (orphanCells.length > 0) {
    console.warn(`[AI] Found ${orphanCells.length} orphan cells, adding to 'any' region. User should reassign.`);
    fixed.regions.push({
      cells: orphanCells,
      constraint_type: 'any',
      color_description: 'unknown',
    });
  }

  // If sizeHint provided, strictly enforce grid bounds - reject cells outside
  if (sizeHint) {
    const isInBounds = (cell: ExtractedCell) =>
      cell.row >= 0 && cell.row < sizeHint.rows &&
      cell.col >= 0 && cell.col < sizeHint.cols;

    // Filter out any cells outside grid bounds
    const outOfBoundsCells = fixed.valid_cells.filter(c => !isInBounds(c));
    if (outOfBoundsCells.length > 0) {
      console.warn(`[AI] Removing ${outOfBoundsCells.length} cells outside grid bounds`);
      fixed.valid_cells = fixed.valid_cells.filter(isInBounds);

      // Also filter region cells
      for (const region of fixed.regions) {
        region.cells = (region.cells || []).filter(isInBounds);
      }
    }

    // Filter holes too
    fixed.holes = fixed.holes.filter(isInBounds);

    // Grid dimensions are already set from sizeHint, don't expand
  } else {
    // No sizeHint - expand grid based on cell positions (original behavior)
    for (const cell of fixed.valid_cells) {
      fixed.width = Math.max(fixed.width, cell.col + 1);
      fixed.height = Math.max(fixed.height, cell.row + 1);
    }
    for (const hole of fixed.holes) {
      fixed.width = Math.max(fixed.width, hole.col + 1);
      fixed.height = Math.max(fixed.height, hole.row + 1);
    }
  }

  return fixed;
}

function convertToPuzzleData(response: PuzzleExtractionResponse): PuzzleData {
  const validCells: Cell[] = response.valid_cells.map((c) => ({
    row: c.row,
    col: c.col,
  }));

  // Valid constraint types
  const constraintTypeMap: Record<string, ConstraintType> = {
    'sum': 'sum',
    'equal': 'equal',
    'different': 'different',
    'greater': 'greater',
    'less': 'less',
    'any': 'any',
    // Common variations
    'total': 'sum',
    'equals': 'equal',
    'same': 'equal',
    'unique': 'different',
    'distinct': 'different',
    'gt': 'greater',
    'lt': 'less',
    'none': 'any',
    'unknown': 'any',
  };

  const regions: Region[] = response.regions.map((r, index) => {
    // Normalize constraint type
    const rawType = (r.constraint_type || 'any').toLowerCase().trim();
    const constraintType = constraintTypeMap[rawType] || 'any';

    const constraint: RegionConstraint = {
      type: constraintType,
      value: r.constraint_value,
    };

    return {
      id: `region-${index}`,
      cells: (r.cells || []).map((c) => ({ row: c.row, col: c.col })),
      color: REGION_COLORS[index % REGION_COLORS.length],
      constraint,
    };
  });

  const availableDominoes: Domino[] = response.available_dominoes.map((d, index) => {
    const pips: [number, number] = [
      Math.max(0, Math.min(6, d.pips[0] ?? 0)),
      Math.max(0, Math.min(6, d.pips[1] ?? 0)),
    ];
    return {
      id: `${dominoId(pips)}-${index}`, // Make IDs unique even for duplicate dominoes
      pips,
    };
  });

  return {
    width: response.width,
    height: response.height,
    validCells,
    regions,
    availableDominoes,
    blockedCells: [],
  };
}

// For testing/demo purposes - creates a sample puzzle
export function createSamplePuzzle(): PuzzleData {
  return {
    width: 4,
    height: 4,
    validCells: [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 2, col: 0 },
      { row: 2, col: 1 },
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
    ],
    blockedCells: [],
    regions: [
      {
        id: 'region-0',
        cells: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 1, col: 0 },
          { row: 1, col: 1 },
        ],
        color: REGION_COLORS[0],
        constraint: { type: 'sum', value: 10 },
      },
      {
        id: 'region-1',
        cells: [
          { row: 0, col: 2 },
          { row: 0, col: 3 },
          { row: 1, col: 2 },
          { row: 1, col: 3 },
        ],
        color: REGION_COLORS[1],
        constraint: { type: 'equal' },
      },
      {
        id: 'region-2',
        cells: [
          { row: 2, col: 0 },
          { row: 2, col: 1 },
          { row: 3, col: 0 },
          { row: 3, col: 1 },
        ],
        color: REGION_COLORS[2],
        constraint: { type: 'different' },
      },
      {
        id: 'region-3',
        cells: [
          { row: 2, col: 2 },
          { row: 2, col: 3 },
          { row: 3, col: 2 },
          { row: 3, col: 3 },
        ],
        color: REGION_COLORS[3],
        constraint: { type: 'greater', value: 3 },
      },
    ],
    availableDominoes: [
      { id: '2-3-0', pips: [2, 3] },
      { id: '2-3-1', pips: [2, 3] },
      { id: '4-4-2', pips: [4, 4] },
      { id: '4-4-3', pips: [4, 4] },
      { id: '0-6-4', pips: [0, 6] },
      { id: '1-5-5', pips: [1, 5] },
      { id: '4-5-6', pips: [4, 5] },
      { id: '5-6-7', pips: [5, 6] },
    ],
  };
}

// Create the L-shaped puzzle from user's manual input
// Grid layout (. = hole):
// A b b b    (row 0)
// A H b b    (row 1)
// A C C D    (row 2)
// A D D D    (row 3)
// H E . .    (row 4)
// F E . .    (row 5)
// F E . .    (row 6)
// G E . .    (row 7)
//
// Regions: A=any, B==, C=sum1?, D==, E==, F==, G=>1, H=any
export function createLShapedPuzzle(): PuzzleData {
  // Valid cells (24 cells for 12 dominoes)
  const validCells: Cell[] = [
    // Row 0
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
    // Row 1
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
    // Row 2
    { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
    // Row 3
    { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
    // Row 4 (only cols 0-1)
    { row: 4, col: 0 }, { row: 4, col: 1 },
    // Row 5 (only cols 0-1)
    { row: 5, col: 0 }, { row: 5, col: 1 },
    // Row 6 (only cols 0-1)
    { row: 6, col: 0 }, { row: 6, col: 1 },
    // Row 7 (only cols 0-1)
    { row: 7, col: 0 }, { row: 7, col: 1 },
  ];

  // Regions based on user's description
  const regions: Region[] = [
    {
      id: 'region-A',
      cells: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
        { row: 3, col: 0 },
      ],
      color: REGION_COLORS[0], // Purple
      constraint: { type: 'any' },
    },
    {
      id: 'region-B',
      cells: [
        { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
        { row: 1, col: 2 }, { row: 1, col: 3 },
      ],
      color: REGION_COLORS[1], // Pink/red
      constraint: { type: 'equal' },
    },
    {
      id: 'region-C',
      cells: [
        { row: 2, col: 1 }, { row: 2, col: 2 },
      ],
      color: REGION_COLORS[2], // Teal
      constraint: { type: 'sum', value: 1 },
    },
    {
      id: 'region-D',
      cells: [
        { row: 2, col: 3 },
        { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
      ],
      color: REGION_COLORS[3], // Orange
      constraint: { type: 'equal' },
    },
    {
      id: 'region-E',
      cells: [
        { row: 4, col: 1 },
        { row: 5, col: 1 },
        { row: 6, col: 1 },
        { row: 7, col: 1 },
      ],
      color: REGION_COLORS[4], // Gray
      constraint: { type: 'equal' },
    },
    {
      id: 'region-F',
      cells: [
        { row: 5, col: 0 },
        { row: 6, col: 0 },
      ],
      color: REGION_COLORS[5], // Green
      constraint: { type: 'equal' },
    },
    {
      id: 'region-G',
      cells: [
        { row: 7, col: 0 },
      ],
      color: REGION_COLORS[6], // Pink bottom
      constraint: { type: 'greater', value: 1 },
    },
    {
      id: 'region-H',
      cells: [
        { row: 1, col: 1 },
        { row: 4, col: 0 },
      ],
      color: REGION_COLORS[7], // Light pink/tan
      constraint: { type: 'any' },
    },
  ];

  // Dominoes from screenshot (reading left-to-right, top-to-bottom)
  // Row 1: [3,5] [6,6] [1,4] [5,6]
  // Row 2: [2,3] [0,0] [4,5] [0,4]
  // Row 3: [1,2] [2,3] [2,5] [2,6]
  const availableDominoes: Domino[] = [
    { id: '3-5-0', pips: [3, 5] },
    { id: '6-6-1', pips: [6, 6] },
    { id: '1-4-2', pips: [1, 4] },
    { id: '5-6-3', pips: [5, 6] },
    { id: '2-3-4', pips: [2, 3] },
    { id: '0-0-5', pips: [0, 0] },
    { id: '4-5-6', pips: [4, 5] },
    { id: '0-4-7', pips: [0, 4] },
    { id: '1-2-8', pips: [1, 2] },
    { id: '2-3-9', pips: [2, 3] },
    { id: '2-5-10', pips: [2, 5] },
    { id: '2-6-11', pips: [2, 6] },
  ];

  return {
    width: 4,
    height: 8,
    validCells,
    regions,
    availableDominoes,
    blockedCells: [],
  };
}

// ==========================================
// REAL PUZZLE EXAMPLES (from user screenshots)
// These serve as reference for AI extraction accuracy
// ==========================================

// Real Puzzle 1: U-shaped puzzle with solved state visible (image-1767591837)
// Grid: 7 columns x 4 rows, U-shape (open at top center)
// This is the UNSOLVED version with dominoes in tray
export function createRealPuzzle1Unsolved(): PuzzleData {
  // U-shape: cols 0-1 filled, cols 2-4 only row 3, cols 5-6 filled
  const validCells: Cell[] = [
    // Left arm (cols 0-1)
    { row: 0, col: 0 }, { row: 0, col: 1 },
    { row: 1, col: 0 }, { row: 1, col: 1 },
    { row: 2, col: 0 }, { row: 2, col: 1 },
    { row: 3, col: 0 }, { row: 3, col: 1 },
    // Bottom bar (row 3, cols 2-4)
    { row: 3, col: 2 }, { row: 3, col: 3 }, { row: 3, col: 4 },
    // Right arm (cols 5-6)
    { row: 0, col: 5 }, { row: 0, col: 6 },
    { row: 1, col: 5 }, { row: 1, col: 6 },
    { row: 2, col: 5 }, { row: 2, col: 6 },
    { row: 3, col: 5 }, { row: 3, col: 6 },
  ];

  // Regions from the puzzle (based on colors and constraint badges)
  const regions: Region[] = [
    {
      id: 'region-purple',
      cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }],
      color: '#E8D4F0', // Lavender
      constraint: { type: 'sum', value: 3 },
    },
    {
      id: 'region-pink-right',
      cells: [{ row: 0, col: 5 }, { row: 1, col: 5 }],
      color: '#FFD5D5', // Pink
      constraint: { type: 'sum', value: 2 },
    },
    {
      id: 'region-teal',
      cells: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 0 }, { row: 2, col: 1 }],
      color: '#B8E0E0', // Teal/mint
      constraint: { type: 'sum', value: 8 },
    },
    {
      id: 'region-white-left',
      cells: [{ row: 3, col: 0 }, { row: 3, col: 1 }],
      color: '#FFFFFF', // White
      constraint: { type: 'any' },
    },
    {
      id: 'region-beige',
      cells: [{ row: 3, col: 2 }, { row: 3, col: 3 }],
      color: '#F5E6C8', // Beige/cream
      constraint: { type: 'any' },
    },
    {
      id: 'region-light-blue',
      cells: [{ row: 3, col: 4 }, { row: 3, col: 5 }],
      color: '#D5E5F0', // Light blue
      constraint: { type: 'sum', value: 12 },
    },
    {
      id: 'region-white-right',
      cells: [{ row: 0, col: 6 }, { row: 1, col: 6 }, { row: 2, col: 5 }, { row: 2, col: 6 }],
      color: '#FFFFFF', // White
      constraint: { type: 'any' },
    },
    {
      id: 'region-gray',
      cells: [{ row: 3, col: 6 }],
      color: '#D0D0D0', // Gray
      constraint: { type: 'sum', value: 8 },
    },
  ];

  // Dominoes from tray (reading order: top row L-R, then bottom row L-R)
  // Based on image-1767591846 (unsolved puzzle with tray visible)
  const availableDominoes: Domino[] = [
    { id: 'd0', pips: [6, 6] },
    { id: 'd1', pips: [2, 1] },
    { id: 'd2', pips: [2, 2] },
    { id: 'd3', pips: [6, 0] },
    { id: 'd4', pips: [1, 2] },
    { id: 'd5', pips: [3, 3] },
    { id: 'd6', pips: [4, 2] },
    { id: 'd7', pips: [4, 5] },
  ];

  return {
    width: 7,
    height: 4,
    validCells,
    regions,
    availableDominoes,
    blockedCells: [],
  };
}

// Real Puzzle 2: Irregular shape puzzle (image-1767591846)
// This puzzle has: 3 sum, =, <2, <4, 5, >2 constraints
export function createRealPuzzle2(): PuzzleData {
  // Grid is approximately 4x4 with a hole in the middle
  const validCells: Cell[] = [
    // Row 0
    { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
    // Row 1
    { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 1, col: 3 },
    // Row 2 (hole at col 1)
    { row: 2, col: 0 }, { row: 2, col: 2 }, { row: 2, col: 3 },
    // Row 3
    { row: 3, col: 0 }, { row: 3, col: 1 }, { row: 3, col: 2 }, { row: 3, col: 3 },
  ];

  const regions: Region[] = [
    {
      id: 'region-purple',
      cells: [{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 3, col: 0 }],
      color: '#E8D4F0',
      constraint: { type: 'sum', value: 3 },
    },
    {
      id: 'region-pink-top',
      cells: [{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }],
      color: '#FFD5D5',
      constraint: { type: 'equal' },
    },
    {
      id: 'region-beige',
      cells: [{ row: 1, col: 1 }, { row: 1, col: 2 }],
      color: '#F5E6C8',
      constraint: { type: 'less', value: 2 },
    },
    {
      id: 'region-gray',
      cells: [{ row: 1, col: 3 }, { row: 2, col: 3 }],
      color: '#D0D0D0',
      constraint: { type: 'less', value: 4 },
    },
    {
      id: 'region-pink-bottom',
      cells: [{ row: 2, col: 2 }, { row: 3, col: 2 }],
      color: '#FFD5D5',
      constraint: { type: 'sum', value: 5 },
    },
    {
      id: 'region-light-blue',
      cells: [{ row: 3, col: 1 }, { row: 3, col: 3 }],
      color: '#D5E5F0',
      constraint: { type: 'equal' },
    },
  ];

  const availableDominoes: Domino[] = [
    { id: 'd0', pips: [6, 6] },
    { id: 'd1', pips: [2, 1] },
    { id: 'd2', pips: [2, 2] },
    { id: 'd3', pips: [6, 0] },
    { id: 'd4', pips: [1, 2] },
    { id: 'd5', pips: [3, 3] },
    { id: 'd6', pips: [4, 2] },
    { id: 'd7', pips: [4, 5] },
  ];

  return {
    width: 4,
    height: 4,
    validCells,
    regions,
    availableDominoes,
    blockedCells: [],
  };
}

import * as FileSystem from 'expo-file-system';
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
} from '../types/puzzle';

const OPENROUTER_API_KEY = process.env.EXPO_PUBLIC_VIBECODE_OPENROUTER_API_KEY;
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// Multi-model fallback configuration for resilience
const DOMINO_MODELS = [
  'openai/gpt-5.2',           // Primary - best for pip counting
  'anthropic/claude-sonnet-4', // Fallback 1
  'google/gemini-2.5-flash',   // Fallback 2
];

const GRID_MODELS = [
  'google/gemini-2.5-flash',    // Primary - best for structured grid extraction
  'openai/gpt-5.2',            // Fallback 1
  'anthropic/claude-sonnet-4', // Fallback 2
];

// Delay between retry attempts (exponential backoff)
const RETRY_DELAYS = [0, 1000, 2000]; // ms

// Confidence scoring types
export interface ExtractionConfidence {
  dominoPipsConfidence: number;    // 0-1
  gridStructureConfidence: number; // 0-1
  regionBoundaryConfidence: number;// 0-1
  constraintReadConfidence: number;// 0-1

  lowConfidenceAreas: {
    type: 'domino' | 'region' | 'constraint';
    index: number;
    reason: string;
  }[];

  warnings: string[];
}

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

// ==========================================
// VALIDATION HELPERS
// ==========================================

// Validate and clamp domino pip values to 0-6 range
function validateDominoPips(dominoes: ExtractedDomino[]): ExtractedDomino[] {
  return dominoes.map(d => ({
    pips: [
      Math.max(0, Math.min(6, Math.round(d.pips[0] ?? 0))),
      Math.max(0, Math.min(6, Math.round(d.pips[1] ?? 0))),
    ] as [number, number]
  }));
}

// Detect suspicious duplicate dominoes that may indicate misread pips
function detectSuspiciousDuplicates(dominoes: ExtractedDomino[]): string[] {
  const seen = new Map<string, number>();
  const warnings: string[] = [];

  for (const d of dominoes) {
    const sorted = [...d.pips].sort((a, b) => a - b);
    const key = `${sorted[0]}-${sorted[1]}`;
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);

    // Standard domino sets typically have only one of each combination
    // Having 3+ of the same domino is very suspicious
    if (count >= 3) {
      warnings.push(`Suspicious: domino [${d.pips[0]},${d.pips[1]}] appears ${count} times - may be misread`);
    }
  }

  return warnings;
}

// Analyze domino set for common misread patterns
function analyzeDominoConfidence(dominoes: ExtractedDomino[]): {
  confidence: number;
  issues: { index: number; reason: string }[];
} {
  const issues: { index: number; reason: string }[] = [];
  let totalConfidence = 1.0;

  // Check for common misread patterns
  for (let i = 0; i < dominoes.length; i++) {
    const d = dominoes[i];
    const [p1, p2] = d.pips;

    // 5 and 6 are commonly confused (both have many dots)
    if ((p1 === 5 || p1 === 6) && (p2 === 5 || p2 === 6)) {
      issues.push({ index: i, reason: '5/6 pips can be confused - verify manually' });
      totalConfidence -= 0.05;
    }

    // 0 (blank) sometimes misread as having pips
    if (p1 === 0 || p2 === 0) {
      issues.push({ index: i, reason: 'Blank (0) side detected - verify no faint pips' });
      totalConfidence -= 0.02;
    }
  }

  // Check for duplicates
  const duplicateWarnings = detectSuspiciousDuplicates(dominoes);
  if (duplicateWarnings.length > 0) {
    totalConfidence -= duplicateWarnings.length * 0.1;
  }

  return {
    confidence: Math.max(0, Math.min(1, totalConfidence)),
    issues,
  };
}

// Verify ASCII grid matches region data
function verifyAsciiGridConsistency(
  gridData: GridExtractionResponse
): { valid: boolean; issues: string[]; confidence: number } {
  const issues: string[] = [];
  let confidence = 1.0;

  const ascii = gridData.ascii_grid;
  if (!ascii || ascii.length === 0) {
    return { valid: true, issues: ['No ASCII grid provided for verification'], confidence: 0.7 };
  }

  // Check row count matches height
  if (ascii.length !== gridData.height) {
    issues.push(`ASCII grid has ${ascii.length} rows, expected ${gridData.height}`);
    confidence -= 0.2;
  }

  // Build grid from regions for comparison
  const regionGrid: string[][] = Array(gridData.height)
    .fill(null)
    .map(() => Array(gridData.width).fill('.'));

  // Mark holes
  for (const holeCoord of gridData.holes || []) {
    const cell = parseCoordinate(holeCoord);
    if (cell && cell.row < gridData.height && cell.col < gridData.width) {
      regionGrid[cell.row][cell.col] = '#';
    }
  }

  // Mark regions
  for (const region of gridData.regions || []) {
    for (const coord of region.cells || []) {
      const cell = parseCoordinate(coord);
      if (cell && cell.row < gridData.height && cell.col < gridData.width) {
        regionGrid[cell.row][cell.col] = region.id;
      }
    }
  }

  // Compare with ASCII grid
  let mismatches = 0;
  for (let r = 0; r < Math.min(ascii.length, gridData.height); r++) {
    const asciiRow = ascii[r] || '';
    for (let c = 0; c < Math.min(asciiRow.length, gridData.width); c++) {
      const asciiChar = asciiRow[c].toUpperCase();
      const regionChar = regionGrid[r][c].toUpperCase();

      // Both should agree on holes vs non-holes
      const asciiIsHole = asciiChar === '#' || asciiChar === '.';
      const regionIsHole = regionChar === '#' || regionChar === '.';

      if (asciiIsHole !== regionIsHole) {
        mismatches++;
        if (mismatches <= 3) {
          issues.push(`Cell (${r},${c}): ASCII='${asciiChar}' vs regions='${regionChar}'`);
        }
      }
    }
  }

  if (mismatches > 3) {
    issues.push(`... and ${mismatches - 3} more mismatches`);
  }

  if (mismatches > 0) {
    confidence -= Math.min(0.3, mismatches * 0.05);
  }

  return {
    valid: mismatches === 0,
    issues,
    confidence: Math.max(0.5, confidence),
  };
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
// NEW: Domino Extraction with GPT-5.2
// ==========================================
const DOMINO_EXTRACTION_PROMPT = `You are given an image containing multiple domino tiles.

Your task is to:
1. Detect every individual domino tile.
2. For each tile, count the number of pips on the left half and right half separately.
3. Output the full set strictly in reading order (left-to-right, top-to-bottom).
4. Format each domino as (left,right) using integers only.
5. Do not normalize, rotate, reorder, or infer missing tiles.
6. If a tile face is blank, output 0 for that side.
7. Output nothing except the ordered list of (n,n) values.

HOW TO COUNT PIPS (dots) ON EACH HALF:
- 0: blank/empty (no dots at all)
- 1: one center dot
- 2: two dots (diagonal)
- 3: three dots (diagonal line)
- 4: four dots (corners)
- 5: five dots (corners + center)
- 6: six dots (2 columns of 3)

Output format - JSON array only:
[(left1,right1), (left2,right2), ...]

Example: [(3,5), (0,0), (2,6), (4,4)]`;

async function extractDominoesWithModel(
  base64Image: string,
  model: string,
  expectedCount?: number
): Promise<ExtractedDomino[]> {
  const prompt = expectedCount
    ? `${DOMINO_EXTRACTION_PROMPT}\n\nThere should be EXACTLY ${expectedCount} dominoes in the image.`
    : DOMINO_EXTRACTION_PROMPT;

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
          content: 'You are an expert at reading domino pip values. Count dots precisely. Output only the requested format.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI] ${model} API error:`, errorText);
    throw new Error(`${model} API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  console.log(`[AI] ${model} domino response:`, text);

  // Parse the response - handle various formats
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

  // Validate pip values
  dominoes = validateDominoPips(dominoes);

  return dominoes;
}

async function extractDominoesFromImage(
  base64Image: string,
  expectedCount?: number
): Promise<{ dominoes: ExtractedDomino[]; confidence: number; warnings: string[] }> {
  console.log('[AI] Extracting dominoes with multi-model fallback...');

  let lastError: Error | null = null;

  // Try each model with retry delays
  for (let modelIndex = 0; modelIndex < DOMINO_MODELS.length; modelIndex++) {
    const model = DOMINO_MODELS[modelIndex];
    console.log(`[AI] Trying domino model: ${model}`);

    // Apply retry delay for subsequent attempts
    if (modelIndex > 0 && RETRY_DELAYS[modelIndex]) {
      console.log(`[AI] Waiting ${RETRY_DELAYS[modelIndex]}ms before retry...`);
      await delay(RETRY_DELAYS[modelIndex]);
    }

    try {
      const dominoes = await extractDominoesWithModel(base64Image, model, expectedCount);

      // Validate count if expected
      if (expectedCount && dominoes.length !== expectedCount) {
        console.warn(`[AI] ${model} returned ${dominoes.length} dominoes, expected ${expectedCount}`);
        if (modelIndex < DOMINO_MODELS.length - 1) {
          continue; // Try next model
        }
      }

      // Analyze confidence
      const { confidence, issues } = analyzeDominoConfidence(dominoes);
      const duplicateWarnings = detectSuspiciousDuplicates(dominoes);

      console.log(`[AI] Domino extraction complete with ${model}:`, {
        count: dominoes.length,
        confidence: confidence.toFixed(2),
        issues: issues.length,
      });

      return {
        dominoes,
        confidence,
        warnings: [
          ...issues.map(i => `Domino ${i.index}: ${i.reason}`),
          ...duplicateWarnings,
        ],
      };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[AI] ${model} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('All domino extraction models failed');
}

// ==========================================
// NEW: Grid Extraction with GPT-5.2
// ==========================================
const GRID_EXTRACTION_PROMPT = `You are given an image of a grid-based logic puzzle with colored dashed regions, holes, and numeric / relational constraint badges.

Your task is to:
1. Identify the full rectangular grid dimensions.
2. Mark all hole cells explicitly.
3. Assign a unique letter ID to every contiguous dashed region.
4. Output the entire board in ASCII grid form using:
   - Letters for region IDs
   - # for holes
5. List every region with:
   - Exact cell coordinates (R#,C#) where R=row from top, C=col from left
   - Region size
   - Constraint type (=, numeric target, >, <, or none)
6. List all hole coordinates.
7. List all unconstrained ("any") regions.

Rules:
- Do not guess values that are not visible.
- Do not merge regions by color — only by dashed boundaries.
- Do not simplify; preserve geometry exactly as shown.
- Derive the coordinate system from the image itself, not assumptions.
- Row 0 is the TOP row, Col 0 is the LEFT column.

Constraint badge meanings:
- "Σ" + number or just a number = sum constraint (type: "sum", value: N)
- "=" = equal (all same value) (type: "equal")
- "≠" = different (all unique) (type: "different")
- ">" + number = greater than (type: "greater", value: N)
- "<" + number = less than (type: "less", value: N)
- No badge = any constraint (type: "any")

Output ONLY this JSON format:
{
  "width": 4,
  "height": 5,
  "ascii_grid": ["AABB", "A#BB", "CCDD", "..."],
  "regions": [
    {"id": "A", "cells": ["R0,C0", "R0,C1", "R1,C0"], "size": 3, "constraint_type": "equal"},
    {"id": "B", "cells": ["R0,C2", "R0,C3", "R1,C2", "R1,C3"], "size": 4, "constraint_type": "sum", "constraint_value": 10}
  ],
  "holes": ["R1,C1"],
  "unconstrained_regions": ["C"]
}`;

async function extractGridWithModel(
  base64Image: string,
  model: string,
  sizeHint?: GridSizeHint
): Promise<GridExtractionResponse> {
  let prompt = GRID_EXTRACTION_PROMPT;

  if (sizeHint) {
    const expectedCells = sizeHint.dominoCount * 2;
    const totalGridCells = sizeHint.cols * sizeHint.rows;
    const expectedHoles = totalGridCells - expectedCells;

    prompt = `${GRID_EXTRACTION_PROMPT}

IMPORTANT SIZE HINTS (from user):
- Grid dimensions: ${sizeHint.cols} columns × ${sizeHint.rows} rows
- Expected valid cells: ${expectedCells} (for ${sizeHint.dominoCount} dominoes)
- Expected holes: ${expectedHoles}
- Total positions: ${totalGridCells}

Every grid position must be either a valid cell (in a region) or a hole.`;
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
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing puzzle grids. Extract structure precisely. Output only factual structure — no solving.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: 8000, // Increased for complex grids
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI] ${model} grid API error:`, errorText);
    throw new Error(`${model} API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  console.log(`[AI] ${model} grid response length:`, text.length);

  // Clean and parse JSON
  let cleanedText = text;
  cleanedText = cleanedText.replace(/```json\s*/gi, '');
  cleanedText = cleanedText.replace(/```\s*/g, '');
  cleanedText = cleanedText.trim();

  const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse grid response');
  }

  const gridData: GridExtractionResponse = JSON.parse(jsonMatch[0]);
  return gridData;
}

async function extractGridFromImage(
  base64Image: string,
  sizeHint?: GridSizeHint
): Promise<{ gridData: GridExtractionResponse; confidence: number; warnings: string[] }> {
  console.log('[AI] Extracting grid with multi-model fallback...');

  let lastError: Error | null = null;

  // Try each model with retry delays
  for (let modelIndex = 0; modelIndex < GRID_MODELS.length; modelIndex++) {
    const model = GRID_MODELS[modelIndex];
    console.log(`[AI] Trying grid model: ${model}`);

    // Apply retry delay for subsequent attempts
    if (modelIndex > 0 && RETRY_DELAYS[modelIndex]) {
      console.log(`[AI] Waiting ${RETRY_DELAYS[modelIndex]}ms before retry...`);
      await delay(RETRY_DELAYS[modelIndex]);
    }

    try {
      const gridData = await extractGridWithModel(base64Image, model, sizeHint);

      // Validate dimensions if sizeHint provided
      if (sizeHint) {
        if (gridData.width !== sizeHint.cols || gridData.height !== sizeHint.rows) {
          console.warn(`[AI] ${model} returned wrong dimensions: ${gridData.width}x${gridData.height}, expected ${sizeHint.cols}x${sizeHint.rows}`);
          // Force correct dimensions
          gridData.width = sizeHint.cols;
          gridData.height = sizeHint.rows;
        }
      }

      // Verify ASCII grid consistency
      const asciiVerification = verifyAsciiGridConsistency(gridData);
      const warnings: string[] = [...asciiVerification.issues];

      // Check region contiguity
      let contiguityConfidence = 1.0;
      for (const region of gridData.regions || []) {
        const cells = (region.cells || []).map(c => {
          const parsed = parseCoordinate(c);
          return parsed || { row: 0, col: 0 };
        });

        if (!checkRegionContiguity(cells)) {
          warnings.push(`Region ${region.id} has non-contiguous cells`);
          contiguityConfidence -= 0.1;
        }
      }

      // Calculate overall confidence
      const confidence = Math.max(0.3, Math.min(1,
        (asciiVerification.confidence + contiguityConfidence) / 2
      ));

      console.log(`[AI] Grid extraction complete with ${model}:`, {
        width: gridData.width,
        height: gridData.height,
        regions: gridData.regions?.length,
        holes: gridData.holes?.length,
        confidence: confidence.toFixed(2),
      });

      return { gridData, confidence, warnings };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[AI] ${model} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('All grid extraction models failed');
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
// NEW: Dual Extraction API with Confidence
// ==========================================

export interface DualExtractionResult {
  puzzleData: PuzzleData;
  confidence: ExtractionConfidence;
}

export async function extractPuzzleFromDualImages(
  dominoImageUri: string,
  gridImageUri: string,
  sizeHint?: GridSizeHint
): Promise<DualExtractionResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured. Please add it in the ENV tab.');
  }

  console.log('[AI] Starting dual image extraction with confidence scoring...');

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

      // Apply retry delay for subsequent attempts
      if (attempt > 1) {
        const delayMs = RETRY_DELAYS[Math.min(attempt - 1, RETRY_DELAYS.length - 1)];
        console.log(`[AI] Waiting ${delayMs}ms before retry...`);
        await delay(delayMs);
      }

      // Extract dominoes and grid in parallel
      const [dominoResult, gridResult] = await Promise.all([
        extractDominoesFromImage(dominoBase64, sizeHint?.dominoCount),
        extractGridFromImage(gridBase64, sizeHint),
      ]);

      // Convert grid response to our format
      const { regions, validCells, holes } = convertGridResponseToRegions(gridResult.gridData);

      // Validate counts
      if (sizeHint) {
        const expectedCells = sizeHint.dominoCount * 2;
        if (validCells.length !== expectedCells) {
          throw new Error(`Cell count mismatch: got ${validCells.length}, expected ${expectedCells}`);
        }
        if (dominoResult.dominoes.length !== sizeHint.dominoCount) {
          throw new Error(`Domino count mismatch: got ${dominoResult.dominoes.length}, expected ${sizeHint.dominoCount}`);
        }
      }

      // Build puzzle data
      const puzzleData = buildPuzzleData(
        gridResult.gridData.width || sizeHint?.cols || 5,
        gridResult.gridData.height || sizeHint?.rows || 5,
        validCells,
        regions,
        dominoResult.dominoes
      );

      // Build confidence data
      const lowConfidenceAreas: ExtractionConfidence['lowConfidenceAreas'] = [];

      // Add domino confidence issues
      for (const warning of dominoResult.warnings) {
        const match = warning.match(/Domino (\d+):/);
        if (match) {
          lowConfidenceAreas.push({
            type: 'domino',
            index: parseInt(match[1]),
            reason: warning,
          });
        }
      }

      // Add grid confidence issues
      for (const warning of gridResult.warnings) {
        if (warning.includes('Region')) {
          const match = warning.match(/Region (\w+)/);
          lowConfidenceAreas.push({
            type: 'region',
            index: match ? puzzleData.regions.findIndex(r => r.id.includes(match[1])) : 0,
            reason: warning,
          });
        }
      }

      // Analyze constraint confidence (simple heuristic)
      let constraintConfidence = 1.0;
      for (const region of puzzleData.regions) {
        if (region.constraint.type === 'any') {
          // "any" constraints might be unread badges
          constraintConfidence -= 0.05;
        }
      }

      const confidence: ExtractionConfidence = {
        dominoPipsConfidence: dominoResult.confidence,
        gridStructureConfidence: gridResult.confidence,
        regionBoundaryConfidence: gridResult.confidence * 0.9, // Slightly lower
        constraintReadConfidence: Math.max(0.5, constraintConfidence),
        lowConfidenceAreas,
        warnings: [...dominoResult.warnings, ...gridResult.warnings],
      };

      console.log('[AI] Dual extraction successful!', {
        dominoes: puzzleData.availableDominoes.length,
        cells: puzzleData.validCells.length,
        regions: puzzleData.regions.length,
        overallConfidence: (
          (confidence.dominoPipsConfidence +
            confidence.gridStructureConfidence +
            confidence.constraintReadConfidence) / 3
        ).toFixed(2),
        warnings: confidence.warnings.length,
      });

      return { puzzleData, confidence };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`[AI] Attempt ${attempt} failed: ${lastError.message}`);
    }
  }

  throw lastError || new Error('Failed to extract puzzle after multiple attempts');
}

function buildPuzzleData(
  width: number,
  height: number,
  validCells: ExtractedCell[],
  extractedRegions: ExtractedRegion[],
  extractedDominoes: ExtractedDomino[]
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

## VISUAL IDENTIFICATION

COLORED CELLS (valid/playable):
- Have a VISIBLE BACKGROUND COLOR (pink, blue, green, yellow, orange, purple, etc.)
- These are where you place dominoes

HOLES (blocked/non-playable):
- Have NO colored background (dark/black spaces)
- They are GAPS in the puzzle area

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

## STEP 2: IDENTIFY REGIONS BY COLOR

Each DISTINCT background color is a SEPARATE region.
Regions MUST be contiguous (all cells connected by shared edges).

Constraint badges:
- "Σ" + number = sum constraint
- "=" = equal (all same value)
- "≠" = different (all unique)
- ">" + number = greater than
- "<" + number = less than
- No badge = "any" constraint

## STEP 3: MAP THE GRID

Scan the grid systematically:
- Start at top-left (0,0)
- Go left to right, then next row
- Note each cell's color and position

## OUTPUT FORMAT (JSON only):

{
  "width": 4,
  "height": 3,
  "holes": [{"row": 0, "col": 0}],
  "valid_cells": [{"row": 0, "col": 1}, {"row": 0, "col": 2}],
  "regions": [
    {
      "cells": [{"row": 0, "col": 1}, {"row": 0, "col": 2}],
      "constraint_type": "equal",
      "color_description": "pink"
    }
  ],
  "available_dominoes": [{"pips": [3, 5]}, {"pips": [0, 0]}]
}

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

  console.log('[AI] Starting grid extraction with Gemini...', sizeHint ? `expecting ${sizeHint.dominoCount * 2} cells` : 'no hints');

  // Increase temperature slightly on retries to get different results
  const temperature = 0.1 + (attempt - 1) * 0.1;

  // Use Gemini for grid/regions
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vibecode.com',
      'X-Title': 'Pips Solver',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview-20251217',
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
      const dominoResult = await extractDominoesFromImage(base64Image, dominoCount);
      if (dominoResult.dominoes.length === dominoCount) {
        console.log('[AI] Replacing Gemini dominoes with GPT-5.2 dominoes');
        extractedResponse.available_dominoes = dominoResult.dominoes;
        if (dominoResult.warnings.length > 0) {
          console.warn('[AI] Domino extraction warnings:', dominoResult.warnings);
        }
      } else {
        console.warn(`[AI] GPT-5.2 returned ${dominoResult.dominoes.length} dominoes, expected ${dominoCount}. Keeping Gemini values.`);
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

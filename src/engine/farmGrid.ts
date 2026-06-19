/**
 * Deterministic, addressable farm-cell grid (Prompt 004). Pure logic — no
 * Babylon. The world renders freely in 3D, but farming interactions stay
 * grid-aware: every tile maps to a stable (col,row) address and a cell state.
 * The renderer places meshes at `cellToWorld`; gameplay reads/writes cells here.
 */
export type TileState = 'untilled' | 'tilled' | 'watered' | 'planted';

export interface FarmCell {
  col: number;
  row: number;
  state: TileState;
}

export const FARM_CELL_SIZE = 1; // world units per cell

export class FarmGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly cells: TileState[];

  constructor(cols: number, rows: number, fill: TileState = 'untilled') {
    if (cols <= 0 || rows <= 0) throw new Error('FarmGrid dimensions must be positive');
    this.cols = cols;
    this.rows = rows;
    this.cells = new Array<TileState>(cols * rows).fill(fill);
  }

  inBounds(col: number, row: number): boolean {
    return Number.isInteger(col) && Number.isInteger(row) && col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  index(col: number, row: number): number {
    if (!this.inBounds(col, row)) throw new RangeError(`cell (${col},${row}) out of bounds`);
    return row * this.cols + col;
  }

  get(col: number, row: number): TileState {
    return this.cells[this.index(col, row)];
  }

  set(col: number, row: number, state: TileState): void {
    this.cells[this.index(col, row)] = state;
  }

  /** Center of a cell in world space (XZ plane), with the grid centered on origin. */
  cellToWorld(col: number, row: number): { x: number; z: number } {
    const x = (col - (this.cols - 1) / 2) * FARM_CELL_SIZE;
    const z = (row - (this.rows - 1) / 2) * FARM_CELL_SIZE;
    return { x, z };
  }

  /** Inverse of cellToWorld; returns null if the point is outside the grid. */
  worldToCell(x: number, z: number): { col: number; row: number } | null {
    const col = Math.round(x / FARM_CELL_SIZE + (this.cols - 1) / 2);
    const row = Math.round(z / FARM_CELL_SIZE + (this.rows - 1) / 2);
    return this.inBounds(col, row) ? { col, row } : null;
  }

  forEach(fn: (cell: FarmCell) => void): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        fn({ col, row, state: this.cells[row * this.cols + col] });
      }
    }
  }
}

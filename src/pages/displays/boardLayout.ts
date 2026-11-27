import type { BoardLayout, BoardPanel, GridBox } from "../../api/displays";

/** Same limits the server checks: an 8 by 8 board, each panel at least 2 by 2 squares. */
export const GRID_SIZE = 8;
export const MIN_SPAN = 2;

export const PANEL_ORDER: BoardPanel[] = ["apparatus", "onDuty", "incidents", "events", "messages"];

export const DEFAULT_LAYOUT: Record<BoardPanel, GridBox> = {
  apparatus: { x: 0, y: 0, w: 2, h: 5 },
  onDuty: { x: 0, y: 5, w: 2, h: 3 },
  incidents: { x: 2, y: 0, w: 4, h: 8 },
  events: { x: 6, y: 0, w: 2, h: 4 },
  messages: { x: 6, y: 4, w: 2, h: 4 },
};

export function overlaps(a: GridBox, b: GridBox): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function fits(box: GridBox, placed: BoardLayout, skip?: BoardPanel): boolean {
  if (box.x < 0 || box.y < 0 || box.w < MIN_SPAN || box.h < MIN_SPAN) return false;
  if (box.x + box.w > GRID_SIZE || box.y + box.h > GRID_SIZE) return false;
  return Object.entries(placed).every(([key, other]) => key === skip || !other || !overlaps(box, other));
}

/** First empty 2 by 2 spot, top-left first. */
export function freeSpot(placed: BoardLayout): GridBox | null {
  for (let y = 0; y <= GRID_SIZE - MIN_SPAN; y += 1) {
    for (let x = 0; x <= GRID_SIZE - MIN_SPAN; x += 1) {
      const box = { x, y, w: MIN_SPAN, h: MIN_SPAN };
      if (fits(box, placed)) return box;
    }
  }
  return null;
}

/**
 * Where each shown panel goes. Saved spots win; a panel without one (for example one just turned on)
 * takes its default spot, or the first free 2 by 2 spot. A panel with no room is listed as unplaced.
 */
export function placeLayout(panels: Record<BoardPanel, boolean>, layout: BoardLayout): { placed: BoardLayout; unplaced: BoardPanel[] } {
  const placed: BoardLayout = {};
  const shown = PANEL_ORDER.filter((key) => panels[key]);
  for (const key of shown) {
    const box = layout[key];
    if (box && fits(box, placed)) placed[key] = box;
  }
  const unplaced: BoardPanel[] = [];
  for (const key of shown) {
    if (placed[key]) continue;
    const slot = fits(DEFAULT_LAYOUT[key], placed) ? DEFAULT_LAYOUT[key] : freeSpot(placed);
    if (slot) placed[key] = slot;
    else unplaced.push(key);
  }
  return { placed, unplaced };
}

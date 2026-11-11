/**
 * One grid for the sticky column labels and every line row, so the labels stay
 * above their values on the desktop breakpoint. Below `sm` the same row falls
 * back to two columns, which is a card.
 *
 * The action track is a fixed width, never `auto`: an `auto` track is sized by
 * its own content, so the label row (one word) and a row carrying three buttons
 * would resolve to different widths and every column after it would drift.
 */
export const SELLER_GRID_CLASS =
  "grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,1fr)_4rem_5rem_5.5rem_6.5rem_10rem] sm:items-center lg:grid-cols-[minmax(0,1fr)_4rem_5rem_5.5rem_6.5rem_22rem]";

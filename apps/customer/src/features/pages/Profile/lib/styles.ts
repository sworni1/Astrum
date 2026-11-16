/**
 * Every class constant the profile screen prints (spec 0023, AC-4 to AC-7).
 * Values are the mockup's: 14px card radius, 40px controls, 20px gutters, and
 * the one raw colour of the feature — the avatar gradient (AC-3).
 */

export const PROFILE_WRAPPER = "mx-auto w-full max-w-[880px] px-6 pt-14 pb-[72px]";
export const PROFILE_STACK = "flex flex-col gap-7";

export const HEADER_ROW = "flex items-center gap-5";
export const HEADER_AVATAR =
  "flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border border-border text-[28px] font-semibold";
export const HEADER_AVATAR_GRADIENT = "linear-gradient(135deg, #3f3f46, #18181b)";
export const HEADER_NAME_BLOCK = "flex min-w-0 flex-col gap-1.5";
export const HEADER_NAME = "truncate text-[28px] font-bold tracking-[-0.02em]";
export const HEADER_META = "flex flex-wrap items-center gap-2";
export const HEADER_EMAIL = "truncate text-sm text-muted-foreground";
export const ROLE_BADGE =
  "inline-flex h-6 items-center rounded-full border border-border px-2.5 text-xs font-medium text-muted-foreground";

export const CARD = "overflow-hidden rounded-xl border border-border bg-card";
export const CARD_HEADER = "px-6 pt-6";
export const CARD_TITLE = "text-[18px] font-semibold tracking-[-0.01em]";
export const CARD_TEXT = "mt-1.5 text-sm leading-normal text-muted-foreground";
export const CARD_BODY = "flex flex-col gap-5 p-6";
export const CARD_BODY_FLUSH = "flex flex-col px-6 pt-2 pb-6";
export const CARD_FOOTER =
  "flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-raised px-6 py-4";

export const FIELD = "flex min-w-0 flex-col gap-2";
export const FIELD_LABEL = "text-sm font-medium";
export const FIELD_HINT = "text-[13px] text-muted-foreground";
export const FIELD_GRID =
  "grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]";
export const INPUT = "h-10 rounded-md bg-background px-3 text-sm";
export const INPUT_READONLY = "cursor-not-allowed bg-secondary text-muted-foreground";

export const ROLE_GRID =
  "grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]";
export const ROLE_HEAD = "flex flex-col gap-4 md:flex-row md:items-start";
export const ICON_TILE =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary";

export const ROW = "flex flex-wrap items-center justify-between gap-4 py-4";
export const ROW_TEXT = "text-sm font-medium";
export const ROW_HINT = "mt-1 text-[13px] text-muted-foreground";

export const ACTION_SIZE = "h-10 rounded-md px-4 text-sm font-medium";
export const ACTION_ICON = "size-4";

export const DESTRUCTIVE_CARD = "border-destructive-line";
export const DESTRUCTIVE_TITLE = "text-[18px] font-semibold tracking-[-0.01em] text-destructive-soft";

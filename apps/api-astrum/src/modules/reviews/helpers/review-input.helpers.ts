export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" ? value.trim() : value;

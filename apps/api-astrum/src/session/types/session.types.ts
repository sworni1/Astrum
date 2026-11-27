export type SessionRecord = {
  userId: string;
  createdAt: string;
  userAgent: string | null;
};

export type SessionStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<number>;
  ping(): Promise<string>;
};

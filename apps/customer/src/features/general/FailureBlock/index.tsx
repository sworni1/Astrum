"use client";

import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  text?: string;
  retryLabel: string;
  onRetry: () => void;
};

const FailureBlock = ({ title, text, retryLabel, onRetry }: Props) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-group border border-border bg-card px-7 py-16 text-center">
    <h2 className="text-lg font-semibold">{title}</h2>
    {text === undefined ? null : (
      <p className="max-w-md text-sm text-muted-foreground">{text}</p>
    )}
    <Button onClick={onRetry}>{retryLabel}</Button>
  </div>
);

export default FailureBlock;

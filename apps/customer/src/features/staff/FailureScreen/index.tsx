"use client";

import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  text: string;
  retryLabel: string;
  onRetry: () => void;
};

/** The screen a failed read paints: the reason and one retry, never an empty page. */
const FailureScreen = ({ title, text, retryLabel, onRetry }: Props) => (
  <section className="mx-auto max-w-screen-xl px-4 py-12 text-center 2xl:px-0">
    <h1 className="text-xl font-semibold">{title}</h1>
    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
      {text}
    </p>
    <Button className="mt-4" onClick={onRetry}>
      {retryLabel}
    </Button>
  </section>
);

export default FailureScreen;

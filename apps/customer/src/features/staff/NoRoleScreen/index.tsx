"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  text: string;
  actionLabel: string;
};

const NoRoleScreen = ({ title, text, actionLabel }: Props) => (
  <section className="mx-auto max-w-screen-xl px-4 py-12 2xl:px-0">
    <div className="mx-auto max-w-xl space-y-3 rounded-xl border p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild>
        <Link href="/staff/onboarding">{actionLabel}</Link>
      </Button>
    </div>
  </section>
);

export default NoRoleScreen;

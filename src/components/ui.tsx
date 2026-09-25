import type { ReactNode } from "react";

const TONE: Record<string, string> = {
  green: "tone-green",
  teal: "tone-teal",
  amber: "tone-amber",
  gray: "tone-gray",
  red: "tone-red",
  blue: "tone-blue",
};

export function Badge({ tone = "gray", children }: { tone?: string; children: ReactNode }) {
  return <span className={`badge ${TONE[tone] ?? TONE.gray}`}>{children}</span>;
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="empty-hint">{children}</p>;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

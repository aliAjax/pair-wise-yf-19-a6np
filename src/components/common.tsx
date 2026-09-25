import type { Determination, Specimen } from "../business/storage";
import { DETERMINATION_LABEL } from "../business/packing";

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

const pillStyles: Record<string, string> = {
  gray: "background:#eef2f7;color:#475569;border-color:#d9e2ef",
  green: "background:#e7f5ec;color:#166534;border-color:#9bd3b0",
  teal: "background:#e6f6f4;color:#0f766e;border-color:#9bd8d2",
  amber: "background:#fdf3dc;color:#a16207;border-color:#efd99b",
  red: "background:#fdecec;color:#b42318;border-color:#f3b4ae",
  blue: "background:#e9f1fd;color:#1d4ed8;border-color:#b9cff7",
};

export function Pill({
  children,
  tone = "gray",
}: {
  children: React.ReactNode;
  tone?: keyof typeof pillStyles;
}) {
  return (
    <span className="pill" style={{ ...parsePillStyle(pillStyles[tone]) }}>
      {children}
    </span>
  );
}

function parsePillStyle(css: string): React.CSSProperties {
  const out: React.CSSProperties = {};
  for (const part of css.split(";")) {
    const [k, v] = part.split(":");
    if (k && v) {
      const key = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()) as keyof React.CSSProperties;
      (out as Record<string, string>)[key as string] = v.trim();
    }
  }
  return out;
}

export function DeterminationPill({ value }: { value: Determination }) {
  const tone = value === "accepted" ? "green" : value === "review" ? "amber" : "gray";
  return <Pill tone={tone}>{DETERMINATION_LABEL[value]}</Pill>;
}

export function SpecimenBadges({
  specimen,
  boxStatus,
}: {
  specimen: Specimen;
  boxStatus?: string | null;
}) {
  return (
    <div className="badges">
      {specimen.archived && <Pill tone="blue">已留档</Pill>}
      <DeterminationPill value={specimen.determination} />
      {specimen.pressed ? <Pill tone="teal">已压制</Pill> : <Pill tone="amber">待压制</Pill>}
      {specimen.shelved ? <Pill tone="green">已上柜</Pill> : !specimen.archived && <Pill>未上柜</Pill>}
      {boxStatus === "in_transit" && <Pill tone="red">在途交换</Pill>}
      {boxStatus === "sealed" && <Pill tone="amber">已封存</Pill>}
      {boxStatus === "open" && <Pill tone="blue">已装箱</Pill>}
    </div>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="empty-hint">{children}</div>;
}

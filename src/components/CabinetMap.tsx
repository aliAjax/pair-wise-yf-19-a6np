import { useMemo } from "react";
import { CABINET_LETTERS, buildCabinetGrid } from "../business/store";
import { useApp } from "./context";
import { Badge, EmptyHint } from "./ui";
import { stageLabel } from "../business/packing";
import { toneFor } from "./IntakeQueue";

export function CabinetMap() {
  const { data } = useApp();

  const occupancy = useMemo(() => {
    const map = new Map<string, (typeof data.specimens)[number]>();
    for (const s of data.specimens) {
      if (s.cabinet) map.set(s.cabinet, s);
    }
    return map;
  }, [data.specimens]);

  const cells = buildCabinetGrid();
  const total = cells.length;
  const used = occupancy.size;

  return (
    <div className="view">
      <section className="panel">
        <div className="heading">
          <div>
            <p>馆藏柜位记录</p>
            <h2>柜位平面图</h2>
          </div>
          <div className="legend">
            <Badge tone="green">在柜 {used}</Badge>
            <Badge tone="gray">空位 {total - used}</Badge>
            <span className="hint">装箱中 / 在途的标本仍占柜位；留档与退回件释放柜位。</span>
          </div>
        </div>

        <div className="cabinets">
          {CABINET_LETTERS.map((letter) => (
            <div key={letter} className="cabinet">
              <h3>{letter} 柜</h3>
              <div className="cabinet-grid">
                {cells
                  .filter((cell) => cell.startsWith(letter + "-"))
                  .map((cell) => {
                    const s = occupancy.get(cell);
                    return (
                      <a
                        key={cell}
                        className={`cab-cell ${s ? "used" : "free"}`}
                        href={s ? `#/specimen/${s.id}` : undefined}
                        title={s ? `${s.collectionNo} · ${s.species}（${stageLabel(data, s)}）` : "空位"}
                      >
                        <small>{cell.split("-").slice(1).join("-")}</small>
                        {s ? <b>{s.collectionNo.slice(-5)}</b> : <b className="dim">空</b>}
                      </a>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="panel-kicker">柜位异动</p>
        <h2>最近日志</h2>
        <div className="recent-logs">
          {data.specimens
            .filter((s) => s.log.some((l) => l.text.includes("柜") || l.text.includes("退回") || l.text.includes("留档")))
            .slice(0, 8)
            .map((s) => {
              const last = s.log[s.log.length - 1];
              return (
                <div key={s.id} className="log-row">
                  <Badge tone={toneFor(stageLabel(data, s))}>{stageLabel(data, s)}</Badge>
                  <b>{s.collectionNo}</b>
                  <span>{last.text}</span>
                  <em>{last.at}</em>
                </div>
              );
            })}
          {data.specimens.length === 0 && <EmptyHint>暂无记录。</EmptyHint>}
        </div>
      </section>
    </div>
  );
}

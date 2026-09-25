import { useMemo } from "react";
import { store } from "../business/store";
import type { Specimen } from "../business/storage";
import { EmptyHint, Pill } from "./common";

function ShelfCard({ specimen, boxLabel }: { specimen: Specimen; boxLabel: string | null }) {
  return (
    <button className="shelf-card" onClick={() => store.navigate({ name: "detail", id: specimen.id })}>
      <span className="shelf-pos">{specimen.cabinetPosition}</span>
      <strong>{specimen.collectionNo}</strong>
      <small>{specimen.species}</small>
      {boxLabel ? <Pill tone="red">{boxLabel}</Pill> : <Pill tone="green">在柜</Pill>}
    </button>
  );
}

export function CabinetPage() {
  const { data } = store.useState();

  const { shelved, awaiting } = useMemo(() => {
    const boxes = new Map(data.boxes.map((b) => [b.id, b]));
    const shelved = data.specimens
      .filter((s) => s.shelved && !s.archived)
      .sort((a, b) => a.cabinetPosition.localeCompare(b.cabinetPosition));
    const awaiting = data.specimens.filter(
      (s) => s.determination === "accepted" && !s.shelved && !s.archived && !s.boxId
    );
    return { shelved, awaiting, boxes };
  }, [data]);

  const boxLabel = (s: Specimen): string | null => {
    if (!s.boxId) return null;
    const b = data.boxes.find((x) => x.id === s.boxId);
    if (!b) return null;
    return b.status === "in_transit" ? "在途交换" : b.status === "sealed" ? "已封存" : "已装箱";
  };

  const freeCount = shelved.filter((s) => !s.boxId).length;

  return (
    <div className="page-grid single">
      <section className="panel">
        <div className="heading">
          <div>
            <p>Cabinet Records</p>
            <h2>馆藏柜位记录</h2>
          </div>
          <div className="count-row">
            <span className="count-tag">在柜 {freeCount}</span>
            <span className="count-tag">已上柜 {shelved.length}</span>
          </div>
        </div>

        {awaiting.length > 0 && (
          <div className="notice">
            有 {awaiting.length} 份鉴定接受的标本尚未上柜，不能进入装箱台：
            {awaiting.map((s) => s.collectionNo).join("、")}
          </div>
        )}

        {shelved.length === 0 ? (
          <EmptyHint>暂无上柜记录；请先在入库队列对鉴定接受的标本录入柜位。</EmptyHint>
        ) : (
          <div className="shelf-grid">
            {shelved.map((s) => (
              <ShelfCard key={s.id} specimen={s} boxLabel={boxLabel(s)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

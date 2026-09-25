import { useMemo, useState } from "react";
import { useApp } from "./context";
import { Badge, EmptyHint } from "./ui";
import type { ExchangeBox, Specimen } from "../business/store";
import {
  freeSlots,
  isFull,
  listBoxes,
  listCandidates,
  reasonText,
} from "../business/packing";

function SpecimenLine({ specimen, extra }: { specimen: Specimen; extra?: React.ReactNode }) {
  return (
    <div className="line">
      <div className="line-main">
        <b>{specimen.collectionNo}</b>
        <span>{specimen.species}</span>
        <em>{specimen.cabinet ?? "—"}</em>
      </div>
      <div className="line-side">
        {extra}
        <a className="ghost-link" href={`#/specimen/${specimen.id}`}>详情</a>
      </div>
    </div>
  );
}

function OpenBoxPanel({ box }: { box: ExchangeBox }) {
  const { data, dispatch } = useApp();
  const candidates = useMemo(() => listCandidates(data, box.id), [data, box.id]);
  const full = isFull(box);
  const items = box.itemIds
    .map((id) => data.specimens.find((s) => s.id === id))
    .filter((s): s is Specimen => !!s);
  const archived = box.archivedIds
    .map((id) => data.specimens.find((s) => s.id === id))
    .filter((s): s is Specimen => !!s);

  return (
    <div className="box-panel">
      <div className="slot-grid">
        {Array.from({ length: box.capacity }).map((_, i) => {
          const item = items[i];
          return (
            <div key={i} className={`slot ${item ? "filled" : "empty"}`} title={item?.collectionNo}>
              {item ? item.collectionNo.slice(-7) : "空"}
            </div>
          );
        })}
      </div>

      <h4>在箱 {items.length} / {box.capacity} 份</h4>
      <div className="line-list">
        {items.length === 0 && <EmptyHint>空箱，从下方候选补装。</EmptyHint>}
        {items.map((s) => (
          <SpecimenLine
            key={s.id}
            specimen={s}
            extra={
              <button onClick={() => dispatch({ type: "unpack", boxId: box.id, specimenId: s.id })}>
                移出
              </button>
            }
          />
        ))}
      </div>

      <div className="action-row">
        <button
          className="primary"
          disabled={!full}
          title={full ? "箱满封存，进入在途交换" : `还差 ${freeSlots(box)} 份才能封存`}
          onClick={() => dispatch({ type: "seal-box", boxId: box.id })}
        >
          {full ? "箱满封存 · 发往在途交换" : `未满（差 ${freeSlots(box)} 份），不可封存`}
        </button>
      </div>

      <h4>候选标本（同一采集号只出现一份）</h4>
      <div className="line-list candidates">
        {candidates.length === 0 && <EmptyHint>暂无可装箱候选。</EmptyHint>}
        {candidates.map(({ specimen, rejection, pickable }) => (
          <div key={specimen.id} className={`candidate ${pickable ? "" : "blocked"}`}>
            <SpecimenLine
              specimen={specimen}
              extra={
                pickable ? (
                  <button className="primary" onClick={() => dispatch({ type: "pack", boxId: box.id, specimenId: specimen.id })}>
                    入箱
                  </button>
                ) : (
                  <span className="reasons">
                    {rejection?.reasons.slice(0, 2).map((r) => (
                      <Badge key={r} tone="red">{reasonText(r)}</Badge>
                    ))}
                  </span>
                )
              }
            />
          </div>
        ))}
      </div>

      {archived.length > 0 && (
        <>
          <h4>该馆已接受留档 {archived.length} 份（继续留档）</h4>
          <div className="line-list archived-list">
            {archived.map((s) => (
              <SpecimenLine key={s.id} specimen={s} extra={<Badge tone="gray">已留档</Badge>} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SealedBoxPanel({ box }: { box: ExchangeBox }) {
  const { data, dispatch } = useApp();
  const [returned, setReturned] = useState<Set<string>>(new Set());
  const items = box.itemIds
    .map((id) => data.specimens.find((s) => s.id === id))
    .filter((s): s is Specimen => !!s);
  const archived = box.archivedIds
    .map((id) => data.specimens.find((s) => s.id === id))
    .filter((s): s is Specimen => !!s);

  function toggle(id: string) {
    setReturned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="box-panel">
      <div className="sealed-note">
        <Badge tone="blue">在途交换</Badge>
        <span>{box.sealedAt} 封存发出；收到外馆处理结果后逐份勾选「退回」，其余视为接受留档。</span>
      </div>

      <h4>在途 {items.length} 份（勾选 = 外馆退回）</h4>
      <div className="line-list">
        {items.map((s) => (
          <label key={s.id} className="return-line">
            <input type="checkbox" checked={returned.has(s.id)} onChange={() => toggle(s.id)} />
            <div className="line-main">
              <b>{s.collectionNo}</b>
              <span>{s.species}</span>
              <em>{returned.has(s.id) ? "退回 → 待复核" : "接受 → 外馆留档"}</em>
            </div>
            <a className="ghost-link" href={`#/specimen/${s.id}`}>详情</a>
          </label>
        ))}
      </div>

      <div className="action-row">
        <button
          className="primary"
          onClick={() => {
            dispatch({ type: "process-return", boxId: box.id, returnedIds: [...returned] });
            setReturned(new Set());
          }}
        >
          确认处理结果：{returned.size} 份退回 · {items.length - returned.size} 份留档
        </button>
      </div>

      {archived.length > 0 && (
        <>
          <h4>该馆已接受留档 {archived.length} 份</h4>
          <div className="line-list archived-list">
            {archived.map((s) => (
              <SpecimenLine key={s.id} specimen={s} extra={<Badge tone="gray">已留档</Badge>} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PackingStation() {
  const { data, dispatch } = useApp();
  const summaries = useMemo(() => listBoxes(data), [data]);
  const [selectedId, setSelectedId] = useState<string>(summaries[0]?.box.id ?? "");
  const selected = data.boxes.find((b) => b.id === selectedId) ?? summaries[0]?.box;

  return (
    <div className="view packing">
      <aside className="panel box-list">
        <p className="panel-kicker">复份交换 · 装箱台</p>
        <h2>外馆交换箱</h2>
        <p className="rule-note">
          入箱条件：鉴定接受、已上柜、未在在途交换箱、未放进别的箱；同一采集号每箱只留一份。箱满方可封存。
        </p>
        {data.institutions.map((ins) => {
          const boxes = summaries.filter((sum) => sum.box.institutionCode === ins.code);
          return (
            <div key={ins.code} className="inst-group">
              <div className="inst-head">
                <strong>{ins.code}</strong>
                <span>{ins.name}</span>
                <button onClick={() => dispatch({ type: "new-box", institutionCode: ins.code })}>
                  + 新建箱
                </button>
              </div>
              {boxes.map(({ box, used, free, full }) => (
                <button
                  key={box.id}
                  className={`box-tab ${selected?.id === box.id ? "active" : ""}`}
                  onClick={() => setSelectedId(box.id)}
                >
                  <b>{box.id}</b>
                  <span>
                    {box.status === "sealed" ? (
                      <Badge tone="blue">在途</Badge>
                    ) : full ? (
                      <Badge tone="green">待封存</Badge>
                    ) : (
                      <Badge tone="teal">装箱中</Badge>
                    )}
                  </span>
                  <em>{used}/{box.capacity}{free > 0 && box.status === "open" ? ` · 空${free}` : ""}</em>
                </button>
              ))}
            </div>
          );
        })}
      </aside>

      <section className="panel box-detail">
        {!selected ? (
          <EmptyHint>尚无交换箱。</EmptyHint>
        ) : (
          <>
            <div className="heading">
              <div>
                <p>{selected.id}</p>
                <h2>{data.institutions.find((i) => i.code === selected.institutionCode)?.name}</h2>
              </div>
              <div className="box-stat">
                <Badge tone={selected.status === "sealed" ? "blue" : "teal"}>
                  {selected.status === "sealed" ? "在途交换" : "装箱中"}
                </Badge>
              </div>
            </div>
            {selected.status === "sealed" ? (
              <SealedBoxPanel key={selected.id} box={selected} />
            ) : (
              <OpenBoxPanel key={selected.id} box={selected} />
            )}
          </>
        )}
      </section>
    </div>
  );
}

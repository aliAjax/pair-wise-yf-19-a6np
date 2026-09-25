import { useMemo, useState } from "react";
import { store } from "../business/store";
import type { ExchangeBox, Specimen } from "../business/storage";
import {
  BOX_STATUS_LABEL,
  boxAddCheck,
  DEFAULT_CAPACITY,
  freeSlots,
  isFull,
  packableCandidates,
} from "../business/packing";
import { EmptyHint, Pill } from "./common";

const STATUS_TONE = { open: "blue", sealed: "amber", in_transit: "red" } as const;

function SlotStrip({ box }: { box: ExchangeBox }) {
  return (
    <div className="slot-strip" aria-label={`箱内 ${box.itemIds.length} / ${box.capacity}`}>
      {Array.from({ length: box.capacity }).map((_, i) => (
        <span key={i} className={i < box.itemIds.length ? "slot filled" : "slot empty"} />
      ))}
      <span className="slot-count">
        {box.itemIds.length}/{box.capacity}
      </span>
    </div>
  );
}

function BoxListItem({ box, active }: { box: ExchangeBox; active: boolean }) {
  return (
    <button className={active ? "box-item active" : "box-item"} onClick={() => store.selectBox(box.id)}>
      <div>
        <strong>{box.id}</strong>
        <small>{box.institution}</small>
      </div>
      <div className="box-item-right">
        <Pill tone={STATUS_TONE[box.status]}>{BOX_STATUS_LABEL[box.status]}</Pill>
        <span>
          {box.itemIds.length}/{box.capacity}
        </span>
      </div>
    </button>
  );
}

function BoxItemRow({
  box,
  specimen,
  outcome,
  setOutcome,
}: {
  box: ExchangeBox;
  specimen: Specimen;
  outcome?: "accepted" | "returned";
  setOutcome?: (v: "accepted" | "returned") => void;
}) {
  return (
    <div className="packed-row">
      <button className="link-btn" onClick={() => store.navigate({ name: "detail", id: specimen.id })}>
        <strong>{specimen.collectionNo}</strong>
      </button>
      <span className="packed-species">{specimen.species}</span>
      <span className="packed-cabinet">{specimen.cabinetPosition}</span>
      {box.status === "open" && (
        <button className="tiny danger" onClick={() => store.removeFromBox(box.id, specimen.id)}>
          取出
        </button>
      )}
      {box.status === "in_transit" && setOutcome && (
        <div className="outcome-toggle">
          <button
            className={outcome === "accepted" ? "tiny chip-on" : "tiny"}
            onClick={() => setOutcome("accepted")}
          >
            接受留档
          </button>
          <button
            className={outcome === "returned" ? "tiny chip-on" : "tiny"}
            onClick={() => setOutcome("returned")}
          >
            退回复核
          </button>
        </div>
      )}
      {(box.status === "sealed" || box.status === "in_transit") && !setOutcome && (
        <Pill tone={STATUS_TONE[box.status]}>{BOX_STATUS_LABEL[box.status]}</Pill>
      )}
    </div>
  );
}

function CandidateList({ box, specimens }: { box: ExchangeBox; specimens: Specimen[] }) {
  const candidateMap = useMemo(() => {
    const byId = new Map(specimens.map((s) => [s.id, s]));
    return packableCandidates(specimens).map((g) => ({
      ...g,
      members: g.specimens.map((s) => ({
        specimen: byId.get(s.id)!,
        reason: boxAddCheck(box, s, specimens),
      })),
    }));
  }, [box, specimens]);

  if (candidateMap.length === 0) {
    return <EmptyHint>暂无可入箱标本：需要鉴定接受、已上柜且不在其他箱内。</EmptyHint>;
  }

  return (
    <div className="candidate-groups">
      {candidateMap.map((g) => (
        <div key={g.key} className="candidate-group">
          <div className="candidate-head">
            <strong>{g.key}</strong>
            <span>{g.species}</span>
            {g.members.length > 1 && <Pill tone="teal">复份 {g.members.length} 份 · 每馆只留一份</Pill>}
          </div>
          {g.members.map(({ specimen, reason }) => (
            <div key={specimen.id} className="candidate-row">
              <button
                className="link-btn"
                onClick={() => store.navigate({ name: "detail", id: specimen.id })}
              >
                {specimen.id}
              </button>
              <span className="packed-cabinet">{specimen.cabinetPosition}</span>
              {reason ? (
                <span className="block-reason" title={reason}>
                  ✗ {reason}
                </span>
              ) : (
                <button className="tiny primary" onClick={() => store.addToBox(box.id, specimen.id)}>
                  补装入箱
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ReceivePanel({ box, specimens }: { box: ExchangeBox; specimens: Specimen[] }) {
  const [outcomes, setOutcomes] = useState<Record<string, "accepted" | "returned">>(() =>
    Object.fromEntries(box.itemIds.map((id) => [id, "returned" as const]))
  );
  const accepted = box.itemIds.filter((id) => outcomes[id] === "accepted");
  const returned = box.itemIds.filter((id) => outcomes[id] === "returned");

  return (
    <div className="receive-panel">
      <h4>登记外馆核退结果</h4>
      <p className="note-line">
        接受的标本继续留档；退回的标本回到<b>待复核</b>并暂离柜位；箱子清空后空位可补别的标本。
      </p>
      {specimens.map((s) => (
        <BoxItemRow
          key={s.id}
          box={box}
          specimen={s}
          outcome={outcomes[s.id] ?? "returned"}
          setOutcome={(v) => setOutcomes((m) => ({ ...m, [s.id]: v }))}
        />
      ))}
      <button
        className="primary submit-btn"
        onClick={() => store.receiveBox(box.id, accepted, returned)}
      >
        确认收到：留档 {accepted.length} · 退回 {returned.length}
      </button>
    </div>
  );
}

function BoxDetail({ box, specimens }: { box: ExchangeBox; specimens: Specimen[] }) {
  const items = box.itemIds
    .map((id) => specimens.find((s) => s.id === id))
    .filter((s): s is Specimen => !!s);
  const full = isFull(box);

  return (
    <section className="panel box-detail">
      <div className="heading">
        <div>
          <p>Exchange Box</p>
          <h2>
            {box.id} <span className="institution-inline">{box.institution}</span>
          </h2>
        </div>
        <Pill tone={STATUS_TONE[box.status]}>{BOX_STATUS_LABEL[box.status]}</Pill>
      </div>

      <SlotStrip box={box} />

      <div className="packed-list">
        {items.length === 0 && <EmptyHint>空箱。从下方候选清单补装标本（同一采集号只留一份）。</EmptyHint>}
        {items.map((s) => (
          <BoxItemRow key={s.id} box={box} specimen={s} />
        ))}
      </div>

      {box.status === "open" && (
        <>
          <div className="action-bar">
            <button className="primary" disabled={!full} onClick={() => store.sealBox(box.id)}>
              {full ? "箱满封存" : `封存（需装满，还差 ${freeSlots(box)} 份）`}
            </button>
            <span className="note-line">封存后才能寄出；未满之前可继续补装或取出。</span>
          </div>
          <h4 className="candidate-title">可补装标本</h4>
          <CandidateList box={box} specimens={specimens} />
        </>
      )}

      {box.status === "sealed" && (
        <div className="action-bar">
          <button className="primary" onClick={() => store.sendBox(box.id)}>
            寄出（进入在途交换）
          </button>
          <span className="note-line">封存箱内标本已锁定，等待寄送。</span>
        </div>
      )}

      {box.status === "in_transit" && <ReceivePanel box={box} specimens={items} />}

      {box.cycles.length > 0 && (
        <div className="cycles">
          <h4>往轮留档记录</h4>
          {box.cycles
            .slice()
            .reverse()
            .map((c, i) => (
              <div key={i} className="cycle-row">
                <span>第 {box.cycles.length - i} 轮</span>
                <Pill tone="blue">接受 {c.accepted.length}</Pill>
                <Pill tone="amber">退回 {c.returned.length}</Pill>
                <small>
                  {c.accepted.map((x) => x.collectionNo).join("、") || "—"}
                  {c.returned.length > 0 ? ` ｜ 退回：${c.returned.map((x) => x.collectionNo).join("、")}` : ""}
                </small>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

export function PackingPage() {
  const { data } = store.useState();
  const [institution, setInstitution] = useState(store.institutions()[0]);
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);

  const selected =
    data.boxes.find((b) => b.id === data.selectedBoxId) ?? data.boxes[0];

  const sortedBoxes = useMemo(
    () =>
      [...data.boxes].sort((a, b) => {
        const rank = { in_transit: 0, open: 1, sealed: 2 };
        return rank[a.status] - rank[b.status] || a.id.localeCompare(b.id);
      }),
    [data.boxes]
  );

  const stats = useMemo(() => {
    const inTransit = data.boxes.filter((b) => b.status === "in_transit").length;
    const openSlots = data.boxes
      .filter((b) => b.status === "open")
      .reduce((sum, b) => sum + freeSlots(b), 0);
    const transitSheets = data.boxes
      .filter((b) => b.status === "in_transit")
      .reduce((sum, b) => sum + b.itemIds.length, 0);
    const archived = data.specimens.filter((s) => s.archived).length;
    return { inTransit, openSlots, transitSheets, archived };
  }, [data]);

  return (
    <div className="packing-layout">
      <aside className="panel box-sidebar">
        <div className="heading">
          <div>
            <p>Boxes</p>
            <h2>交换箱（按外馆）</h2>
          </div>
        </div>

        <div className="pack-stats">
          <span>在途箱 {stats.inTransit}</span>
          <span>在途标本 {stats.transitSheets}</span>
          <span>空箱位 {stats.openSlots}</span>
          <span>留档 {stats.archived}</span>
        </div>

        <div className="box-list">
          {sortedBoxes.map((b) => (
            <BoxListItem key={b.id} box={b} active={selected?.id === b.id} />
          ))}
        </div>

        <div className="create-box">
          <h4>为外馆新建空箱</h4>
          <label>
            <span>收箱外馆</span>
            <select value={institution} onChange={(e) => setInstitution(e.target.value)}>
              {store.institutions().map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>箱容量（份）</span>
            <input
              type="number"
              min={1}
              max={30}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
            />
          </label>
          <button className="primary submit-btn" onClick={() => store.createBox(institution, capacity)}>
            建箱
          </button>
        </div>

        <div className="rule-card">
          <h4>入箱硬规则</h4>
          <ol>
            <li>鉴定状态为「鉴定接受」</li>
            <li>已上柜且有柜位记录</li>
            <li>未在其他交换箱内（不在途、未封存）</li>
            <li>同一采集号在同一外馆箱中只留一份</li>
            <li>装满才允许封存并寄出</li>
          </ol>
        </div>
      </aside>

      {selected ? (
        <BoxDetail box={selected} specimens={data.specimens} />
      ) : (
        <section className="panel">
          <EmptyHint>还没有交换箱，先在左侧为外馆建箱。</EmptyHint>
        </section>
      )}
    </div>
  );
}

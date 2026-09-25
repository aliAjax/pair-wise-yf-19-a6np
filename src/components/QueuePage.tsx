import { useMemo, useState } from "react";
import { store } from "../business/store";
import type { Determination, Specimen } from "../business/storage";
import { DeterminationPill, EmptyHint, Pill } from "./common";

const FILTERS = ["全部", "待压制", "待鉴定", "待复核", "已上柜", "在途交换", "已留档"] as const;

function matchFilter(s: Specimen, filter: string, inTransit: boolean): boolean {
  switch (filter) {
    case "待压制":
      return !s.pressed;
    case "待鉴定":
      return s.determination === "pending";
    case "待复核":
      return s.determination === "review";
    case "已上柜":
      return s.shelved;
    case "在途交换":
      return inTransit;
    case "已留档":
      return s.archived;
    default:
      return true;
  }
}

function SpecimenRow({ specimen }: { specimen: Specimen }) {
  const [shelfInput, setShelfInput] = useState("");
  const inTransit = !!specimen.boxId;

  return (
    <article className="queue-card">
      <div className="queue-head">
        <div>
          <button className="link-btn" onClick={() => store.navigate({ name: "detail", id: specimen.id })}>
            <h3>{specimen.collectionNo}</h3>
          </button>
          <p className="species-line">{specimen.species}</p>
        </div>
        <div className="badges">
          {specimen.archived && <Pill tone="blue">已留档</Pill>}
          <DeterminationPill value={specimen.determination} />
          {inTransit && <Pill tone="red">在交换箱内</Pill>}
        </div>
      </div>

      <p className="meta-line">
        {[specimen.locality, specimen.elevation, specimen.collectors].filter(Boolean).join(" · ") || "采集地点信息待补"}
      </p>

      <div className="row-actions">
        <button
          className={specimen.pressed ? "" : "primary"}
          disabled={specimen.archived || inTransit}
          onClick={() => store.setPressed(specimen.id, !specimen.pressed)}
        >
          {specimen.pressed ? "退回压制" : "确认压制"}
        </button>
        {(["pending", "accepted", "review"] as Determination[]).map((d) => (
          <button
            key={d}
            className={specimen.determination === d ? "chip-on" : ""}
            disabled={inTransit}
            onClick={() => store.setDetermination(specimen.id, d)}
          >
            {{ pending: "待鉴定", accepted: "鉴定接受", review: "待复核" }[d]}
          </button>
        ))}
      </div>

      {specimen.determination === "accepted" && !specimen.shelved && !specimen.archived && !inTransit && (
        <div className="shelf-row">
          <input
            placeholder="录入柜位，如 B-12-06"
            value={shelfInput}
            onChange={(e) => setShelfInput(e.target.value)}
          />
          <button className="primary" onClick={() => store.shelveSpecimen(specimen.id, shelfInput) && setShelfInput("")}>
            上柜
          </button>
        </div>
      )}
      {specimen.shelved && <p className="note-line">馆藏柜位：<b>{specimen.cabinetPosition}</b></p>}
    </article>
  );
}

export function QueuePage() {
  const { data } = store.useState();
  const [form, setForm] = useState({
    collectionNo: "",
    species: "",
    locality: "",
    elevation: "",
    habitat: "",
    collectors: "",
  });

  const list = useMemo(() => {
    const transitIds = new Set(data.boxes.filter((b) => b.status === "in_transit").flatMap((b) => b.itemIds));
    return data.specimens
      .filter((s) => matchFilter(s, data.queueFilter, transitIds.has(s.id)))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [data]);

  const counts = useMemo(() => {
    const transitIds = new Set(data.boxes.filter((b) => b.status === "in_transit").flatMap((b) => b.itemIds));
    return Object.fromEntries(
      FILTERS.map((f) => [f, data.specimens.filter((s) => matchFilter(s, f, transitIds.has(s.id))).length])
    );
  }, [data]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="page-grid">
      <section className="panel form-panel">
        <div className="heading">
          <div>
            <p>压制标本登记</p>
            <h2>新增入库记录</h2>
          </div>
        </div>
        <div className="field-grid">
          <label>
            <span>采集号 *</span>
            <input value={form.collectionNo} onChange={set("collectionNo")} placeholder="如 HX-240925-01（复份同号）" />
          </label>
          <label>
            <span>物种名称</span>
            <input value={form.species} onChange={set("species")} placeholder="填写物种名称" />
          </label>
          <label>
            <span>采集地点</span>
            <input value={form.locality} onChange={set("locality")} placeholder="省县 / 小地名" />
          </label>
          <label>
            <span>海拔</span>
            <input value={form.elevation} onChange={set("elevation")} placeholder="如 1420 m" />
          </label>
          <label className="span-2">
            <span>生境描述</span>
            <input value={form.habitat} onChange={set("habitat")} placeholder="坡向、土壤、伴生植物等" />
          </label>
          <label>
            <span>采集人</span>
            <input value={form.collectors} onChange={set("collectors")} placeholder="采集人 / 号" />
          </label>
        </div>
        <button
          className="primary submit-btn"
          onClick={() => {
            if (store.addSpecimen(form)) {
              setForm({ collectionNo: "", species: "", locality: "", elevation: "", habitat: "", collectors: "" });
            }
          }}
        >
          进入入库队列
        </button>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>Accession Queue</p>
            <h2>入库队列</h2>
          </div>
          <span className="count-tag">{list.length} 份</span>
        </div>
        <div className="chips">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={data.queueFilter === f ? "chip-on" : ""}
              onClick={() => store.setQueueFilter(f)}
            >
              {f} {counts[f]}
            </button>
          ))}
        </div>
        <div className="queue-list">
          {list.length === 0 ? (
            <EmptyHint>该筛选下没有标本。</EmptyHint>
          ) : (
            list.map((s) => <SpecimenRow key={s.id} specimen={s} />)
          )}
        </div>
      </section>
    </div>
  );
}

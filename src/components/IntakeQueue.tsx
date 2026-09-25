import { useMemo, useState } from "react";
import { buildCabinetGrid } from "../business/store";
import {
  ID_STATUS_TEXT,
  QUEUE_FILTERS,
  matchFilter,
  stageLabel,
} from "../business/packing";
import { useApp } from "./context";
import { Badge, EmptyHint, Field } from "./ui";
import type { Specimen } from "../business/store";
import type { QueueFilter } from "../business/packing";

export function toneFor(label: string): string {
  if (label.includes("待压制")) return "amber";
  if (label.includes("待鉴定") || label.includes("存疑")) return "amber";
  if (label.includes("待上柜")) return "blue";
  if (label.includes("已上柜")) return "green";
  if (label.includes("装箱")) return "teal";
  if (label.includes("在途")) return "blue";
  if (label.includes("退回")) return "red";
  if (label.includes("留档")) return "gray";
  return "gray";
}

function SpecimenCard({ specimen }: { specimen: Specimen }) {
  const { data, dispatch } = useApp();
  const label = stageLabel(data, specimen);
  const freeCabinets = useMemo(() => {
    const occupied = new Set(
      data.specimens.filter((s) => s.cabinet).map((s) => s.cabinet as string),
    );
    return buildCabinetGrid().filter((cell) => !occupied.has(cell));
  }, [data.specimens]);
  const [cabinet, setCabinet] = useState("");

  const canShelve =
    specimen.idStatus === "accepted" &&
    !specimen.cabinet &&
    specimen.stage !== "archived";
  const canUnShelve =
    specimen.stage === "cabinet" && !specimen.boxId && !specimen.archivedBoxId;
  const inSealedBox =
    specimen.boxId &&
    data.boxes.find((b) => b.id === specimen.boxId)?.status === "sealed";

  return (
    <article className="spec-card">
      <div className="spec-main">
        <div className="spec-title">
          <h3>{specimen.collectionNo}</h3>
          <Badge tone={toneFor(label)}>{label}</Badge>
          {specimen.idStatus === "accepted" && <Badge tone="green">鉴定接受</Badge>}
          {specimen.idStatus === "doubted" && <Badge tone="amber">存疑待定</Badge>}
        </div>
        <p className="spec-sub">
          {specimen.species} · {specimen.collector} · {specimen.location} · {specimen.altitude}
        </p>
        <p className="spec-meta">
          {specimen.cabinet ? (
            <a href={`#/cabinet`} className="link">
              柜位 {specimen.cabinet}
            </a>
          ) : (
            "未上柜"
          )}
          {specimen.boxId && <> · 交换箱 <b>{specimen.boxId}</b>{inSealedBox ? "（在途）" : "（装箱中）"}</>}
          {specimen.archivedBoxId && <> · 留档箱 <b>{specimen.archivedBoxId}</b>（{specimen.institutionCode}）</>}
        </p>
      </div>

      <div className="spec-actions">
        {!specimen.pressed && specimen.stage !== "archived" && (
          <button onClick={() => dispatch({ type: "set-pressed", id: specimen.id, pressed: true })}>
            压制完成
          </button>
        )}
        {specimen.pressed && specimen.stage !== "archived" && !inSealedBox && (
          <select
            value={specimen.idStatus}
            onChange={(e) =>
              dispatch({ type: "set-id-status", id: specimen.id, status: e.target.value as Specimen["idStatus"] })
            }
          >
            {Object.entries(ID_STATUS_TEXT).map(([key, text]) => (
              <option key={key} value={key}>{text}</option>
            ))}
          </select>
        )}
        {canShelve && (
          <span className="inline-shelve">
            <select value={cabinet} onChange={(e) => setCabinet(e.target.value)}>
              <option value="">选择柜位</option>
              {freeCabinets.map((cell) => (
                <option key={cell} value={cell}>{cell}</option>
              ))}
            </select>
            <button
              className="primary"
              disabled={!cabinet}
              onClick={() => {
                dispatch({ type: "shelve", id: specimen.id, cabinet });
                setCabinet("");
              }}
            >
              上柜
            </button>
          </span>
        )}
        {canUnShelve && (
          <button onClick={() => dispatch({ type: "unshelve", id: specimen.id })}>撤下柜位</button>
        )}
        <a className="ghost-link" href={`#/specimen/${specimen.id}`}>详情 →</a>
      </div>
    </article>
  );
}

export function IntakeQueue() {
  const { data, dispatch } = useApp();
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [form, setForm] = useState({
    collectionNo: "",
    species: "",
    location: "",
    altitude: "",
    habitat: "",
    collector: "",
    pressed: false,
  });
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const kw = keyword.trim();
    return data.specimens.filter((s) => {
      if (!matchFilter(data, s, filter)) return false;
      if (!kw) return true;
      return [s.collectionNo, s.species, s.collector, s.location].some((v) => v.includes(kw));
    });
  }, [data, filter, keyword]);

  const counts = useMemo(() => {
    const map = new Map<QueueFilter, number>();
    for (const f of QUEUE_FILTERS) {
      map.set(f.key, data.specimens.filter((s) => matchFilter(data, s, f.key)).length);
    }
    return map;
  }, [data]);

  function submit() {
    if (!form.collectionNo.trim()) return;
    dispatch({ type: "add-specimen", input: { ...form } });
    setForm({
      collectionNo: "",
      species: "",
      location: "",
      altitude: "",
      habitat: "",
      collector: "",
      pressed: false,
    });
    setShowForm(false);
  }

  return (
    <div className="view">
      <section className="panel">
        <div className="heading">
          <div>
            <p>入库队列</p>
            <h2>压制 · 鉴定 · 上柜</h2>
          </div>
          <button className="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "收起录入" : "+ 登记新标本"}
          </button>
        </div>

        {showForm && (
          <div className="entry-form">
            <div className="field-grid">
              <Field label="采集号 *">
                <input
                  value={form.collectionNo}
                  placeholder="如 HX-260311-01"
                  onChange={(e) => setForm({ ...form, collectionNo: e.target.value })}
                />
              </Field>
              <Field label="物种名称">
                <input value={form.species} placeholder="科属种 / 待定名" onChange={(e) => setForm({ ...form, species: e.target.value })} />
              </Field>
              <Field label="采集地点">
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field label="海拔">
                <input value={form.altitude} placeholder="如 1420 m" onChange={(e) => setForm({ ...form, altitude: e.target.value })} />
              </Field>
              <Field label="采集人">
                <input value={form.collector} onChange={(e) => setForm({ ...form, collector: e.target.value })} />
              </Field>
              <Field label="生境描述">
                <input value={form.habitat} onChange={(e) => setForm({ ...form, habitat: e.target.value })} />
              </Field>
            </div>
            <label className="checkline">
              <input
                type="checkbox"
                checked={form.pressed}
                onChange={(e) => setForm({ ...form, pressed: e.target.checked })}
              />
              已完成压制
            </label>
            <div className="form-foot">
              <button className="primary" disabled={!form.collectionNo.trim()} onClick={submit}>
                进入入库队列
              </button>
            </div>
          </div>
        )}

        <div className="filter-bar">
          <div className="chips">
            {QUEUE_FILTERS.map((f) => (
              <button
                key={f.key}
                className={filter === f.key ? "chip active" : "chip"}
                onClick={() => setFilter(f.key)}
              >
                {f.label} <em>{counts.get(f.key)}</em>
              </button>
            ))}
          </div>
          <input
            className="search"
            placeholder="搜索采集号 / 物种 / 采集人 / 地点"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className="spec-list">
          {filtered.length === 0 && <EmptyHint>没有符合条件的标本。</EmptyHint>}
          {filtered.map((s) => (
            <SpecimenCard key={s.id} specimen={s} />
          ))}
        </div>
      </section>
    </div>
  );
}

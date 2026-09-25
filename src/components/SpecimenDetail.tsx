import { useMemo, useState } from "react";
import { useApp } from "./context";
import { Badge, EmptyHint } from "./ui";
import {
  ID_STATUS_TEXT,
  canPack,
  reasonText,
  stageLabel,
} from "../business/packing";
import { buildCabinetGrid } from "../business/store";
import { toneFor } from "./IntakeQueue";

export function SpecimenDetail({ id }: { id: string }) {
  const { data, dispatch } = useApp();
  const specimen = data.specimens.find((s) => s.id === id);
  const [cabinet, setCabinet] = useState("");

  const freeCabinets = useMemo(() => {
    const occupied = new Set(
      data.specimens.filter((s) => s.cabinet).map((s) => s.cabinet as string),
    );
    return buildCabinetGrid().filter((cell) => !occupied.has(cell));
  }, [data.specimens]);

  if (!specimen) {
    return (
      <div className="view">
        <section className="panel">
          <EmptyHint>未找到该标本，可能编号有误。</EmptyHint>
          <a className="ghost-link" href="#/">← 回入库队列</a>
        </section>
      </div>
    );
  }

  const label = stageLabel(data, specimen);
  const currentBox = specimen.boxId ? data.boxes.find((b) => b.id === specimen.boxId) : undefined;
  const archivedBox = specimen.archivedBoxId
    ? data.boxes.find((b) => b.id === specimen.archivedBoxId)
    : undefined;
  const canShelve =
    specimen.idStatus === "accepted" && !specimen.cabinet && specimen.stage !== "archived";
  const canUnShelve =
    specimen.stage === "cabinet" && !specimen.boxId && !specimen.archivedBoxId;

  return (
    <div className="view detail">
      <a className="ghost-link back" href="#/">← 回入库队列</a>

      <section className="panel">
        <div className="heading">
          <div>
            <p>标本详情 {specimen.id}</p>
            <h2>{specimen.collectionNo}</h2>
          </div>
          <div className="badge-stack">
            <Badge tone={toneFor(label)}>{label}</Badge>
            <Badge tone={specimen.idStatus === "accepted" ? "green" : "amber"}>
              {ID_STATUS_TEXT[specimen.idStatus]}
            </Badge>
            <Badge tone={specimen.pressed ? "teal" : "amber"}>
              {specimen.pressed ? "已压制" : "待压制"}
            </Badge>
          </div>
        </div>

        <div className="detail-grid">
          <div><small>物种名称</small><p>{specimen.species}</p></div>
          <div><small>采集人</small><p>{specimen.collector}</p></div>
          <div><small>采集地点</small><p>{specimen.location}</p></div>
          <div><small>海拔</small><p>{specimen.altitude || "—"}</p></div>
          <div className="span2"><small>生境描述</small><p>{specimen.habitat || "—"}</p></div>
          <div><small>馆藏柜位</small><p>{specimen.cabinet ?? "未上柜"}</p></div>
          <div>
            <small>交换状态</small>
            <p>
              {currentBox ? (
                <>在交换箱 <b>{currentBox.id}</b>（{currentBox.status === "sealed" ? "在途交换" : "装箱中"}，{currentBox.institutionCode}）</>
              ) : archivedBox ? (
                <>外馆留档于 <b>{archivedBox.id}</b>（{specimen.institutionCode}）</>
              ) : (
                "未参与交换"
              )}
            </p>
          </div>
        </div>

        <div className="detail-actions">
          {!specimen.pressed && specimen.stage !== "archived" && (
            <button onClick={() => dispatch({ type: "set-pressed", id: specimen.id, pressed: true })}>
              标记压制完成
            </button>
          )}
          {specimen.stage !== "archived" &&
            !(currentBox?.status === "sealed") && (
              <select
                value={specimen.idStatus}
                onChange={(e) =>
                  dispatch({
                    type: "set-id-status",
                    id: specimen.id,
                    status: e.target.value as typeof specimen.idStatus,
                  })
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
        </div>
      </section>

      <section className="panel">
        <p className="panel-kicker">装箱判定</p>
        <h2>各交换箱入箱校验</h2>
        <div className="check-list">
          {data.boxes.map((box) => {
            const rejection = canPack(data, specimen.id, box.id);
            const inside = specimen.boxId === box.id;
            return (
              <div key={box.id} className="check-row">
                <div className="line-main">
                  <b>{box.id}</b>
                  <span>{data.institutions.find((i) => i.code === box.institutionCode)?.name}</span>
                </div>
                {inside ? (
                  <Badge tone="teal">本份在此箱</Badge>
                ) : rejection ? (
                  <span className="reasons">
                    {rejection.reasons.map((r) => (
                      <Badge key={r} tone="red">{reasonText(r)}</Badge>
                    ))}
                  </span>
                ) : (
                  <>
                    <Badge tone="green">可入箱</Badge>
                    <button
                      className="primary"
                      onClick={() => dispatch({ type: "pack", boxId: box.id, specimenId: specimen.id })}
                    >
                      装入此箱
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <p className="panel-kicker">履历</p>
        <h2>处理日志</h2>
        <ul className="timeline">
          {specimen.log.map((entry, i) => (
            <li key={i}>
              <em>{entry.at}</em>
              <span>{entry.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

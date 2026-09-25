import { useState } from "react";
import { store } from "../business/store";
import type { Determination } from "../business/storage";
import { BOX_STATUS_LABEL } from "../business/packing";
import { EmptyHint, formatTime, SpecimenBadges } from "./common";

export function DetailPage({ id }: { id: string }) {
  const { data } = store.useState();
  const [shelfInput, setShelfInput] = useState("");
  const specimen = data.specimens.find((s) => s.id === id);

  if (!specimen) {
    return (
      <section className="panel">
        <EmptyHint>未找到该标本，可能已被重置。</EmptyHint>
        <button className="primary" onClick={() => store.navigate({ name: "queue" })}>
          回到入库队列
        </button>
      </section>
    );
  }

  const box = specimen.boxId ? data.boxes.find((b) => b.id === specimen.boxId) : undefined;
  const duplicates = data.specimens.filter(
    (s) => s.collectionNo === specimen.collectionNo && s.id !== specimen.id
  );

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="heading">
          <div>
            <p>Specimen Detail · {specimen.id}</p>
            <h2>{specimen.collectionNo}</h2>
          </div>
          <button onClick={() => history.back()}>返回上一页</button>
        </div>

        <SpecimenBadges specimen={specimen} boxStatus={box?.status} />

        <dl className="detail-grid">
          <div><dt>物种名称</dt><dd>{specimen.species || "—"}</dd></div>
          <div><dt>采集人</dt><dd>{specimen.collectors || "—"}</dd></div>
          <div><dt>采集地点</dt><dd>{specimen.locality || "—"}</dd></div>
          <div><dt>海拔</dt><dd>{specimen.elevation || "—"}</dd></div>
          <div className="span-2"><dt>生境描述</dt><dd>{specimen.habitat || "—"}</dd></div>
          <div>
            <dt>馆藏柜位</dt>
            <dd>{specimen.shelved ? specimen.cabinetPosition : specimen.archived ? "已留档外馆" : "未上柜"}</dd>
          </div>
          <div>
            <dt>交换状态</dt>
            <dd>
              {specimen.archived
                ? "外馆接受，继续留档"
                : box
                ? `在交换箱 ${box.id}（${BOX_STATUS_LABEL[box.status]} · ${box.institution}）`
                : "未参与交换"}
            </dd>
          </div>
        </dl>

        <div className="detail-actions">
          <button
            disabled={!!box || specimen.archived}
            onClick={() => store.setPressed(specimen.id, !specimen.pressed)}
          >
            {specimen.pressed ? "退回重新压制" : "确认压制"}
          </button>
          {(["pending", "accepted", "review"] as Determination[]).map((d) => (
            <button
              key={d}
              className={specimen.determination === d ? "chip-on" : ""}
              disabled={!!box}
              onClick={() => store.setDetermination(specimen.id, d)}
            >
              {{ pending: "待鉴定", accepted: "鉴定接受", review: "待复核" }[d]}
            </button>
          ))}
          {specimen.determination === "accepted" && !specimen.shelved && !specimen.archived && !box && (
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
          {box && (
            <button className="primary" onClick={() => { store.navigate({ name: "packing" }); store.selectBox(box.id); }}>
              查看交换箱 {box.id}
            </button>
          )}
        </div>
      </section>

      <div className="side-stack">
        <section className="panel">
          <h3>同采集号复份（{specimen.collectionNo}）</h3>
          {duplicates.length === 0 ? (
            <EmptyHint>仅一份，无复份。</EmptyHint>
          ) : (
            <div className="dup-list">
              {duplicates.map((d) => {
                const db = d.boxId ? data.boxes.find((b) => b.id === d.boxId) : undefined;
                return (
                  <button key={d.id} className="dup-row" onClick={() => store.navigate({ name: "detail", id: d.id })}>
                    <span>{d.id}</span>
                    <SpecimenBadges specimen={d} boxStatus={db?.status} />
                  </button>
                );
              })}
            </div>
          )}
          <p className="note-line">同一采集号的复份装箱时，每个外馆只保留一份。</p>
        </section>

        <section className="panel">
          <h3>处理记录</h3>
          <ol className="timeline">
            {[...specimen.log].reverse().map((entry, i) => (
              <li key={i}>
                <time>{formatTime(entry.at)}</time>
                <p>{entry.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

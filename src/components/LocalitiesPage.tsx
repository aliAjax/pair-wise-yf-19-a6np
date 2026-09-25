import { useMemo } from "react";
import { store } from "../business/store";
import type { Specimen } from "../business/storage";
import { EmptyHint, SpecimenBadges } from "./common";

interface LocalityGroup {
  locality: string;
  elevation: string;
  habitat: string;
  collectors: string;
  specimens: Specimen[];
}

export function LocalitiesPage() {
  const { data } = store.useState();

  const groups = useMemo<LocalityGroup[]>(() => {
    const map = new Map<string, LocalityGroup>();
    for (const s of data.specimens) {
      const key = s.locality || "未记录采集地点";
      const g = map.get(key) ?? {
        locality: key,
        elevation: s.elevation,
        habitat: s.habitat,
        collectors: s.collectors,
        specimens: [],
      };
      if (!g.elevation && s.elevation) g.elevation = s.elevation;
      if (!g.habitat && s.habitat) g.habitat = s.habitat;
      g.specimens.push(s);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.specimens.length - a.specimens.length);
  }, [data]);

  const boxStatusOf = (s: Specimen) =>
    s.boxId ? data.boxes.find((b) => b.id === s.boxId)?.status : undefined;

  return (
    <div className="page-grid single">
      <section className="panel">
        <div className="heading">
          <div>
            <p>Locality Cards</p>
            <h2>采集地点信息卡</h2>
          </div>
          <span className="count-tag">{groups.length} 个采集点</span>
        </div>
        <div className="locality-grid">
          {groups.length === 0 ? (
            <EmptyHint>暂无采集地点信息。</EmptyHint>
          ) : (
            groups.map((g) => (
              <article key={g.locality} className="locality-card">
                <div className="locality-map">
                  <span>采集点</span>
                  <strong>{g.specimens.length}</strong>
                  <small>份标本</small>
                </div>
                <div className="locality-body">
                  <h3>{g.locality}</h3>
                  <p className="meta-line">{[g.elevation, g.collectors].filter(Boolean).join(" · ")}</p>
                  <p className="habitat-line">{g.habitat || "生境描述待补"}</p>
                  <div className="locality-sheets">
                    {g.specimens.map((s) => (
                      <button
                        key={s.id}
                        className="sheet-chip"
                        onClick={() => store.navigate({ name: "detail", id: s.id })}
                      >
                        <span>{s.collectionNo}</span>
                        <SpecimenBadges specimen={s} boxStatus={boxStatusOf(s)} />
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

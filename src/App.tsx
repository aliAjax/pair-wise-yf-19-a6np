import { useEffect, useState } from "react";
import "./styles.css";
import { AppContext, useApp } from "./components/context";
import { useAppData } from "./business/state";
import { IntakeQueue } from "./components/IntakeQueue";
import { PackingStation } from "./components/PackingStation";
import { CabinetMap } from "./components/CabinetMap";
import { SpecimenDetail } from "./components/SpecimenDetail";

type Route = { name: "queue" } | { name: "packing" } | { name: "cabinet" } | { name: "specimen"; id: string };

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  const specimenMatch = hash.match(/^\/specimen\/(.+)$/);
  if (specimenMatch) return { name: "specimen", id: specimenMatch[1] };
  if (hash === "/packing") return { name: "packing" };
  if (hash === "/cabinet") return { name: "cabinet" };
  return { name: "queue" };
}

const TABS = [
  { hash: "#/", label: "入库队列", route: "queue" },
  { hash: "#/packing", label: "装箱台", route: "packing" },
  { hash: "#/cabinet", label: "柜位", route: "cabinet" },
] as const;

function Shell() {
  const { data, dispatch } = useApp();
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const pendingId = data.specimens.filter(
    (s) => s.idStatus === "pending" && s.stage !== "archived",
  ).length;
  const shelved = data.specimens.filter(
    (s) => s.stage === "cabinet" && !s.boxId,
  ).length;
  const inTransit = data.boxes
    .filter((b) => b.status === "sealed")
    .reduce((sum, b) => sum + b.itemIds.length, 0);
  const archived = data.specimens.filter((s) => s.stage === "archived").length;

  const metrics = [
    { label: "在馆标本", value: data.specimens.filter((s) => s.stage !== "archived").length },
    { label: "待鉴定 / 待复核", value: pendingId },
    { label: "已上柜待装", value: shelved },
    { label: "在途交换", value: inTransit },
    { label: "外馆留档", value: archived },
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62007 · 复份交换装箱台 · Port 62007</p>
        <h1>植物标本馆复份交换</h1>
        <span>
          纸单排箱改为按外馆电子分箱：仅鉴定接受、已上柜且未在途交换的标本可入箱，
          同一采集号每箱只留一份；箱满封存，退回份回到待复核、空槽可补装，接受份外馆留档。
          数据存于本浏览器，重开页面可继续处理。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <nav className="tabs">
        {TABS.map((tab) => (
          <a
            key={tab.hash}
            href={tab.hash}
            className={route.name === tab.route || (tab.route === "queue" && route.name === "specimen") ? "active" : ""}
          >
            {tab.label}
          </a>
        ))}
        <button
          className="reset-btn"
          onClick={() => {
            if (window.confirm("恢复为演示种子数据？当前修改将被清除。")) {
              dispatch({ type: "reset" });
              window.location.hash = "#/";
            }
          }}
        >
          重置演示数据
        </button>
      </nav>

      {route.name === "queue" && <IntakeQueue />}
      {route.name === "packing" && <PackingStation />}
      {route.name === "cabinet" && <CabinetMap />}
      {route.name === "specimen" && <SpecimenDetail key={route.id} id={route.id} />}
    </main>
  );
}

export default function App() {
  const store = useAppData();
  return (
    <AppContext.Provider value={store}>
      <Shell />
    </AppContext.Provider>
  );
}

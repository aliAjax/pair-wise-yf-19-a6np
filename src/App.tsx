import { useMemo } from "react";
import { store, type Route } from "./business/store";
import { freeSlots } from "./business/packing";
import { QueuePage } from "./components/QueuePage";
import { CabinetPage } from "./components/CabinetPage";
import { LocalitiesPage } from "./components/LocalitiesPage";
import { PackingPage } from "./components/PackingPage";
import { DetailPage } from "./components/DetailPage";
import "./styles.css";

const TABS: { key: Route["name"]; label: string; route: Route }[] = [
  { key: "queue", label: "入库队列", route: { name: "queue" } },
  { key: "cabinet", label: "馆藏柜位", route: { name: "cabinet" } },
  { key: "localities", label: "采集地点信息卡", route: { name: "localities" } },
  { key: "packing", label: "复份交换装箱台", route: { name: "packing" } },
];

function App() {
  const { data, route, toast } = store.useState();

  const metrics = useMemo(() => {
    const pending = data.specimens.filter((s) => s.determination === "pending" || s.determination === "review").length;
    const shelved = data.specimens.filter((s) => s.shelved && !s.archived).length;
    const localities = new Set(data.specimens.map((s) => s.locality).filter(Boolean)).size;
    const transit = data.boxes
      .filter((b) => b.status === "in_transit")
      .reduce((sum, b) => sum + b.itemIds.length, 0);
    const openSlots = data.boxes
      .filter((b) => b.status === "open")
      .reduce((sum, b) => sum + freeSlots(b), 0);
    return [
      { label: "待鉴定 / 待复核", value: pending },
      { label: "已上柜", value: shelved },
      { label: "在途交换", value: transit },
      { label: "可补空位 / 采集点", value: `${openSlots} 位 · ${localities} 点` },
    ];
  }, [data]);

  const activeTab = route.name === "detail" ? "queue" : route.name;

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <p>hxyfront-62007 · Port 62007</p>
          <h1>植物标本馆入库 · 复份交换装箱台</h1>
          <span>入库队列、柜位与详情页读同一份浏览器数据，重开浏览器仍可继续处理。</span>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={activeTab === t.key ? "tab active" : "tab"}
              onClick={() => store.navigate(t.route)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      {route.name === "queue" && <QueuePage />}
      {route.name === "cabinet" && <CabinetPage />}
      {route.name === "localities" && <LocalitiesPage />}
      {route.name === "packing" && <PackingPage />}
      {route.name === "detail" && <DetailPage id={route.id} />}

      <footer className="footer">
        <span>数据仅保存在本机浏览器 localStorage（hxyfront-62007-herbarium-v1）。</span>
        <button
          className="reset-btn"
          onClick={() => {
            if (window.confirm("将清空当前浏览器数据并恢复演示标本，确定继续吗？")) store.resetAll();
          }}
        >
          恢复演示数据
        </button>
      </footer>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </main>
  );
}

export default App;

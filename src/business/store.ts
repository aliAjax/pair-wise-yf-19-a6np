// 业务文件三：界面状态
// 基于业务文件一（资料存取）与业务文件二（装箱判定），维护 React 界面状态：
// 当前页签、入库筛选、选中的箱、操作结果提示，以及全部带业务校验的动作。

import { useSyncExternalStore } from "react";
import {
  buildSeedData,
  loadState,
  resetState,
  saveState,
  type AppData,
  type Determination,
  type ExchangeBox,
  type Specimen,
  type StoredState,
} from "./storage";
import {
  boxAddCheck,
  DEFAULT_CAPACITY,
  freeSlots,
  INSTITUTIONS,
  isFull,
} from "./packing";

export type Route =
  | { name: "queue" }
  | { name: "cabinet" }
  | { name: "localities" }
  | { name: "packing" }
  | { name: "detail"; id: string };

export interface Toast {
  key: number;
  kind: "ok" | "error";
  text: string;
}

export interface NewSpecimenInput {
  collectionNo: string;
  species: string;
  locality: string;
  elevation: string;
  habitat: string;
  collectors: string;
}

interface State {
  data: StoredState;
  route: Route;
  toast: Toast | null;
}

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash.startsWith("specimen/")) {
    return { name: "detail", id: hash.slice("specimen/".length) };
  }
  switch (hash) {
    case "cabinet":
      return { name: "cabinet" };
    case "localities":
      return { name: "localities" };
    case "packing":
      return { name: "packing" };
    default:
      return { name: "queue" };
  }
}

function toHash(route: Route): string {
  switch (route.name) {
    case "cabinet":
      return "#/cabinet";
    case "localities":
      return "#/localities";
    case "packing":
      return "#/packing";
    case "detail":
      return `#/specimen/${route.id}`;
    default:
      return "#/";
  }
}

class AppStore {
  private state: State;
  private listeners = new Set<() => void>();
  private toastSeq = 0;

  constructor() {
    this.state = { data: loadState(), route: parseHash(), toast: null };
    window.addEventListener("hashchange", () => {
      this.state = { ...this.state, route: parseHash() };
      this.emit();
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private getSnapshot = (): State => this.state;

  useState(): State {
    return useSyncExternalStore(this.subscribe, this.getSnapshot);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private commit(data: StoredState, persist = true) {
    this.state = { ...this.state, data };
    if (persist) saveState(data);
    this.emit();
  }

  private notify(kind: Toast["kind"], text: string) {
    this.toastSeq += 1;
    this.state = { ...this.state, toast: { key: this.toastSeq, kind, text } };
    this.emit();
    window.setTimeout(() => {
      if (this.state.toast?.key === this.toastSeq) {
        this.state = { ...this.state, toast: null };
        this.emit();
      }
    }, 2800);
  }

  private ok(text: string) {
    this.notify("ok", text);
  }

  private fail(text: string) {
    this.notify("error", text);
  }

  // ---------- 路由 ----------

  navigate(route: Route) {
    if (toHash(route) !== window.location.hash) window.location.hash = toHash(route);
    else this.state = { ...this.state, route };
    this.emit();
  }

  setQueueFilter(filter: string) {
    this.commit({ ...this.state.data, queueFilter: filter });
  }

  selectBox(id: string) {
    this.commit({ ...this.state.data, selectedBoxId: id });
  }

  // ---------- 入库队列 ----------

  addSpecimen(input: NewSpecimenInput): boolean {
    if (!input.collectionNo.trim()) {
      this.fail("采集号必填，否则无法判定复份");
      return false;
    }
    const d = this.state.data;
    const seq =
      d.specimens.reduce((max, s) => {
        const n = Number(s.id.replace(/^s/, ""));
        return Number.isFinite(n) ? Math.max(max, n) : max;
      }, 0) + 1;
    const now = Date.now();
    const specimen: Specimen = {
      id: `s${String(seq).padStart(2, "0")}`,
      collectionNo: input.collectionNo.trim(),
      species: input.species.trim() || "待定名",
      locality: input.locality.trim(),
      elevation: input.elevation.trim(),
      habitat: input.habitat.trim(),
      collectors: input.collectors.trim(),
      pressed: false,
      determination: "pending",
      shelved: false,
      cabinetPosition: "",
      boxId: null,
      archived: false,
      createdAt: now,
      log: [{ at: now, text: "进入入库队列，待压制" }],
    };
    this.commit({ ...d, specimens: [specimen, ...d.specimens] });
    this.ok(`标本 ${specimen.collectionNo} 已进入入库队列`);
    return true;
  }

  private updateSpecimen(id: string, patch: Partial<Specimen>, note: string) {
    const d = this.state.data;
    const specimens = d.specimens.map((s) =>
      s.id === id
        ? { ...s, ...patch, log: [...s.log, { at: Date.now(), text: note }] }
        : s
    );
    this.commit({ ...d, specimens });
  }

  setPressed(id: string, pressed: boolean) {
    this.updateSpecimen(id, { pressed }, pressed ? "压制完成，待鉴定" : "退回重新压制");
  }

  setDetermination(id: string, determination: Determination) {
    const s = this.state.data.specimens.find((x) => x.id === id);
    if (!s) return;
    if (s.boxId) {
      this.fail("在交换箱内的标本须先退回，不能改鉴定状态");
      return;
    }
    const patch: Partial<Specimen> = { determination };
    // 退回待复核意味着暂时离柜；重新鉴定接受后需再次上柜
    if (determination !== "accepted") patch.shelved = false;
    const label =
      determination === "accepted"
        ? "鉴定接受，可安排上柜"
        : determination === "review"
        ? "标记为待复核"
        : "改回待鉴定";
    this.updateSpecimen(id, patch, label);
  }

  shelveSpecimen(id: string, position: string): boolean {
    const s = this.state.data.specimens.find((x) => x.id === id);
    if (!s) return false;
    if (s.determination !== "accepted") {
      this.fail("仅鉴定接受的标本可以上柜");
      return false;
    }
    if (!position.trim()) {
      this.fail("请填写馆藏柜位");
      return false;
    }
    this.updateSpecimen(id, { shelved: true, cabinetPosition: position.trim() }, `上柜 ${position.trim()}`);
    this.ok(`${s.collectionNo} 已上柜`);
    return true;
  }

  // ---------- 装箱台 ----------

  createBox(institution: string, capacity: number): string {
    const d = this.state.data;
    const cap = Math.max(1, Math.min(30, Math.floor(capacity) || DEFAULT_CAPACITY));
    const seq = d.boxes.filter((b) => b.institution === institution).length + 1;
    const prefix = institution.match(/（([A-Z]+)）/)?.[1] ?? "BOX";
    const id = `BX-${prefix}-${String(seq).padStart(2, "0")}`;
    const box: ExchangeBox = {
      id,
      institution,
      capacity: cap,
      status: "open",
      itemIds: [],
      cycles: [],
      createdAt: Date.now(),
      sealedAt: null,
      sentAt: null,
    };
    this.commit({ ...d, boxes: [box, ...d.boxes], selectedBoxId: id });
    this.ok(`已为「${institution}」建立空箱 ${id}（容量 ${cap} 份）`);
    return id;
  }

  addToBox(boxId: string, specimenId: string) {
    const d = this.state.data;
    const box = d.boxes.find((b) => b.id === boxId);
    const specimen = d.specimens.find((s) => s.id === specimenId);
    if (!box || !specimen) return;
    const reason = boxAddCheck(box, specimen, d.specimens);
    if (reason) {
      this.fail(`${specimen.collectionNo} 未入箱：${reason}`);
      return;
    }
    const nextBox: ExchangeBox = { ...box, itemIds: [...box.itemIds, specimen.id] };
    const becameFull = isFull(nextBox);
    if (becameFull) {
      nextBox.status = "sealed";
      nextBox.sealedAt = Date.now();
    }
    const boxes = d.boxes.map((b) => (b.id === box.id ? nextBox : b));
    const specimens = d.specimens.map((s) =>
      s.id === specimen.id
        ? {
            ...s,
            boxId: box.id,
            log: [...s.log, { at: Date.now(), text: `装入交换箱 ${box.id}（${box.institution}）` }],
          }
        : s
    );
    this.commit({ ...d, boxes, specimens });
    this.ok(
      becameFull
        ? `${specimen.collectionNo} 已入箱，箱满 ${box.capacity}/${box.capacity}，自动封存`
        : `${specimen.collectionNo} 已入箱，余位 ${freeSlots(nextBox)}`
    );
  }

  removeFromBox(boxId: string, specimenId: string) {
    const d = this.state.data;
    const box = d.boxes.find((b) => b.id === boxId);
    if (!box || box.status !== "open") {
      this.fail("已封存或在途的箱子不能取出标本");
      return;
    }
    const specimen = d.specimens.find((s) => s.id === specimenId);
    if (!specimen) return;
    const boxes = d.boxes.map((b) =>
      b.id === box.id ? { ...b, itemIds: b.itemIds.filter((id) => id !== specimen.id) } : b
    );
    const specimens = d.specimens.map((s) =>
      s.id === specimen.id
        ? { ...s, boxId: null, log: [...s.log, { at: Date.now(), text: `从交换箱 ${box.id} 取出` }] }
        : s
    );
    this.commit({ ...d, boxes, specimens });
    this.ok(`已从 ${box.id} 取出 ${specimen.collectionNo}，空位可补别的标本`);
  }

  sealBox(boxId: string) {
    const d = this.state.data;
    const box = d.boxes.find((b) => b.id === boxId);
    if (!box) return;
    if (box.status !== "open") {
      this.fail("只有装箱中的箱子可以封存");
      return;
    }
    if (!isFull(box)) {
      this.fail(`箱未满（${box.itemIds.length}/${box.capacity}），不能封存`);
      return;
    }
    const boxes = d.boxes.map((b) =>
      b.id === box.id ? { ...b, status: "sealed" as const, sealedAt: Date.now() } : b
    );
    this.commit({ ...d, boxes });
    this.ok(`箱子 ${box.id} 已封存，可寄出`);
  }

  sendBox(boxId: string) {
    const d = this.state.data;
    const box = d.boxes.find((b) => b.id === boxId);
    if (!box) return;
    if (box.status !== "sealed") {
      this.fail("只有已封存的箱子可以寄出");
      return;
    }
    const boxes = d.boxes.map((b) =>
      b.id === box.id ? { ...b, status: "in_transit" as const, sentAt: Date.now() } : b
    );
    const specimens = d.specimens.map((s) =>
      s.boxId === box.id
        ? { ...s, log: [...s.log, { at: Date.now(), text: `随 ${box.id} 寄出，在途交换中` }] }
        : s
    );
    this.commit({ ...d, boxes, specimens });
    this.ok(`${box.id} 已寄往「${box.institution}」，进入在途交换`);
  }

  /**
   * 收到退回：
   * - 被外馆接受的标本：继续留档（archived），不再参与装箱；
   * - 被退回的标本：回到待复核、暂离柜位；
   * - 箱子清空回到装箱中，空位可补别的标本，历次结果留在周期记录里。
   */
  receiveBox(boxId: string, acceptedIds: string[], returnedIds: string[]) {
    const d = this.state.data;
    const box = d.boxes.find((b) => b.id === boxId);
    if (!box) return;
    if (box.status !== "in_transit") {
      this.fail("只有在途的箱子能登记退回结果");
      return;
    }
    if (acceptedIds.length + returnedIds.length !== box.itemIds.length) {
      this.fail("请为箱内每份标本登记：接受留档或退回");
      return;
    }
    const now = Date.now();
    const accepted = box.itemIds
      .filter((id) => acceptedIds.includes(id))
      .map((id) => {
        const s = d.specimens.find((x) => x.id === id)!;
        return { specimenId: s.id, collectionNo: s.collectionNo, species: s.species };
      });
    const returned = box.itemIds
      .filter((id) => returnedIds.includes(id))
      .map((id) => {
        const s = d.specimens.find((x) => x.id === id)!;
        return { specimenId: s.id, collectionNo: s.collectionNo, species: s.species };
      });

    const specimens = d.specimens.map((s) => {
      if (s.boxId !== box.id) return s;
      if (acceptedIds.includes(s.id)) {
        return {
          ...s,
          boxId: null,
          archived: true,
          log: [...s.log, { at: now, text: "外馆接受，继续留档" }],
        };
      }
      return {
        ...s,
        boxId: null,
        determination: "review" as Determination,
        shelved: false,
        log: [...s.log, { at: now, text: "外馆退回，回到待复核" }],
      };
    });

    const boxes = d.boxes.map((b) =>
      b.id === box.id
        ? {
            ...b,
            status: "open" as const,
            itemIds: [],
            sealedAt: null,
            sentAt: null,
            cycles: [...b.cycles, { endedAt: now, accepted, returned }],
          }
        : b
    );

    this.commit({ ...d, boxes, specimens });
    this.ok(
      `${box.id} 退回登记完成：留档 ${accepted.length} 份，退回复核 ${returned.length} 份，空位可补装`
    );
  }

  resetAll() {
    const data = resetState();
    this.state = { ...this.state, data, route: { name: "queue" } };
    window.location.hash = "#/";
    this.emit();
    this.ok("已恢复演示数据");
  }

  /** 供界面直接读取的常量 */
  institutions(): string[] {
    return INSTITUTIONS;
  }
}

export const store = new AppStore();

/** 供非组件代码快速取用当前数据（详情页、柜位、队列读同一份） */
export function currentData(): AppData {
  return store["state"].data;
}

// 供种子在首次访问时即落盘，保证"重开还能处理"
if (typeof window !== "undefined" && !window.localStorage.getItem("hxyfront-62007-herbarium-v1")) {
  saveState(buildSeedData());
}

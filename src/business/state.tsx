// 业务文件三：界面状态
// React 界面只通过这里的 dispatch 修改数据；reducer 调用装箱判定规则，
// 并通过 store 层把同一份数据写回浏览器，刷新 / 重开浏览器后状态保留。

import { useEffect, useMemo, useReducer, type Dispatch } from "react";
import {
  BOX_CAPACITY,
  createSeedData,
  loadData,
  saveData,
  type AppData,
  type ExchangeBox,
  type IdStatus,
  type LogEntry,
  type Specimen,
  type SpecimenInput,
} from "./store";
import {
  canPack,
  canSeal,
  findBox,
  findSpecimen,
  isFull,
  nextFreeCabinet,
  processReturn,
} from "./packing";

function nowText(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pushLog(target: { log: LogEntry[] }, text: string): void {
  target.log.push({ at: nowText(), text });
}

function clone(data: AppData): AppData {
  return structuredClone(data);
}

export type Action =
  | { type: "add-specimen"; input: SpecimenInput }
  | { type: "set-pressed"; id: string; pressed: boolean }
  | { type: "set-id-status"; id: string; status: IdStatus }
  | { type: "shelve"; id: string; cabinet: string }
  | { type: "unshelve"; id: string }
  | { type: "pack"; boxId: string; specimenId: string }
  | { type: "unpack"; boxId: string; specimenId: string }
  | { type: "seal-box"; boxId: string }
  | { type: "new-box"; institutionCode: string }
  | { type: "process-return"; boxId: string; returnedIds: string[] }
  | { type: "reset" };

export interface ActionError {
  message: string;
}

function reducer(data: AppData, action: Action): AppData {
  switch (action.type) {
    case "add-specimen": {
      const next = clone(data);
      next.seq += 1;
      const id = `S${String(next.seq).padStart(3, "0")}`;
      const specimen: Specimen = {
        id,
        collectionNo: action.input.collectionNo.trim(),
        species: action.input.species.trim() || "待定名",
        location: action.input.location.trim(),
        altitude: action.input.altitude.trim(),
        habitat: action.input.habitat.trim(),
        collector: action.input.collector.trim(),
        pressed: action.input.pressed,
        idStatus: "pending",
        stage: "queue",
        cabinet: null,
        boxId: null,
        archivedBoxId: null,
        institutionCode: null,
        createdAt: nowText(),
        log: [{ at: nowText(), text: "采集登记进入入库队列" }],
      };
      next.specimens.unshift(specimen);
      return next;
    }

    case "set-pressed": {
      const next = clone(data);
      const s = findSpecimen(next, action.id);
      if (!s) return data;
      s.pressed = action.pressed;
      pushLog(s, action.pressed ? "压制完成，转鉴定" : "退回重新压制");
      return next;
    }

    case "set-id-status": {
      const next = clone(data);
      const s = findSpecimen(next, action.id);
      if (!s) return data;
      s.idStatus = action.status;
      if (action.status === "accepted" && s.stage === "returned") {
        // 退回件复核通过：仍需重新上柜，保持 queue
        s.stage = "queue";
        pushLog(s, "复核鉴定接受，等待重新上柜");
      } else if (action.status === "pending") {
        pushLog(s, "鉴定状态置为待鉴定");
      } else if (action.status === "doubted") {
        pushLog(s, "标记存疑待定");
      } else {
        pushLog(s, "鉴定接受");
      }
      return next;
    }

    case "shelve": {
      const next = clone(data);
      const s = findSpecimen(next, action.id);
      if (!s || s.stage === "archived") return data;
      const occupied = next.specimens.some(
        (other) => other.id !== s.id && other.cabinet === action.cabinet,
      );
      if (occupied) return data;
      s.cabinet = action.cabinet;
      if (s.stage === "queue" || s.stage === "returned") s.stage = "cabinet";
      pushLog(s, `上柜，柜位 ${action.cabinet}`);
      return next;
    }

    case "unshelve": {
      const next = clone(data);
      const s = findSpecimen(next, action.id);
      if (!s || s.boxId || s.archivedBoxId) return data;
      s.cabinet = null;
      s.stage = "queue";
      pushLog(s, "撤下柜位，回到入库队列");
      return next;
    }

    case "pack": {
      if (canPack(data, action.specimenId, action.boxId)) return data;
      const next = clone(data);
      const box = findBox(next, action.boxId);
      const s = findSpecimen(next, action.specimenId);
      if (!box || !s) return data;

      // 若原来在别的开箱中，先从那个箱移除
      if (s.boxId && s.boxId !== box.id) {
        const oldBox = findBox(next, s.boxId);
        if (oldBox) {
          oldBox.itemIds = oldBox.itemIds.filter((id) => id !== s.id);
          pushLog(oldBox, `${s.collectionNo} 调箱移出`);
        }
      }
      if (!box.itemIds.includes(s.id)) box.itemIds.push(s.id);
      s.boxId = box.id;
      s.stage = "cabinet";
      pushLog(s, `装入交换箱 ${box.id}（${box.institutionCode}）`);
      pushLog(box, `入箱：${s.collectionNo} ${s.species}`);
      return next;
    }

    case "unpack": {
      const next = clone(data);
      const box = findBox(next, action.boxId);
      const s = findSpecimen(next, action.specimenId);
      if (!box || !s || box.status === "sealed") return data;
      box.itemIds = box.itemIds.filter((id) => id !== s.id);
      s.boxId = null;
      pushLog(s, `从交换箱 ${box.id} 移出，保留柜位 ${s.cabinet ?? "无"}`);
      pushLog(box, `移出：${s.collectionNo}`);
      return next;
    }

    case "seal-box": {
      const next = clone(data);
      const box = findBox(next, action.boxId);
      if (!box || canSeal(box).ok === false) return data;
      box.status = "sealed";
      box.sealedAt = nowText();
      pushLog(box, "箱满封存，进入在途交换");
      for (const id of box.itemIds) {
        const s = findSpecimen(next, id);
        if (s) pushLog(s, `随 ${box.id} 封存发往 ${box.institutionCode}，在途交换中`);
      }
      return next;
    }

    case "new-box": {
      const next = clone(data);
      const count = next.boxes.filter((b) => b.institutionCode === action.institutionCode).length;
      const id = `B-${action.institutionCode}-${String(count + 1).padStart(3, "0")}`;
      if (next.boxes.some((b) => b.id === id)) return data;
      const box: ExchangeBox = {
        id,
        institutionCode: action.institutionCode,
        capacity: BOX_CAPACITY,
        status: "open",
        itemIds: [],
        archivedIds: [],
        sealedAt: null,
        log: [{ at: nowText(), text: `建箱，按外馆 ${action.institutionCode} 分开装箱` }],
      };
      next.boxes.push(box);
      return next;
    }

    case "process-return": {
      const next = clone(data);
      const box = findBox(next, action.boxId);
      if (!box || box.status !== "sealed") return data;
      const result = processReturn(next, action.boxId, action.returnedIds);
      pushLog(box, `收到退回：${result.returned.length} 份回到待复核，${result.accepted.length} 份外馆接受留档，空槽可补装`);
      for (const id of result.returned) {
        const s = findSpecimen(next, id);
        if (s) pushLog(s, `外馆退回，回到待复核（原箱 ${box.id}）`);
      }
      for (const id of result.accepted) {
        const s = findSpecimen(next, id);
        if (s) pushLog(s, `外馆验收接受，${box.institutionCode} 留档`);
      }
      return next;
    }

    case "reset":
      return createSeedData();

    default:
      return data;
  }
}

export function useAppData(): {
  data: AppData;
  dispatch: Dispatch<Action>;
} {
  const [data, dispatch] = useReducer(reducer, undefined, loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  return useMemo(() => ({ data, dispatch }), [data]);
}

// 给界面层复用的小工具
export { findBox, findSpecimen, isFull, nextFreeCabinet };

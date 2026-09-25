// 业务文件二：装箱判定
// 纯规则模块：能不能入箱、能否封存、收到退回如何处理、空槽还有多少。
// 不读写 localStorage，不依赖 React，方便单独核对业务口径。

import { buildCabinetGrid } from "./store";
import type { AppData, ExchangeBox, IdStatus, Specimen } from "./store";

export type RejectReason =
  | "id-status" // 鉴定未接受
  | "not-cabinet" // 未上柜
  | "in-transit" // 在已封存（在途交换）箱中
  | "already-other-box" // 已放进别的箱
  | "duplicate-no" // 同一采集号该箱已有一份
  | "archived-no" // 同一采集号该馆已留档
  | "box-sealed" // 目标箱已封存
  | "box-full"; // 目标箱已满

export interface Rejection {
  specimenId: string;
  reasons: RejectReason[];
}

const REASON_TEXT: Record<RejectReason, string> = {
  "id-status": "鉴定状态不是「接受」",
  "not-cabinet": "尚未上柜（无柜位）",
  "in-transit": "该份正在在途交换箱中",
  "already-other-box": "该份已放进别的箱",
  "duplicate-no": "同一采集号本箱只能留一份",
  "archived-no": "同一采集号该馆已留档一份",
  "box-sealed": "该箱已封存",
  "box-full": "该箱已满",
};

export function reasonText(reason: RejectReason): string {
  return REASON_TEXT[reason];
}

export function findBox(data: AppData, boxId: string): ExchangeBox | undefined {
  return data.boxes.find((box) => box.id === boxId);
}

export function findSpecimen(data: AppData, specimenId: string): Specimen | undefined {
  return data.specimens.find((specimen) => specimen.id === specimenId);
}

// 已被外馆接受留档的份数不算箱内占位
export function activeCount(box: ExchangeBox): number {
  return box.itemIds.length;
}

export function freeSlots(box: ExchangeBox): number {
  return Math.max(0, box.capacity - box.itemIds.length);
}

export function isFull(box: ExchangeBox): boolean {
  return box.itemIds.length >= box.capacity;
}

export function isInTransit(box: ExchangeBox): boolean {
  return box.status === "sealed";
}

// 当前在馆、可参与装箱的标本
export function isAtHome(specimen: Specimen): boolean {
  return specimen.stage === "cabinet" && specimen.archivedBoxId === null;
}

// 鉴定接受 + 已上柜 + 不在在途交换箱 + 没放进别的箱 + 同采集号本馆唯一 + 本馆未留档
export function canPack(data: AppData, specimenId: string, boxId: string): Rejection | null {
  const specimen = findSpecimen(data, specimenId);
  const box = findBox(data, boxId);
  if (!specimen || !box) return { specimenId, reasons: ["box-sealed"] };

  const reasons: RejectReason[] = [];

  if (specimen.idStatus !== "accepted") reasons.push("id-status");
  if (specimen.stage !== "cabinet" || !specimen.cabinet) reasons.push("not-cabinet");
  if (specimen.archivedBoxId !== null) reasons.push("archived-no");

  if (specimen.boxId) {
    const currentBox = findBox(data, specimen.boxId);
    if (currentBox && currentBox.id !== boxId) {
      reasons.push(isInTransit(currentBox) ? "in-transit" : "already-other-box");
    }
  }

  if (isInTransit(box)) {
    reasons.push("box-sealed");
  }

  const sameNoInBox = box.itemIds.some((id) => {
    if (id === specimen.id) return false;
    const other = findSpecimen(data, id);
    return other?.collectionNo === specimen.collectionNo;
  });
  if (sameNoInBox) reasons.push("duplicate-no");

  const sameNoArchived = box.archivedIds.some((id) => {
    const other = findSpecimen(data, id);
    return other?.collectionNo === specimen.collectionNo;
  });
  if (sameNoArchived) reasons.push("archived-no");

  if (isFull(box) && specimen.boxId !== box.id) reasons.push("box-full");

  return reasons.length ? { specimenId, reasons } : null;
}

// 装箱台候选：只列在馆且鉴定接受的上柜标本；重复采集号只取一份
export interface Candidate {
  specimen: Specimen;
  rejection: Rejection | null;
  pickable: boolean;
}

export function listCandidates(data: AppData, boxId: string): Candidate[] {
  const box = findBox(data, boxId);
  if (!box) return [];

  const seenNos = new Set<string>();
  const candidates: Candidate[] = [];

  for (const specimen of data.specimens) {
    if (!isAtHome(specimen)) continue;
    if (specimen.idStatus !== "accepted") continue;
    if (seenNos.has(specimen.collectionNo)) continue;
    seenNos.add(specimen.collectionNo);

    const rejection = canPack(data, specimen.id, boxId);
    candidates.push({
      specimen,
      rejection,
      pickable: rejection === null,
    });
  }
  return candidates;
}

// 各馆装箱概览，供装箱台侧栏使用
export interface BoxSummary {
  box: ExchangeBox;
  institutionName: string;
  used: number;
  free: number;
  full: boolean;
}

export function listBoxes(data: AppData): BoxSummary[] {
  return data.boxes
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((box) => ({
      box,
      institutionName: data.institutions.find((ins) => ins.code === box.institutionCode)?.name ?? box.institutionCode,
      used: activeCount(box),
      free: freeSlots(box),
      full: isFull(box),
    }));
}

// 能否封存：箱必须满
export function canSeal(box: ExchangeBox): { ok: boolean; reason?: string } {
  if (box.status === "sealed") return { ok: false, reason: "该箱已封存" };
  if (!isFull(box)) return { ok: false, reason: `还差 ${freeSlots(box)} 份才能封存` };
  return { ok: true };
}

// 处理退回：选中的份回到待复核并腾出柜位；其余视为外馆接受、继续留档；
// 箱转为装箱中，空出的槽位可补别的标本。
export interface ReturnResult {
  returned: string[];
  accepted: string[];
}

export function processReturn(
  data: AppData,
  boxId: string,
  returnedIds: string[],
): ReturnResult {
  const box = findBox(data, boxId);
  if (!box) return { returned: [], accepted: [] };

  const returned = returnedIds.filter((id) => box.itemIds.includes(id));
  const accepted = box.itemIds.filter((id) => !returnedIds.includes(id));

  for (const id of returned) {
    const specimen = findSpecimen(data, id);
    if (!specimen) continue;
    specimen.stage = "returned";
    specimen.idStatus = "pending"; // 回到待复核
    specimen.cabinet = null;
    specimen.boxId = null;
    specimen.institutionCode = null;
  }
  for (const id of accepted) {
    const specimen = findSpecimen(data, id);
    if (!specimen) continue;
    specimen.stage = "archived";
    specimen.boxId = null;
    specimen.archivedBoxId = box.id;
    specimen.institutionCode = box.institutionCode;
    specimen.cabinet = null;
  }

  box.itemIds = [];
  box.archivedIds = [...box.archivedIds, ...accepted];
  box.status = "open";
  box.sealedAt = null;

  return { returned, accepted };
}

// 入库队列筛选
export type QueueFilter =
  | "all"
  | "pending-press"
  | "pending-id"
  | "shelved"
  | "in-box"
  | "in-transit"
  | "returned"
  | "archived"
  | "doubted";

export const QUEUE_FILTERS: { key: QueueFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending-press", label: "待压制" },
  { key: "pending-id", label: "待鉴定" },
  { key: "doubted", label: "存疑待定" },
  { key: "shelved", label: "已上柜" },
  { key: "in-box", label: "装箱中" },
  { key: "in-transit", label: "在途交换" },
  { key: "returned", label: "退回待复核" },
  { key: "archived", label: "外馆留档" },
];

export function matchFilter(
  data: AppData,
  specimen: Specimen,
  filter: QueueFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "pending-press":
      return !specimen.pressed;
    case "pending-id":
      return specimen.idStatus === "pending" && specimen.stage !== "returned";
    case "doubted":
      return specimen.idStatus === "doubted";
    case "shelved":
      return specimen.stage === "cabinet" && !specimen.boxId && specimen.archivedBoxId === null;
    case "in-box":
      return specimen.stage === "cabinet" && !!specimen.boxId &&
        data.boxes.find((b) => b.id === specimen.boxId)?.status === "open";
    case "in-transit":
      return specimen.stage === "cabinet" && !!specimen.boxId &&
        data.boxes.find((b) => b.id === specimen.boxId)?.status === "sealed";
    case "returned":
      return specimen.stage === "returned";
    case "archived":
      return specimen.stage === "archived";
    default:
      return true;
  }
}

export const ID_STATUS_TEXT: Record<IdStatus, string> = {
  pending: "待鉴定",
  accepted: "鉴定接受",
  doubted: "存疑待定",
};

// 综合状态徽标
export function stageLabel(data: AppData, specimen: Specimen): string {
  if (specimen.stage === "returned") return "退回待复核";
  if (specimen.stage === "archived") return "外馆留档";
  if (specimen.stage === "queue") {
    if (!specimen.pressed) return "待压制";
    if (specimen.idStatus === "pending") return "待鉴定";
    if (specimen.idStatus === "doubted") return "存疑待定";
    return "待上柜";
  }
  const box = specimen.boxId ? findBox(data, specimen.boxId) : undefined;
  if (box?.status === "sealed") return "在途交换";
  if (box?.status === "open") return "装箱中";
  return "已上柜";
}

// 下一个空柜位
export function nextFreeCabinet(data: AppData): string | null {
  const occupied = new Set(
    data.specimens.filter((s) => s.cabinet).map((s) => s.cabinet as string),
  );
  return buildCabinetGrid().find((cell) => !occupied.has(cell)) ?? null;
}

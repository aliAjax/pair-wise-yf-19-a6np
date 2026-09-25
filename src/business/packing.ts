// 业务文件二：装箱判定
// 纯业务规则，不碰界面与存储。所有"能不能入箱 / 能否封存 / 退回怎么算"都集中在这里，
// 取代纸单排箱时"未上柜、放进别的箱也能误装"的人工漏洞。

import type { Determination, ExchangeBox, Specimen } from "./storage";

export const INSTITUTIONS = [
  "昆明植物研究所标本馆（KUN）",
  "华南植物园标本馆（IBSC）",
  "江苏省中国科学院植物研究所标本馆（NAS）",
  "北京植物研究所标本馆（PE）",
];

export const DEFAULT_CAPACITY = 6;

export const DETERMINATION_LABEL: Record<Determination, string> = {
  pending: "待鉴定",
  accepted: "鉴定接受",
  review: "待复核",
};

export const BOX_STATUS_LABEL = {
  open: "装箱中",
  sealed: "已封存",
  in_transit: "在途交换",
} as const;

/** 标本层面：是否允许进入交换箱；返回 null 表示通过，否则给出拦截原因 */
export function specimenBlocker(s: Specimen): string | null {
  if (s.archived) return "已被外馆接受留档，不再参与交换";
  if (s.determination !== "accepted")
    return `仅鉴定接受的标本可入箱（当前：${DETERMINATION_LABEL[s.determination]}）`;
  if (!s.shelved || !s.cabinetPosition) return "标本尚未上柜，禁止装箱";
  if (s.boxId) return "已装入交换箱（在途或未封存），不能重复入箱";
  return null;
}

/** 箱子层面：把标本放进指定箱还要通过的检查 */
export function boxAddCheck(
  box: ExchangeBox,
  specimen: Specimen,
  allSpecimens: Specimen[]
): string | null {
  const own = specimenBlocker(specimen);
  if (own) return own;
  if (box.status !== "open") return "箱子已封存或已寄出，不能再装";
  if (box.itemIds.includes(specimen.id)) return "该标本已在此箱中";
  if (box.itemIds.length >= box.capacity) return "箱已满，需先封存或等待退回空位";
  // 同一采集号（复份）在同一外馆的箱中只留一份
  const duplicate = box.itemIds
    .map((id) => allSpecimens.find((x) => x.id === id))
    .find((x) => x && x.collectionNo === specimen.collectionNo);
  if (duplicate) return `同采集号 ${specimen.collectionNo} 已在本箱，复份请分送其他外馆`;
  return null;
}

export function isFull(box: ExchangeBox): boolean {
  return box.itemIds.length >= box.capacity;
}

/** 可补装的空位；封存箱/在途箱不补 */
export function freeSlots(box: ExchangeBox): number {
  if (box.status !== "open") return 0;
  return Math.max(0, box.capacity - box.itemIds.length);
}

export interface PackableGroup {
  key: string;
  species: string;
  specimens: Specimen[];
}

/**
 * 可入箱候选清单：仅保留通过标本层面检查的标本。
 * 同一采集号分组展示，方便工作人员为复份挑选不同外馆。
 */
export function packableCandidates(specimens: Specimen[]): PackableGroup[] {
  const groups = new Map<string, Specimen[]>();
  for (const s of specimens) {
    if (specimenBlocker(s)) continue;
    const list = groups.get(s.collectionNo) ?? [];
    list.push(s);
    groups.set(s.collectionNo, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      species: list[0]?.species ?? "",
      specimens: [...list].sort((a, b) => a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => a.key.localeCompare(b.key, "zh-Hans-CN"));
}

export function findSpecimen(
  specimens: Specimen[],
  id: string | null
): Specimen | undefined {
  if (!id) return undefined;
  return specimens.find((s) => s.id === id);
}

export function boxOf(specimen: Specimen, boxes: ExchangeBox[]): ExchangeBox | undefined {
  return specimen.boxId ? boxes.find((b) => b.id === specimen.boxId) : undefined;
}

// 业务文件一：资料存取
// 负责标本、交换箱的数据结构、浏览器持久化（localStorage）与初始种子数据。
// 入库队列、馆藏柜位、标本详情页、装箱台都只读这一份数据，重开浏览器后仍可继续处理。

export type Determination = "pending" | "accepted" | "review";
// pending 待鉴定 / accepted 鉴定接受 / review 待复核（外馆退回后回到此状态）

export interface SpecimenLog {
  at: number;
  text: string;
}

export interface Specimen {
  id: string;
  /** 采集号；同一采集号的多份即复份 */
  collectionNo: string;
  species: string;
  locality: string;
  elevation: string;
  habitat: string;
  collectors: string;
  pressed: boolean;
  determination: Determination;
  /** 是否已上柜（实体进入馆藏柜位） */
  shelved: boolean;
  cabinetPosition: string;
  /** 当前所在的交换箱；在途或已装箱未封存期间都不允许再进别的箱 */
  boxId: string | null;
  /** 已被外馆接受，继续留档（不再参与装箱） */
  archived: boolean;
  createdAt: number;
  log: SpecimenLog[];
}

export type BoxStatus = "open" | "sealed" | "in_transit";
// open 装箱中（箱未满 / 退件后空位复装）/ sealed 箱满封存 / in_transit 已寄出在途

export interface BoxCycleSheet {
  specimenId: string;
  collectionNo: string;
  species: string;
}

/** 一轮外馆核退结果：接受的留档，退回的回到待复核 */
export interface BoxCycle {
  endedAt: number;
  accepted: BoxCycleSheet[];
  returned: BoxCycleSheet[];
}

export interface ExchangeBox {
  id: string;
  /** 外馆（收箱单位），箱子按外馆分开 */
  institution: string;
  capacity: number;
  status: BoxStatus;
  /** 本轮箱内标本 */
  itemIds: string[];
  /** 历次外馆接受留档记录 */
  cycles: BoxCycle[];
  createdAt: number;
  sealedAt: number | null;
  sentAt: number | null;
}

export interface AppData {
  version: 1;
  specimens: Specimen[];
  boxes: ExchangeBox[];
}

/** 需要跨重开保留的界面状态也存在同一份浏览器数据里 */
export interface StoredState extends AppData {
  queueFilter: string;
  selectedBoxId: string | null;
}

const STORAGE_KEY = "hxyfront-62007-herbarium-v1";

const BASE_TIME = new Date("2026-09-01T09:00:00+08:00").getTime();

export function buildSeedData(): StoredState {
  let seq = 0;
  const at = (offsetMin: number) => BASE_TIME + offsetMin * 60_000;

  function sheet(init: {
    no: string;
    species: string;
    locality: string;
    elevation: string;
    habitat: string;
    collectors: string;
    pressed?: boolean;
    determination?: Determination;
    shelved?: boolean;
    cabinet?: string;
    archived?: boolean;
    offset: number;
    log?: string[];
  }): Specimen {
    seq += 1;
    const id = `s${String(seq).padStart(2, "0")}`;
    return {
      id,
      collectionNo: init.no,
      species: init.species,
      locality: init.locality,
      elevation: init.elevation,
      habitat: init.habitat,
      collectors: init.collectors,
      pressed: init.pressed ?? true,
      determination: init.determination ?? "pending",
      shelved: init.shelved ?? false,
      cabinetPosition: init.cabinet ?? "",
      boxId: null,
      archived: init.archived ?? false,
      createdAt: at(init.offset),
      log: (init.log ?? []).map((text, i) => ({ at: at(init.offset + i), text })),
    };
  }

  const L1 = {
    locality: "湖北神农架 阴湿沟谷",
    elevation: "1420 m",
    habitat: "溪旁腐殖土，伴生苔藓与蕨类",
    collectors: "陈又生、李敏",
  };
  const L2 = {
    locality: "云南玉龙雪山 高山灌丛",
    elevation: "3180 m",
    habitat: "杜鹃灌丛边缘砾石地",
    collectors: "周繇、阿力",
  };
  const L3 = {
    locality: "浙江天目山 常绿阔叶林",
    elevation: "680 m",
    habitat: "林缘半阴坡，黄壤",
    collectors: "沈海洛、吴帆",
  };

  const specimens: Specimen[] = [
    // HX-240615-01 同一采集号三份复份
    sheet({ ...L1, no: "HX-240615-01", species: "阔叶槭（待定）", offset: 0, determination: "accepted", shelved: true, cabinet: "B-12-04", log: ["采集压制入库", "鉴定接受", "上柜 B-12-04"] }),
    sheet({ ...L1, no: "HX-240615-01", species: "阔叶槭（待定）", offset: 1, determination: "accepted", shelved: true, cabinet: "B-12-05", log: ["采集压制入库", "鉴定接受", "上柜 B-12-05"] }),
    sheet({ ...L1, no: "HX-240615-01", species: "阔叶槭（待定）", offset: 2, pressed: true, determination: "pending", log: ["采集压制入库", "排队等待鉴定"] }),
    // HX-240615-08 两份
    sheet({ ...L1, no: "HX-240615-08", species: "对马耳蕨", offset: 10, determination: "accepted", shelved: true, cabinet: "C-03-11", log: ["鉴定接受", "上柜 C-03-11"] }),
    sheet({ ...L1, no: "HX-240615-08", species: "对马耳蕨", offset: 11, determination: "review", log: ["鉴定存疑，转待复核"] }),
    // HX-240702-03 两份：一份已上柜，一份鉴定接受但未上柜
    sheet({ ...L2, no: "HX-240702-03", species: "黏毛香青", offset: 20, determination: "accepted", shelved: true, cabinet: "C-03-12", log: ["鉴定接受", "上柜 C-03-12"] }),
    sheet({ ...L2, no: "HX-240702-03", species: "黏毛香青", offset: 21, determination: "accepted", cabinet: "", log: ["鉴定接受，等待安排柜位"] }),
    sheet({ ...L2, no: "HX-240702-07", species: "岩白菜", offset: 22, pressed: true, determination: "pending", log: ["已压制，排队等待鉴定"] }),
    // HX-240810-02 / 09
    sheet({ ...L2, no: "HX-240810-02", species: "锈红杜鹃", offset: 30, determination: "accepted", shelved: true, cabinet: "A-05-02", log: ["鉴定接受", "上柜 A-05-02"] }),
    sheet({ ...L2, no: "HX-240810-09", species: "绵毛杜鹃", offset: 31, determination: "accepted", shelved: true, cabinet: "A-05-03", log: ["鉴定接受", "上柜 A-05-03"] }),
    // HX-240901-04 两份
    sheet({ ...L3, no: "HX-240901-04", species: "紫楠", offset: 40, determination: "accepted", shelved: true, cabinet: "D-01-08", log: ["鉴定接受", "上柜 D-01-08"] }),
    sheet({ ...L3, no: "HX-240901-04", species: "紫楠", offset: 41, determination: "accepted", shelved: true, cabinet: "D-01-09", log: ["鉴定接受", "上柜 D-01-09"] }),
    // 已上柜的合格交换复份（与箱内标本同采集号，用于演示每馆一份）
    sheet({ ...L2, no: "HX-240810-02", species: "锈红杜鹃", offset: 32, determination: "accepted", shelved: true, cabinet: "A-05-04", log: ["鉴定接受", "上柜 A-05-04"] }),
    sheet({ ...L2, no: "HX-240810-09", species: "绵毛杜鹃", offset: 33, determination: "accepted", shelved: true, cabinet: "A-05-05", log: ["鉴定接受", "上柜 A-05-05"] }),
    sheet({ ...L2, no: "HX-240718-09", species: "黄花杓兰", offset: 34, determination: "accepted", shelved: true, cabinet: "C-07-01", log: ["鉴定接受", "上柜 C-07-01"] }),
    sheet({ ...L3, no: "HX-240718-15", species: "黄花鹤顶兰", offset: 35, determination: "accepted", shelved: true, cabinet: "C-07-02", log: ["鉴定接受", "上柜 C-07-02"] }),
    // HX-240910-02 两份复份
    sheet({ ...L2, no: "HX-240910-02", species: "云南大百合", offset: 45, determination: "accepted", shelved: true, cabinet: "D-02-03", log: ["鉴定接受", "上柜 D-02-03"] }),
    sheet({ ...L2, no: "HX-240910-02", species: "云南大百合", offset: 46, determination: "accepted", shelved: true, cabinet: "D-02-04", log: ["鉴定接受", "上柜 D-02-04"] }),
    sheet({ ...L3, no: "HX-250312-06", species: "南方红豆杉", offset: 50, pressed: false, determination: "pending", log: ["进入入库队列，待压制"] }),
    // 上一轮交换：一份被外馆接受留档，一份退回后回到待复核
    sheet({ ...L3, no: "HX-240520-05", species: "天目木姜子", offset: -200, determination: "accepted", shelved: true, cabinet: "", archived: true, log: ["上柜后随箱寄往 KUN", "外馆接受，留档"] }),
    sheet({ ...L3, no: "HX-240520-11", species: "浙赣车前", offset: -199, determination: "review", log: ["随箱寄往 KUN", "外馆退回，回到待复核"] }),
  ];

  const byNo = Object.fromEntries(specimens.map((s) => [s.id, s]));

  const boxes: ExchangeBox[] = [
    {
      id: "BX-KUN-01",
      institution: "昆明植物研究所标本馆（KUN）",
      capacity: 3,
      status: "in_transit",
      itemIds: ["s01", "s10", "s11"],
      cycles: [
        {
          endedAt: at(-180),
          accepted: [{ specimenId: "s20", collectionNo: byNo.s20.collectionNo, species: byNo.s20.species }],
          returned: [{ specimenId: "s21", collectionNo: byNo.s21.collectionNo, species: byNo.s21.species }],
        },
      ],
      createdAt: at(-260),
      sealedAt: at(-250),
      sentAt: at(-240),
    },
    {
      id: "BX-IBSC-01",
      institution: "华南植物园标本馆（IBSC）",
      capacity: 6,
      status: "open",
      itemIds: ["s09"],
      cycles: [],
      createdAt: at(-60),
      sealedAt: null,
      sentAt: null,
    },
  ];

  // 箱内标本的 boxId 与箱记录保持一致，避免纸面单据式的错装
  for (const box of boxes) {
    for (const id of box.itemIds) byNo[id].boxId = box.id;
  }

  return {
    version: 1,
    specimens,
    boxes,
    queueFilter: "全部",
    selectedBoxId: "BX-IBSC-01",
  };
}

export function loadState(): StoredState {
  if (typeof window === "undefined") return buildSeedData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildSeedData();
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.specimens) || !Array.isArray(parsed.boxes)) {
      return buildSeedData();
    }
    return {
      version: 1,
      specimens: parsed.specimens as Specimen[],
      boxes: parsed.boxes as ExchangeBox[],
      queueFilter: typeof parsed.queueFilter === "string" ? parsed.queueFilter : "全部",
      selectedBoxId: typeof parsed.selectedBoxId === "string" ? parsed.selectedBoxId : null,
    };
  } catch {
    return buildSeedData();
  }
}

export function saveState(state: StoredState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 浏览器存储不可用时仅影响跨重开，当前会话仍可继续
  }
}

export function resetState(): StoredState {
  const seed = buildSeedData();
  saveState(seed);
  return seed;
}

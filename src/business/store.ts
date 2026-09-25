// 业务文件一：资料存取
// 负责标本 / 交换箱 / 外馆的数据结构、浏览器持久化（localStorage）与种子数据。
// 入库队列、柜位、装箱台、详情页全部读写这里导出的同一份数据。

export type IdStatus = "pending" | "accepted" | "doubted";
// pending：待鉴定 / 待复核；accepted：鉴定接受；doubted：存疑待定

export type SpecimenStage = "queue" | "cabinet" | "returned" | "archived";
// queue：入库流程中；cabinet：已上柜（含已装入箱）；returned：外馆退回待复核；archived：外馆留档

export interface LogEntry {
  at: string;
  text: string;
}

export interface Specimen {
  id: string;
  collectionNo: string; // 采集号
  species: string; // 物种名称
  location: string; // 采集地点
  altitude: string; // 海拔
  habitat: string; // 生境描述
  collector: string; // 采集人
  pressed: boolean; // 压制状态
  idStatus: IdStatus; // 鉴定状态
  stage: SpecimenStage;
  cabinet: string | null; // 馆藏柜位
  boxId: string | null; // 当前所在交换箱
  archivedBoxId: string | null; // 留档交换箱（被外馆接受后）
  institutionCode: string | null; // 留档外馆
  createdAt: string;
  log: LogEntry[];
}

export interface ExchangeBox {
  id: string; // 箱号，如 B-PE-001
  institutionCode: string; // 按外馆分开装箱
  capacity: number; // 箱满份数
  status: "open" | "sealed"; // 装箱中 / 已封存（在途交换）
  itemIds: string[]; // 当前在箱标本
  archivedIds: string[]; // 该馆已接受留档的标本（继续留档，不退）
  sealedAt: string | null;
  log: LogEntry[];
}

export interface Institution {
  code: string;
  name: string;
}

export interface AppData {
  version: number;
  seq: number; // 标本编号自增
  institutions: Institution[];
  specimens: Specimen[];
  boxes: ExchangeBox[];
}

export interface SpecimenInput {
  collectionNo: string;
  species: string;
  location: string;
  altitude: string;
  habitat: string;
  collector: string;
  pressed: boolean;
}

export const STORAGE_KEY = "herbarium-exchange-packing-v1";
export const BOX_CAPACITY = 12;

// ---- 柜位表：A-D 柜 × 01-06 排 × 01-04 层 ----
export const CABINET_LETTERS = ["A", "B", "C", "D"];

export function buildCabinetGrid(): string[] {
  const cells: string[] = [];
  for (const letter of CABINET_LETTERS) {
    for (let row = 1; row <= 6; row += 1) {
      for (let shelf = 1; shelf <= 4; shelf += 1) {
        cells.push(`${letter}-${String(row).padStart(2, "0")}-${String(shelf).padStart(2, "0")}`);
      }
    }
  }
  return cells;
}

// ---- 种子数据 ----
type SeedRow = [
  no: string,
  species: string,
  pressed: boolean,
  idStatus: IdStatus,
  stage: SpecimenStage,
  cabinet: string | "auto" | null,
  boxId?: string,
];

interface SeedGroup {
  location: string;
  altitude: string;
  habitat: string;
  collector: string;
  rows: SeedRow[];
}

const GROUPS: SeedGroup[] = [
  {
    location: "浙江天目山国家级自然保护区",
    altitude: "1180 m",
    habitat: "落叶阔叶林下，溪谷旁阴湿处",
    collector: "刘启富",
    rows: [
      ["HX-250418-02", "天目槭（待定名）", false, "pending", "queue", null],
      ["HX-250418-07", "鳞毛蕨属 sp.", true, "pending", "queue", null],
      ["HX-250418-11", "水杉", true, "accepted", "queue", null], // 鉴定接受但未上柜
      ["HX-250418-14", "膀胱蕨", true, "accepted", "cabinet", "auto"],
      ["HX-250418-19", "银缕梅", true, "accepted", "cabinet", "auto"],
      ["HX-250418-23", "天目铁木", true, "accepted", "cabinet", "auto"],
      ["HX-250418-25", "六角莲", true, "accepted", "cabinet", "auto"],
      ["HX-250418-30", "华榛", true, "accepted", "cabinet", "auto"],
      ["HX-250418-33", "白豆杉", true, "accepted", "cabinet", "auto"],
      ["HX-250418-36", "青檀", true, "accepted", "cabinet", "auto"],
      ["HX-241102-08", "华南五针松", true, "accepted", "cabinet", "auto"], // 与 IBSC 留档件同采集号
      ["HX-241102-21", "吊钟花", true, "pending", "returned", null], // 退回待复核
    ],
  },
  {
    location: "湖北神农架国家公园",
    altitude: "1760 m",
    habitat: "山地针阔混交林林缘",
    collector: "周静远",
    rows: [
      ["HX-240915-01", "水青树", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-02", "连香树", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-03", "珙桐", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-04", "鹅掌楸", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-05", "巴东木莲", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-06", "白辛树", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-07", "银鹊树", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-08", "紫茎", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-09", "领春木", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-10", "青檀", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-11", "瘿椒树", true, "accepted", "cabinet", "auto", "B-PE-001"],
      ["HX-240915-12", "金钱槭", true, "accepted", "cabinet", "auto", "B-PE-001"],
    ],
  },
  {
    location: "云南云龙天池国家级自然保护区",
    altitude: "2520 m",
    habitat: "云南松林下缓坡",
    collector: "曾宪峰",
    rows: [
      ["HX-241008-01", "滇山茶", true, "accepted", "cabinet", "auto", "B-KUN-001"],
      ["HX-241008-02", "高山栲", true, "accepted", "cabinet", "auto", "B-KUN-001"],
      ["HX-241008-03", "云南松", true, "accepted", "cabinet", "auto", "B-KUN-001"],
      ["HX-241008-04", "华山松", true, "accepted", "cabinet", "auto", "B-KUN-001"],
      ["HX-241008-05", "干香柏", true, "accepted", "cabinet", "auto", "B-KUN-001"],
      ["HX-241008-06", "云南含笑", true, "accepted", "cabinet", "auto", "B-KUN-001"],
      ["HX-241008-07", "红花木莲", true, "accepted", "cabinet", "auto", "B-KUN-001"],
      ["HX-241008-08", "滇润楠", true, "accepted", "cabinet", "auto", "B-KUN-001"],
      ["HX-241008-09", "高原鸢尾", true, "accepted", "cabinet", "auto", "B-KUN-001"],
      ["HX-241008-10", "瓣鳞花", true, "accepted", "cabinet", "auto", "B-KUN-001"],
      ["HX-241008-11", "梳帽卷瓣兰", true, "accepted", "cabinet", "auto", "B-KUN-001"],
    ],
  },
  {
    location: "广东南岭国家级自然保护区",
    altitude: "960 m",
    habitat: "沟谷常绿阔叶林，岩石坡地",
    collector: "林晓岚",
    rows: [
      ["HX-241102-08", "华南五针松", true, "accepted", "archived", null, "B-IBSC-001"],
      ["HX-241102-09", "长苞铁杉", true, "accepted", "archived", null, "B-IBSC-001"],
      ["HX-241102-10", "观光木", true, "accepted", "archived", null, "B-IBSC-001"],
      ["HX-241102-11", "两广椴", true, "accepted", "archived", null, "B-IBSC-001"],
      ["HX-241102-12", "华南锥", true, "accepted", "archived", null, "B-IBSC-001"],
      ["HX-241102-13", "坡垒", true, "accepted", "cabinet", "auto", "B-IBSC-001"],
      ["HX-241102-14", "青梅", true, "accepted", "cabinet", "auto", "B-IBSC-001"],
      ["HX-241102-15", "蛛毛苣苔", true, "accepted", "cabinet", "auto", "B-IBSC-001"],
      ["HX-241102-16", "报春苣苔", true, "accepted", "cabinet", "auto", "B-IBSC-001"],
      ["HX-241102-17", "丹霞兰", true, "accepted", "cabinet", "auto", "B-IBSC-001"],
      ["HX-241102-18", "厚叶木莲", true, "accepted", "cabinet", "auto", "B-IBSC-001"],
    ],
  },
];

const INSTITUTIONS: Institution[] = [
  { code: "PE", name: "中国科学院植物研究所标本馆（北京）" },
  { code: "KUN", name: "中国科学院昆明植物研究所标本馆" },
  { code: "IBSC", name: "中国科学院华南植物园标本馆" },
];

function buildSeed(): AppData {
  const grid = buildCabinetGrid();
  let cursor = 0;
  const specimens: Specimen[] = [];
  const boxItemMap = new Map<string, string[]>();
  const boxArchivedMap = new Map<string, string[]>();

  GROUPS.forEach((group, gi) => {
    group.rows.forEach((row, ri) => {
      const [no, species, pressed, idStatus, stage, cabinetReq, boxId] = row;
      const seq = specimens.length + 1;
      const id = `S${String(seq).padStart(3, "0")}`;
      const cabinet = cabinetReq === "auto" ? grid[cursor++] : cabinetReq;
      const createdAt = `2025-0${gi + 1}-${String(10 + ri).padStart(2, "0")} 09:${String(20 + ri).padStart(2, "0")}`;

      const log: LogEntry[] = [{ at: createdAt, text: `采集登记入库，采集人 ${group.collector}` }];
      if (pressed) log.push({ at: createdAt, text: "压制完成，转鉴定" });
      if (idStatus === "accepted") log.push({ at: createdAt, text: "鉴定接受，定名：" + species });
      if (idStatus === "doubted") log.push({ at: createdAt, text: "鉴定存疑，标记待复核" });
      if (cabinet) log.push({ at: createdAt, text: `上柜，柜位 ${cabinet}` });

      const specimen: Specimen = {
        id,
        collectionNo: no,
        species,
        location: group.location,
        altitude: group.altitude,
        habitat: group.habitat,
        collector: group.collector,
        pressed,
        idStatus,
        stage,
        cabinet,
        boxId: stage === "archived" ? null : boxId ?? null,
        archivedBoxId: stage === "archived" ? boxId ?? null : null,
        institutionCode: stage === "archived" ? boxId?.split("-")[1] ?? null : null,
        createdAt,
        log,
      };

      if (boxId && stage !== "archived") {
        boxItemMap.set(boxId, [...(boxItemMap.get(boxId) ?? []), id]);
      }
      if (boxId && stage === "archived") {
        boxArchivedMap.set(boxId, [...(boxArchivedMap.get(boxId) ?? []), id]);
        specimen.log.push({ at: createdAt, text: "复份经外馆验收接受，外馆留档" });
      }
      if (stage === "returned") {
        specimen.log.push({ at: "2025-06-02 14:05", text: "外馆退回原件，回到待复核队列，柜位待重新分配" });
      }
      specimens.push(specimen);
    });
  });

  const mkBox = (
    id: string,
    code: string,
    status: "open" | "sealed",
    sealedAt: string | null,
  ): ExchangeBox => ({
    id,
    institutionCode: code,
    capacity: BOX_CAPACITY,
    status,
    itemIds: boxItemMap.get(id) ?? [],
    archivedIds: boxArchivedMap.get(id) ?? [],
    sealedAt,
    log:
      status === "sealed"
        ? [
            { at: "2025-05-20 10:00", text: `建箱，发往 ${code}` },
            { at: "2025-05-22 16:30", text: "箱满封存，进入在途交换" },
          ]
        : [{ at: "2025-05-24 11:00", text: `建箱，发往 ${code}` }],
  });

  const boxes = [
    mkBox("B-PE-001", "PE", "sealed", "2025-05-22 16:30"),
    mkBox("B-KUN-001", "KUN", "open", null),
    mkBox("B-IBSC-001", "IBSC", "open", null),
  ];

  return {
    version: 1,
    seq: specimens.length,
    institutions: INSTITUTIONS,
    specimens,
    boxes,
  };
}

export function loadData(): AppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (Array.isArray(parsed.specimens) && Array.isArray(parsed.boxes)) {
        return parsed;
      }
    }
  } catch {
    // 数据损坏时回落到种子数据
  }
  return buildSeed();
}

export function saveData(data: AppData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 存储不可用时静默降级，当前会话仍可操作
  }
}

export function clearStoredData(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function createSeedData(): AppData {
  return buildSeed();
}

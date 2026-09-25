// 规则冒烟测试：Node 下运行（构建脚本用 esbuild 打包，运行时注入 window/localStorage 桩）。
import assert from "node:assert";
import { resetState } from "../src/business/storage";
import { boxAddCheck, packableCandidates, specimenBlocker } from "../src/business/packing";
import { store } from "../src/business/store";

store["state"].data = resetState();
const data = () => store["state"].data;
const find = (id: string) => data().specimens.find((s) => s.id === id)!;
const box = (id: string) => data().boxes.find((b) => b.id === id)!;

// 种子实况（buildSeedData 顺序即 ID）：
// s01..s03  HX-240615-01（s01 在 KUN 在途；s02 合格；s03 待鉴定）
// s04..s05  HX-240615-08（s04 合格；s05 待复核）
// s06..s08  HX-240702-03（s06 合格；s07 鉴定接受但未上柜；s08 待鉴定）
// s09       HX-240810-02（锈红杜鹃），在 IBSC
// s10       HX-240810-09（绵毛杜鹃），在 KUN 在途
// s11..s12  HX-240901-04（s11 在 KUN 在途；s12 合格，同号复份）
// s13       合格（锈红杜鹃，与 s09 同号复份）
// s14       合格（绵毛杜鹃，与 s10 同号复份）
// s15       合格（黄花杓兰）
// s16       合格（黄花鹤顶兰）
// s17..s18  HX-240910-02 两份合格复份
// s19 待压制待鉴定；s20 已留档；s21 退回待复核

// 1. 标本层面拦截
assert.ok(specimenBlocker(find("s01"))?.includes("已装入交换箱"), "在途标本不可再入箱");
assert.ok(specimenBlocker(find("s03"))?.includes("待鉴定"), "待鉴定不可入箱");
assert.ok(specimenBlocker(find("s05"))?.includes("待复核"), "待复核不可入箱");
assert.ok(specimenBlocker(find("s07"))?.includes("尚未上柜"), "未上柜不可入箱");
assert.ok(specimenBlocker(find("s19"))?.includes("待鉴定"), "未压制待鉴定不可入箱");
assert.ok(specimenBlocker(find("s20"))?.includes("留档"), "已留档不可入箱");
assert.equal(specimenBlocker(find("s02")), null, "鉴定接受+已上柜+不在箱可入箱");

// 2. 合法补装入 IBSC（初始含 s09）
assert.deepEqual(box("BX-IBSC-01").itemIds, ["s09"]);
assert.equal(boxAddCheck(box("BX-IBSC-01"), find("s04"), data().specimens), null);
store.addToBox("BX-IBSC-01", "s04");
assert.deepEqual(box("BX-IBSC-01").itemIds, ["s09", "s04"]);

// 3. 同一采集号在同一箱中只留一份：s13 与箱内 s09 同为 HX-240810-02，被拒
assert.ok(boxAddCheck(box("BX-IBSC-01"), find("s13"), data().specimens)?.includes("同采集号"));
// 但复份可以去"另一个外馆"的新箱
store.createBox("北京植物研究所标本馆（PE）", 6);
assert.equal(boxAddCheck(box("BX-PE-01"), find("s13"), data().specimens), null);

// 4. 未装满不能封存
store.sealBox("BX-IBSC-01");
assert.equal(box("BX-IBSC-01").status, "open", "箱未满不能封存");

// 5. 装满 IBSC（容量 6，当前 2 份），第 6 份触发自动封存
const fillOrder = ["s02", "s06", "s12", "s14"];
for (const id of fillOrder) {
  const cur = box("BX-IBSC-01");
  if (cur.status !== "open" || cur.itemIds.length >= cur.capacity) break;
  const reason = boxAddCheck(cur, find(id), data().specimens);
  assert.equal(reason, null, `${id} 应能补装`);
  store.addToBox("BX-IBSC-01", id);
}
assert.equal(box("BX-IBSC-01").status, "sealed", "装满自动封存");
assert.equal(box("BX-IBSC-01").itemIds.length, 6);
assert.ok(boxAddCheck(box("BX-IBSC-01"), find("s16"), data().specimens)?.includes("已封存"));

// 6. 封存但未寄出：不能登记退回、不能取件
store.receiveBox("BX-IBSC-01", [], box("BX-IBSC-01").itemIds);
assert.equal(box("BX-IBSC-01").status, "sealed");
store.removeFromBox("BX-IBSC-01", "s04");
assert.equal(box("BX-IBSC-01").status, "sealed", "封存箱不能取出");
store.sendBox("BX-IBSC-01");
assert.equal(box("BX-IBSC-01").status, "in_transit");

// 7. KUN 在途箱登记"全部退回"：回到待复核、暂离柜；箱清空可补装
const returning = ["s01", "s10", "s11"];
store.receiveBox("BX-KUN-01", [], returning);
assert.equal(box("BX-KUN-01").status, "open");
assert.deepEqual(box("BX-KUN-01").itemIds, []);
assert.equal(box("BX-KUN-01").cycles.length, 2, "追加一轮周期记录");
for (const id of returning) {
  const s = find(id);
  assert.equal(s.determination, "review", "退回标本回到待复核");
  assert.equal(s.shelved, false, "退回标本暂离柜位");
  assert.equal(s.boxId, null);
}

// 8. 空 KUN 箱补装别的标本（3 份不同采集号），封存寄出，再"部分接受部分退回"
for (const id of ["s15", "s16", "s17"]) {
  const reason = boxAddCheck(box("BX-KUN-01"), find(id), data().specimens);
  assert.equal(reason, null, `${id} 应可补入空 KUN 箱`);
  store.addToBox("BX-KUN-01", id);
}
assert.equal(box("BX-KUN-01").status, "sealed", "补满自动封存");
store.sendBox("BX-KUN-01");
const [acceptedId, ...rest] = box("BX-KUN-01").itemIds;
store.receiveBox("BX-KUN-01", [acceptedId], rest);
assert.equal(find(acceptedId).archived, true, "被外馆接受者继续留档");
assert.equal(find(acceptedId).boxId, null);
for (const id of rest) {
  assert.equal(find(id).determination, "review", "被退回者回到待复核");
  assert.equal(find(id).shelved, false);
}
assert.equal(box("BX-KUN-01").status, "open");
assert.equal(box("BX-KUN-01").itemIds.length, 0, "空出的箱位可再补别的标本");

// 9. 退回后的同号复份（如 s19 若被退回）不能直接再装：须重新鉴定接受并上柜
const someReturned = rest[0];
assert.notEqual(specimenBlocker(find(someReturned)), null, "退回待复核标本不能立即再入箱");

// 10. 候选清单永远不含不合格标本
const candidateIds = new Set(
  packableCandidates(data().specimens).flatMap((g) => g.specimens.map((s) => s.id))
);
for (const bad of ["s01", "s03", "s05", "s07", "s19", "s20", acceptedId, someReturned]) {
  assert.ok(!candidateIds.has(bad), `${bad} 不应出现在可入箱候选中`);
}

console.log("全部装箱规则冒烟测试通过 ✔");

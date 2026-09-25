// Node 规则测试运行器：esbuild 打包 TS 入口，运行前注入 window/localStorage 桩。
const esbuild = require("esbuild");
const path = require("path");

const stub = `
globalThis.window = {
  localStorage: {
    __m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.__m, k) ? this.__m[k] : null; },
    setItem(k, v) { this.__m[k] = String(v); },
    removeItem(k) { delete this.__m[k]; },
  },
  addEventListener() {},
  location: { hash: "" },
  setTimeout: (...a) => globalThis.setTimeout(...a),
};
`;

esbuild
  .build({
    entryPoints: [path.join(__dirname, "check-rules.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    banner: { js: stub },
  })
  .then((r) => {
    const code = r.outputFiles[0].text;
    // eslint-disable-next-line no-new-func
    new Function("require", "module", "exports", code)(require, module, exports);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

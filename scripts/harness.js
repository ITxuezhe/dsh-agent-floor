#!/usr/bin/env node
/**
 * harness.js — 无需 DSH / 浏览器的客户端自检。
 *
 * 桩掉 window.__ModuleLoader__、React、document 等宿主环境，真的加载 ../client.js，
 * 走一遍 apply() 的注册链路，然后把注册出来的组件（FloorDock）和场景组件（IsoFloor）
 * 各渲染一次。任何一步抛错都以 exit 1 结束并打印堆栈。
 *
 * 用法：
 *   node scripts/harness.js                 # 默认检查 ../client.js
 *   node scripts/harness.js path/to/x.js    # 检查别的构建产物
 *
 * 成功输出末行固定为 `render ok`。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const target = path.resolve(process.argv[2] || path.join(HERE, '..', 'client.js'));

function fail(err) {
  const stack = err && err.stack ? err.stack : String(err);
  console.error(stack);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 最小 React 运行时：支持 createElement / useState / useRef / useEffect。
// 只渲染一遍（setState 是空实现），足够验证组件在真实数据形状下不炸。
// ---------------------------------------------------------------------------
const effects = [];
let activeInstance = null;

function currentInstance(hookName) {
  if (!activeInstance) throw new Error(hookName + ' called outside a component render');
  return activeInstance;
}

const React = {
  createElement(tag, props, ...kids) { return { tag, props: props || {}, kids }; },
  useState(initial) {
    const inst = currentInstance('useState');
    const i = inst.cursor++;
    if (!(i in inst.slots)) inst.slots[i] = typeof initial === 'function' ? initial() : initial;
    return [inst.slots[i], () => {}];
  },
  useRef(value) {
    const inst = currentInstance('useRef');
    const i = inst.cursor++;
    if (!(i in inst.slots)) inst.slots[i] = { current: value };
    return inst.slots[i];
  },
  useEffect(fn) {
    const inst = currentInstance('useEffect');
    inst.cursor += 1;
    effects.push(fn);
  },
};

function renderNode(node) {
  if (node === null || node === undefined || node === false || node === true) return [];
  if (typeof node === 'string' || typeof node === 'number') return [{ text: String(node) }];
  if (Array.isArray(node)) {
    const out = [];
    for (const item of node) out.push(...renderNode(item));
    return out;
  }
  const { tag, props, kids } = node;
  if (typeof tag === 'function') {
    const inst = { slots: [], cursor: 0 };
    const prev = activeInstance;
    activeInstance = inst;
    let rendered;
    try { rendered = tag(props || {}); } finally { activeInstance = prev; }
    return renderNode(rendered);
  }
  const children = [];
  for (const kid of kids || []) children.push(...renderNode(kid));
  return [{ tag, props: props || {}, children }];
}

function countNodes(nodes) {
  let n = 0;
  for (const node of nodes) {
    n += 1;
    if (node.children) n += countNodes(node.children);
  }
  return n;
}

function findTag(nodes, tag) {
  for (const node of nodes) {
    if (node.tag === tag) return node;
    if (node.children) {
      const hit = findTag(node.children, tag);
      if (hit) return hit;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 宿主环境桩
// ---------------------------------------------------------------------------
function createStubs() {
  const storage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  const win = {
    __ModuleLoader__: { load(mod) { captured = mod; } },
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    innerWidth: 1440,
    innerHeight: 900,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const doc = {
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    documentElement: {},
    getElementById: () => null,
    createElement: () => ({ style: {}, set id(v) {}, set textContent(v) {} }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const fakeFetch = () => Promise.resolve({
    ok: false,
    status: 503,
    json: () => Promise.resolve({}),
  });
  return { win, doc, storage, fakeFetch };
}

let captured = null;

function main() {
  const { win, doc, storage, fakeFetch } = createStubs();

  if (!fs.existsSync(target)) throw new Error('client file not found: ' + target);
  let src = fs.readFileSync(target, 'utf8');

  // 只在内存里改写导出语句，把内部组件暴露给自检；不落盘。
  const EXPORT_RE = /return\s*\{\s*inject\s*,\s*apply\s*\};/;
  if (!EXPORT_RE.test(src)) {
    throw new Error('client.js: 找不到 `return { inject, apply };` —— 导出结构变了？请同步更新 scripts/harness.js / render.js 的 EXPORT_RE。');
  }
  src = src.replace(EXPORT_RE,
    'return { inject, apply, __dshTest: { IsoFloor: IsoFloor, deriveAgents: deriveAgents, FloorDock: FloorDock } };');

  const factoryFn = new Function(
    'window', 'document', 'localStorage', 'fetch', 'console', '__filename', '__dirname', src,
  );
  factoryFn(win, doc, storage, fakeFetch, console, target, path.dirname(target));

  if (!captured || typeof captured.factory !== 'function') {
    throw new Error('client.js 没有调用 window.__ModuleLoader__.load({ factory })');
  }
  const mod = captured.factory((name) => {
    if (name === 'react' || name === 'React') return React;
    throw new Error('unexpected require("' + name + '") — harness 只桩了 react');
  });

  // 1) 走一遍 apply()：验证 inject 链路会注册 shell.overlay 组件。
  const registered = [];
  const ready = {
    effect: (fn) => fn(),
    slots: {
      inject: (name, cb) => { if (typeof cb === 'function') return cb(); return undefined; },
      register: (spec, render) => { registered.push({ spec: spec || {}, render }); return spec; },
    },
  };
  const ctx = {
    inject: (deps, cb) => cb(ready),
    get: () => null,
    effect: (fn) => fn(),
    slots: ready.slots,
  };
  if (typeof mod.apply !== 'function') throw new Error('模块没有导出 apply()');
  mod.apply(ctx);
  if (!registered.length) throw new Error('apply() 没有注册任何组件到 shell.overlay');
  const entry = registered[registered.length - 1];
  if (typeof entry.render !== 'function') throw new Error('slots.register 的 render 不是函数');

  // 2) 真的把注册出来的组件渲染一次。
  const tree = renderNode(React.createElement(entry.render, {}));
  if (!tree.length) throw new Error('FloorDock 渲染结果为空');
  const rootTag = tree[0].tag;
  if (typeof rootTag !== 'string') throw new Error('FloorDock 顶层不是 DOM 标签: ' + String(rootTag));
  if (!tree[0].props.className || String(tree[0].props.className).indexOf('fg-') !== 0) {
    throw new Error('FloorDock 顶层缺少 fg-* className: ' + JSON.stringify(tree[0].props.className));
  }
  const dockNodes = countNodes(tree);

  // 3) 用 5 个假 agent 渲染 IsoFloor（满屏场景），确保场景层也能画出来。
  const test = mod.__dshTest;
  if (!test || typeof test.IsoFloor !== 'function' || typeof test.deriveAgents !== 'function') {
    throw new Error('client.js 没有暴露 __dshTest（导出语句可能又被改了）');
  }
  const now = Date.now();
  const sessions = [
    { id: 's1', title: 'MY', running: true, step: 10, turn: 2, toolCalls: 68, tokensIn: 90000, tokensOut: 30000, lastTool: { name: 'bash', target: 'pnpm run build' }, files: [{ name: 'client.js', write: true }], updatedAt: now },
    { id: 's2', title: 'dsh-skill-pilot', running: false, step: 1, turn: 1, toolCalls: 41, tokensIn: 20000, tokensOut: 2000, updatedAt: now - 120000 },
    { id: 's3', title: 'Mnemon · Idle review', running: false, step: 3, turn: 1, toolCalls: 3, updatedAt: now - 3 * 600000 },
    { id: 's4', title: '执行一条 bash 命令：sleep 25', running: false, step: 1, turn: 1, toolCalls: 1, updatedAt: now - 4 * 600000 },
    { id: 's5', title: '子代理 · token-econ', running: true, parent: 's1', step: 4, turn: 1, toolCalls: 12, tokensIn: 5000, tokensOut: 900, lastTool: { name: 'grep', target: 'token' }, files: [{ name: 'index.js', write: false }], updatedAt: now },
  ];
  const ordered = test.deriveAgents({ sessions });
  if (ordered.length !== 5) throw new Error('deriveAgents 期望 5 个 agent，实际 ' + ordered.length);
  if (ordered.filter((o) => o.depth === 1).length !== 1) throw new Error('deriveAgents 没把子代理排成 depth 1');

  const COLS = 4;
  const seats = ordered.map((o, i) => ({ agent: o.agent, row: Math.floor(i / COLS), col: i % COLS }));
  const isoTree = renderNode(React.createElement(test.IsoFloor, { seats, onOpen: () => {} }));
  if (!isoTree.length || isoTree[0].tag !== 'svg') throw new Error('IsoFloor 顶层不是 svg');
  const isoNodes = countNodes(isoTree);
  if (isoNodes < 40) throw new Error('IsoFloor 只渲染出 ' + isoNodes + ' 个节点，像是空场景');

  // 4) 跑一次 effect（useFloor 会发起一次假 fetch），确认轮询逻辑不炸。
  for (const fn of effects) {
    const cleanup = fn();
    if (typeof cleanup === 'function') cleanup();
  }

  console.log('  client : ' + target);
  console.log('  dock   : <' + rootTag + ' class="' + tree[0].props.className + '"> (' + dockNodes + ' nodes)');
  console.log('  iso    : <svg> (' + isoNodes + ' nodes, ' + ordered.length + ' agents)');
  console.log('  effects: ' + effects.length + ' 个已执行');
  console.log('render ok');
}

try {
  main();
} catch (err) {
  fail(err);
}

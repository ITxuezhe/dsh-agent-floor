#!/usr/bin/env node
/**
 * harness.js — 无需 DSH / 浏览器的客户端自检。
 *
 * 桩掉 window.__ModuleLoader__、React、document 等宿主环境，真的加载 ../client.js，
 * 走一遍 apply() 的注册链路，然后把注册出来的监控条（MonitorBar）真渲染一次，
 * 再用假会话验证 deriveAgents 的分组与排序。任何一步抛错都以 exit 1 结束并打印堆栈。
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
  const store = { 'dsh.agent-floor.open': '1' };
  const storage = {
    getItem: (k) => (k in store ? store[k] : null),
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
  if (src.indexOf('__dshTest') < 0) {
    const EXPORT_RE = /return\s*\{\s*inject\s*,\s*apply\s*\};/;
    if (!EXPORT_RE.test(src)) {
      throw new Error('client.js: 既没有 __dshTest，也找不到 `return { inject, apply };` —— 导出结构变了？');
    }
    src = src.replace(EXPORT_RE,
      'return { inject, apply, __dshTest: { deriveAgents: deriveAgents, FloorChip: FloorChip, FloorPanel: FloorPanel, MonitorRow: MonitorRow, store: store } };');
  }

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
  const bySlot = (name) => registered.find((r) => r.spec && r.spec.name === name);
  const chip = bySlot('sidebar.footer.action');
  const panel = bySlot('shell.overlay');
  if (!chip) throw new Error('apply() 没有把 chip 注册到 sidebar.footer.action');
  if (!panel) throw new Error('apply() 没有把 panel 注册到 shell.overlay');
  if (typeof chip.render !== 'function' || typeof panel.render !== 'function') {
    throw new Error('slots.register 的 render 不是函数');
  }

  // 2) 真的把注册出来的 chip 渲染一次。
  const tree = renderNode(React.createElement(chip.render, {}));
  if (!tree.length) throw new Error('FloorChip 渲染结果为空');
  const rootTag = tree[0].tag;
  if (typeof rootTag !== 'string') throw new Error('FloorChip 顶层不是 DOM 标签: ' + String(rootTag));
  if (!tree[0].props.className || String(tree[0].props.className).indexOf('fg-') !== 0) {
    throw new Error('FloorChip 顶层缺少 fg-* className: ' + JSON.stringify(tree[0].props.className));
  }
  const chipNodes = countNodes(tree);
  const chipButton = findTag(tree, 'button');
  if (!chipButton) throw new Error('FloorChip 没有渲染出 button（点不了）');

  // 3) 用 5 个假 agent 验证分组，再渲染面板。
  const test = mod.__dshTest;
  if (!test || typeof test.FloorPanel !== 'function' || typeof test.deriveAgents !== 'function') {
    throw new Error('client.js 没有暴露 __dshTest.FloorPanel / deriveAgents');
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

  test.store.open = true;
  test.store.data = { sessions };
  const chipOn = renderNode(React.createElement(chip.render, {}));
  const panelTree = renderNode(React.createElement(panel.render, {}));
  if (!panelTree.length) throw new Error('FloorPanel 打开状态下渲染结果为空');
  let rowCount = 0;
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    const cls = n.props && n.props.className;
    if (typeof cls === 'string' && cls.indexOf('fg-row') === 0) rowCount++;
    for (const c of n.children || []) walk(c);
  })(panelTree[0]);
  if (rowCount !== 5) throw new Error('展开状态应渲染 5 行，实际 ' + rowCount);

  const row = renderNode(React.createElement(test.MonitorRow, { agent: ordered[0], onOpen: () => {} }));
  if (!row.length || row[0].tag !== 'div') throw new Error('MonitorRow 顶层不是 div');
  if (String(row[0].props.className).indexOf('fg-row') !== 0) throw new Error('MonitorRow 缺少 fg-row className');

  // 4) 跑一次 effect（轮询会发起一次假 fetch），确认不炸。
  for (const fn of effects) {
    const cleanup = fn();
    if (typeof cleanup === 'function') cleanup();
  }

  console.log('  client : ' + target);
  console.log('  chip   : <' + rootTag + ' class="' + tree[0].props.className + '"> (' + chipNodes + ' nodes)');
  console.log('  panel  : <div fg-panel> (' + countNodes(panelTree) + ' nodes, ' + ordered.length + ' agents, chip ' + countNodes(chipOn) + ' nodes)');
  console.log('  effects: ' + effects.length + ' 个已执行');
  console.log('render ok');
  // 共享轮询器会挂一个真实 setTimeout，自检到这里就该退出。
  process.exit(0);
}

try {
  main();
} catch (err) {
  fail(err);
}

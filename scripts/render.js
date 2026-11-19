#!/usr/bin/env node
/**
 * render.js — 把 IsoFloor 场景用假数据序列化成静态 SVG，供 raster.py 转 PNG。
 *
 * 同样桩掉宿主环境后加载 ../client.js，用 5 个假 agent（1 个 RUNNING 组长、
 * 1 个带 parent 的子代理、其余 IDLE，每个都带 tool / files 字段）渲染一次 IsoFloor，
 * 再把 React 元素树序列化成 SVG。所有 var(--dsw-*) 都换成主题兜底色，
 * 所以产物是浅色皮肤的静态快照。
 *
 * 用法：
 *   node scripts/render.js                    # ../client.js → scripts/out/iso.svg
 *   node scripts/render.js ../client.js out/iso.svg
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const clientPath = path.resolve(process.argv[2] || path.join(HERE, '..', 'client.js'));
const outPath = path.resolve(process.argv[3] || path.join(HERE, 'out', 'iso.svg'));

// ---------------------------------------------------------------------------
// 宿主环境桩（与 harness.js 保持同样的形状）
// ---------------------------------------------------------------------------
let captured = null;
const hookStates = [];
let hookIndex = 0;
const React = {
  createElement(tag, props, ...kids) { return { tag, props: props || {}, kids }; },
  useState(initial) {
    const i = hookIndex++;
    if (!(i in hookStates)) hookStates[i] = typeof initial === 'function' ? initial() : initial;
    return [hookStates[i], () => {}];
  },
  useRef(value) { return { current: value }; },
  useEffect() {},
};

const win = {
  __ModuleLoader__: { load(mod) { captured = mod; } },
  setTimeout: () => 0,
  clearTimeout: () => {},
  innerWidth: 1440,
  innerHeight: 900,
};
const doc = {
  head: { appendChild: () => {} },
  getElementById: () => null,
  createElement: () => ({ style: {}, set id(v) {}, set textContent(v) {} }),
};
const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const fakeFetch = () => new Promise(() => {});

// ---------------------------------------------------------------------------
// 元素树 → SVG 字符串
// ---------------------------------------------------------------------------
// 只有这些 SVG 属性本身是驼峰；其余（strokeWidth / fontSize / textAnchor…）要转成 kebab-case。
const KEEP_CAMEL = new Set([
  'viewBox', 'preserveAspectRatio', 'gradientUnits', 'patternUnits', 'patternContentUnits',
]);
// 注：animateMotion 的 xlinkHref 用 SVG2 的 href 输出，避免 XML 里出现未声明的 xlink 前缀。
const ATTR_MAP = { className: 'class', htmlFor: 'for', xlinkHref: 'href' };

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function styleString(style) {
  return Object.keys(style || {})
    .map((prop) => prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) + ':' + style[prop])
    .join(';');
}

function attrsOf(props) {
  const out = [];
  for (const key of Object.keys(props || {})) {
    if (key === 'key' || key === 'children' || key === 'ref') continue;
    if (/^on[A-Z]/.test(key)) continue; // 事件回调不进 SVG
    const value = props[key];
    if (value === undefined || value === null || value === false) continue;
    if (key === 'style') {
      if (value && typeof value === 'object') out.push(' style="' + esc(styleString(value)) + '"');
      continue;
    }
    let name = ATTR_MAP[key] || key;
    if (!KEEP_CAMEL.has(name)) {
      name = name.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    }
    out.push(' ' + name + '="' + esc(value) + '"');
  }
  return out.join('');
}

function serialize(node) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return esc(node);
  if (Array.isArray(node)) return node.map(serialize).join('');
  const { tag, props, kids } = node;
  if (typeof tag === 'function') {
    hookIndex = 0;
    return serialize(tag(props || {}));
  }
  return '<' + tag + attrsOf(props) + '>' + (kids || []).map(serialize).join('') + '</' + tag + '>';
}

// ---------------------------------------------------------------------------
// 假数据：5 个 agent，覆盖 RUNNING / 子代理 / IDLE，全部带 tool + files
// ---------------------------------------------------------------------------
function sampleData() {
  const now = Date.now();
  const files = (list) => list.map((f) => ({ name: f[0], write: !!f[1] }));
  const mk = (agent) => Object.assign({
    turn: 1, step: 1, tools: 0, tokens: 0, updatedAt: now,
    files: [], tool: null, parent: null,
  }, agent, {
    sessionId: agent.id,
    files: files(agent.files || []),
  });

  return {
    agents: [
      mk({
        id: 's1', name: 'MY', status: 'RUNNING',
        step: 10, turn: 2, tools: 68, tokens: 120000,
        tool: { name: 'bash', target: 'pnpm run build' },
        files: [['client.js', true], ['index.js', false]],
      }),
      mk({
        id: 's2', name: 'dsh-skill-pilot', status: 'IDLE',
        step: 1, tools: 41, tokens: 22000, updatedAt: now - 120000,
        tool: { name: 'read', target: 'SKILL.md' },
        files: [['SKILL.md', false]],
      }),
      mk({
        id: 's3', name: 'Mnemon · Idle review', status: 'IDLE',
        step: 3, tools: 3, tokens: 8000, updatedAt: now - 3 * 600000,
        tool: { name: 'mnemon_recall', target: 'review' },
        files: [['MEMORY.md', true]],
      }),
      mk({
        id: 's4', name: '执行一条 bash 命令：sleep 25', status: 'IDLE',
        step: 1, tools: 1, tokens: 1200, updatedAt: now - 4 * 600000,
        tool: { name: 'bash', target: 'sleep 25' },
        files: [['run.log', false]],
      }),
      mk({
        id: 's5', name: '子代理 · token-econ', status: 'IDLE', parent: 's1',
        step: 4, tools: 12, tokens: 9000, updatedAt: now - 60000,
        tool: { name: 'grep', target: 'token' },
        files: [['token.md', true], ['index.js', false]],
      }),
    ],
  };
}

function main() {
  if (!fs.existsSync(clientPath)) throw new Error('client file not found: ' + clientPath);
  let src = fs.readFileSync(clientPath, 'utf8');

  const EXPORT_RE = /return\s*\{\s*inject\s*,\s*apply\s*\};/;
  if (!EXPORT_RE.test(src)) {
    throw new Error('client.js: 找不到 `return { inject, apply };` —— 导出结构变了？请同步更新 scripts/render.js / harness.js 的 EXPORT_RE。');
  }
  src = src.replace(EXPORT_RE,
    'return { inject, apply, __dshTest: { IsoFloor: IsoFloor, deriveAgents: deriveAgents } };');

  const factoryFn = new Function(
    'window', 'document', 'localStorage', 'fetch', 'console', '__filename', '__dirname', src,
  );
  factoryFn(win, doc, storage, fakeFetch, console, clientPath, path.dirname(clientPath));

  if (!captured || typeof captured.factory !== 'function') {
    throw new Error('client.js 没有调用 window.__ModuleLoader__.load({ factory })');
  }
  const mod = captured.factory((name) => {
    if (name === 'react' || name === 'React') return React;
    throw new Error('unexpected require("' + name + '") — render 只桩了 react');
  });
  const test = mod && mod.__dshTest;
  if (!test || typeof test.IsoFloor !== 'function' || typeof test.deriveAgents !== 'function') {
    throw new Error('client.js 没有暴露 __dshTest.IsoFloor / deriveAgents');
  }

  const ordered = test.deriveAgents(sampleData());
  if (ordered.length !== 5) throw new Error('假数据应得到 5 个 agent，实际 ' + ordered.length);
  const running = ordered.filter((o) => o.agent.status === 'RUNNING').length;
  if (running !== 1) throw new Error('假数据应有 1 个 RUNNING，实际 ' + running);
  if (!ordered.some((o) => o.depth === 1 && o.agent.parent)) throw new Error('假数据缺少带 parent 的子代理');

  const COLS = 4;
  const seats = ordered.map((o, i) => ({ agent: o.agent, row: Math.floor(i / COLS), col: i % COLS }));

  hookIndex = 0;
  const tree = React.createElement(test.IsoFloor, { seats, onOpen: () => {} });
  let svg = serialize(tree);

  // 1) CSS var() → 主题兜底色（浅色皮肤快照）
  svg = svg.replace(/var\(\s*--[a-z0-9-]+\s*,\s*([^)]+)\)/g, (m, fallback) => fallback.trim());
  if (/var\(\s*--/.test(svg)) throw new Error('还有 var(--*) 没兜底色，raster.py 无法解析；请给 client.js 的变量补 fallback');
  // 2) 渐变/滤镜引用直接置空（旧版本有 fg-iso-glow）
  svg = svg.replace(/url\(#[a-zA-Z0-9_-]+\)/g, 'none');
  // 3) 补 SVG 根属性 + 浅色页面底色
  const vb = /viewBox="0 0 ([0-9.]+) ([0-9.]+)"/.exec(svg);
  const W = vb ? Math.ceil(Number(vb[1])) : 1280;
  const H = vb ? Math.ceil(Number(vb[2])) : 900;
  svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"');
  svg = svg.replace(/(<svg[^>]*>)/, '$1<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#f7f7f9"/>');

  const bytes = Buffer.byteLength(svg, 'utf8');
  if (bytes <= 5000) throw new Error('生成的 SVG 只有 ' + bytes + ' 字节，疑似场景没渲染出来（期望 > 5000）');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, 'utf8');
  console.log('wrote ' + outPath + ' (' + bytes + ' bytes, ' + W + 'x' + H + ', ' + ordered.length + ' agents)');
}

try {
  main();
} catch (err) {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
}

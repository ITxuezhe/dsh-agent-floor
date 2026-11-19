window.__ModuleLoader__.load({
  id: 'dsh-agent-floor',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;

    let moduleCtx = null;
    const POS_KEY = 'dsh.agent-floor.pos';
    const OPEN_KEY = 'dsh.agent-floor.open';
    const ACTIVE_KEY = 'dsh.agent-floor.active';
    const CHILD_TTL = 10 * 60 * 1000;

    const CSS = `
.fg-root{font-family:ui-sans-serif,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--dsw-alias-label-primary,#e8e8ea);}
.fg-root *{box-sizing:border-box;}
.fg-pill{position:fixed;left:16px;bottom:16px;z-index:120;display:flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 10px;border-radius:17px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));background:var(--dsw-alias-bg-overlay,rgba(28,28,32,.92));backdrop-filter:blur(10px);color:inherit;font-size:12px;font-weight:600;letter-spacing:.02em;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.28);pointer-events:auto;transition:transform .15s ease,border-color .15s ease;}
.fg-pill:hover{transform:translateY(-1px);border-color:var(--dsw-alias-brand-primary,#5b8cff);}
.fg-dot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-idle-primary,#6b7280);flex:none;}
.fg-dot-live{background:var(--dsw-alias-state-success-primary,#22c55e);box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:fg-pulse 1.8s ease-out infinite;}
@keyframes fg-pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.5)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
.fg-panel{position:fixed;left:16px;bottom:16px;z-index:121;width:392px;max-height:min(64vh,600px);display:flex;flex-direction:column;border-radius:16px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.14));background:var(--dsw-alias-bg-overlay,rgba(26,26,30,.96));backdrop-filter:blur(14px);box-shadow:0 18px 48px rgba(0,0,0,.4);overflow:hidden;pointer-events:auto;}
.fg-head{display:flex;align-items:center;gap:8px;padding:11px 12px 9px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.09));cursor:grab;user-select:none;touch-action:none;}
.fg-head:active,.fg-dragging .fg-head{cursor:grabbing;}
.fg-title{font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;opacity:.92;}
.fg-count{font-size:11px;opacity:.62;margin-left:auto;white-space:nowrap;}
.fg-icon{width:24px;height:24px;display:grid;place-items:center;border-radius:7px;border:1px solid transparent;background:transparent;color:inherit;cursor:pointer;opacity:.7;font-size:13px;line-height:1;}
.fg-icon:hover{opacity:1;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.08));}
.fg-list{overflow-y:auto;padding:6px;}
.fg-row{display:flex;gap:10px;padding:9px;border-radius:11px;cursor:pointer;border:1px solid transparent;transition:background .12s ease,border-color .12s ease;position:relative;}
.fg-row:hover{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06));border-color:var(--dsw-alias-border-l1,rgba(255,255,255,.1));}
.fg-row[data-run="1"]{background:linear-gradient(90deg,rgba(34,197,94,.09),transparent 62%);}
.fg-row[data-depth="1"]{margin-left:22px;padding:7px 9px;}
.fg-row[data-depth="1"]:before{content:"";position:absolute;left:-13px;top:-6px;bottom:50%;width:10px;border-left:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.18));border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.18));border-bottom-left-radius:6px;}
.fg-av{flex:none;width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.07));overflow:hidden;}
.fg-row[data-depth="1"] .fg-av{width:26px;height:26px;border-radius:7px;}
.fg-eng{display:block;}
.fg-eng-run{animation:fg-bob 1.7s ease-in-out infinite;}
@keyframes fg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
.fg-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;}
.fg-top{display:flex;align-items:center;gap:6px;}
.fg-name{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fg-row[data-depth="1"] .fg-name{font-size:11.5px;}
.fg-chip{flex:none;font-size:9.5px;font-weight:700;letter-spacing:.04em;padding:1px 6px;border-radius:5px;border:1px solid currentColor;opacity:.9;}
.fg-chip-run{color:var(--dsw-alias-state-success-primary,#22c55e);}
.fg-chip-wait{color:var(--dsw-alias-state-warn-primary,#f59e0b);}
.fg-chip-idle{color:var(--dsw-alias-state-idle-primary,#6b7280);}
.fg-sub{font-size:10.5px;opacity:.6;display:flex;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fg-bar{height:4px;border-radius:3px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.1));overflow:hidden;}
.fg-bar i{display:block;height:100%;border-radius:3px;background:var(--dsw-alias-brand-primary,#5b8cff);transition:width .5s ease;}
.fg-row[data-run="1"] .fg-bar i{background:linear-gradient(90deg,#22c55e,#4ade80);background-size:200% 100%;animation:fg-flow 1.6s linear infinite;}
@keyframes fg-flow{from{background-position:0 0}to{background-position:-200% 0}}
.fg-meta{font-size:10px;opacity:.45;display:flex;gap:8px;font-variant-numeric:tabular-nums;}
.fg-empty{padding:22px 12px;text-align:center;font-size:11.5px;opacity:.5;}
.fg-full{position:fixed;inset:0;z-index:130;background:color-mix(in srgb,var(--dsw-alias-bg-base,#0f0f12) 82%,transparent);backdrop-filter:blur(16px);display:flex;flex-direction:column;pointer-events:auto;animation:fg-fade .18s ease;}
@keyframes fg-fade{from{opacity:0}to{opacity:1}}
.fg-full-head{display:flex;align-items:center;gap:10px;padding:18px 22px 10px;}
.fg-full-title{font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
.fg-full-sub{font-size:11px;opacity:.55;}
.fg-grid{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(238px,1fr));gap:14px;padding:8px 22px 26px;align-content:start;}
.fg-stage{flex:1;overflow:auto;padding:0 12px 18px;display:flex;align-items:flex-start;justify-content:center;}
.fg-iso-run{animation:fg-iso-bob 2.4s ease-in-out infinite;}
.fg-flow{animation:fg-dash 1.4s linear infinite;}
@keyframes fg-dash{to{stroke-dashoffset:-24}}
.fg-flow-g{opacity:.9;}
.fg-task{font-size:10px;opacity:.62;display:flex;gap:6px;align-items:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fg-task b{font-weight:650;opacity:.9;}
.fg-files{font-size:9.5px;opacity:.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
@keyframes fg-iso-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
.fg-card{border-radius:16px;border:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.12));background:var(--dsw-alias-bg-layer-1,rgba(30,30,35,.9));padding:14px;display:flex;flex-direction:column;gap:9px;cursor:pointer;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;}
.fg-card:hover{transform:translateY(-2px);border-color:var(--dsw-alias-brand-primary,#5b8cff);box-shadow:0 12px 30px rgba(0,0,0,.3);}
.fg-card[data-run="1"]{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#22c55e) 45%,transparent);}
.fg-card-top{display:flex;align-items:center;gap:10px;}
.fg-card-av{width:56px;height:56px;flex:none;display:grid;place-items:center;border-radius:12px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06));}
.fg-card-name{font-size:13px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fg-card-role{font-size:10px;opacity:.55;letter-spacing:.05em;text-transform:uppercase;}
.fg-card-last{font-size:10.5px;opacity:.6;min-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fg-card-stats{display:flex;gap:12px;font-size:10.5px;font-variant-numeric:tabular-nums;opacity:.75;}
.fg-card-stats b{font-weight:700;opacity:.95;}
.fg-kids{display:flex;flex-wrap:wrap;gap:5px;border-top:1px dashed var(--dsw-alias-border-l1,rgba(255,255,255,.12));padding-top:8px;}
.fg-kid{display:inline-flex;align-items:center;gap:5px;font-size:10px;padding:2px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.07));opacity:.85;}
`;

    function installStyle() {
      if (typeof document === 'undefined') return;
      if (document.getElementById('dsh-agent-floor-css')) return;
      const el = document.createElement('style');
      el.id = 'dsh-agent-floor-css';
      el.textContent = CSS;
      document.head.appendChild(el);
    }

    function hash(s) {
      let x = 0;
      const str = String(s || '');
      for (let i = 0; i < str.length; i += 1) x = (x * 31 + str.charCodeAt(i)) | 0;
      return Math.abs(x);
    }

    function num(n) {
      const v = Number(n) || 0;
      if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
      if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
      return String(Math.round(v));
    }

    function ago(t) {
      const s = Math.max(0, Math.round((Date.now() - Number(t || 0)) / 1000));
      if (s < 60) return s + ' 秒前';
      if (s < 3600) return Math.round(s / 60) + ' 分钟前';
      return Math.round(s / 3600) + ' 小时前';
    }

    function statusOf(a) {
      if (a.status === 'RUNNING') return { text: '干活中', cls: 'fg-chip-run' };
      if (a.status === 'STANDBY') return { text: '待命', cls: 'fg-chip-wait' };
      return { text: '收工', cls: 'fg-chip-idle' };
    }

    function progress(a) {
      const tokens = Number(a.tokens) || 0;
      return Math.max(3, Math.min(100, (tokens / 120000) * 100));
    }

    function spriteParts(seed) {
      const hue = hash(seed) % 360;
      const shirt = 'hsl(' + hue + ' 62% 52%)';
      const shirt2 = 'hsl(' + hue + ' 62% 40%)';
      const hair = 'hsl(' + ((hue + 35) % 360) + ' 32% 26%)';
      const skin = '#f0c9a2';
      return [
        [2, 1, 4, 1, hair],
        [1, 2, 6, 1, hair],
        [2, 3, 4, 2, skin],
        [2, 4, 1, 1, '#2b2b33'],
        [5, 4, 1, 1, '#2b2b33'],
        [1, 6, 6, 2, shirt],
        [2, 7, 4, 1, shirt2],
      ];
    }

    function Engine({ seed, size, running }) {
      const cell = size / 8;
      const parts = spriteParts(seed);
      return h('svg', {
        className: 'fg-eng' + (running ? ' fg-eng-run' : ''),
        width: size, height: size, viewBox: '0 0 ' + size + ' ' + size, 'aria-hidden': 'true',
      }, parts.map((q, i) => h('rect', {
        key: i, x: q[0] * cell, y: q[1] * cell, width: q[2] * cell, height: q[3] * cell, fill: q[4], rx: cell * 0.2,
      })).concat(running ? [h('rect', {
        key: 'lamp', x: 6.4 * cell, y: 5.4 * cell, width: cell, height: cell, fill: '#7dd3fc', rx: cell * 0.3,
      })] : []));
    }

    const ISO = { TW: 350, TH: 170, DESK: 18, SP: 4.6, COLS: 4 };

    function isoDiamond(p, w, h) {
      return [[p.x, p.y - h / 2], [p.x + w / 2, p.y], [p.x, p.y + h / 2], [p.x - w / 2, p.y]]
        .map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1))
        .join(' ');
    }

    function IsoFloor({ seats, onOpen, scale, offset }) {
      const { TW, TH, DESK, SP, COLS } = ISO;
      const list = (seats || []).filter((s) => s && s.agent);
      const rows = Math.max(1, Math.ceil(Math.max(1, list.length) / COLS));
      const cols = Math.max(1, Math.min(COLS, Math.max(1, list.length)));
      const W = Math.max(900, Math.round((cols + rows) * (TW / 2) + 240));
      const H = Math.max(440, Math.round((cols + rows) * (TH / 2) + 300));
      const cx = W / 2;
      const cy = 180;
      const at = (c, r) => ({ x: cx + (c - r) * (TW / 2), y: cy + (c + r) * (TH / 2) });

      const bg1 = 'var(--dsw-alias-bg-layer-1,#ffffff)';
      const bg2 = 'var(--dsw-alias-bg-layer-2,#f3f3f6)';
      const ink = 'var(--dsw-alias-label-primary,#1c1c1e)';
      const dim = 'color-mix(in srgb, var(--dsw-alias-label-primary,#1c1c1e) 58%, transparent)';
      const hair = 'color-mix(in srgb, var(--dsw-alias-label-primary,#1c1c1e) 18%, transparent)';
      const accent = 'var(--dsw-alias-brand-primary,#3b82f6)';
      const okc = 'var(--dsw-alias-state-success-primary,#16a34a)';
      const warnc = 'var(--dsw-alias-state-warn-primary,#f59e0b)';
      const tone = (pct, base) => 'color-mix(in srgb, var(--dsw-alias-label-primary,#1c1c1e) ' + pct + '%, ' + (base || bg1) + ')';

      const fixed = list.map((s) => ({ ...s, p: at(s.col, s.row) }));
      const bySeat = new Map();
      fixed.forEach((s) => bySeat.set(s.agent.id, s.p));

      const scene = [];
      const tags = [];
      const couriers = [];

      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const cp = at(c, r);
          const occupied = fixed.some((s2) => s2.col === c && s2.row === r);
          scene.push(h('polygon', {
            key: 'fl' + c + '-' + r,
            points: isoDiamond(cp, TW, TH),
            fill: tone(occupied ? 4.5 : 3),
            stroke: hair,
            strokeWidth: 0.7,
          }));
        }
      }

      fixed.forEach((seat) => {
        const a = seat.agent;
        const p = seat.p;
        const run = a.status === 'RUNNING';
        const kid = !!a.parent;
        const sp = kid ? SP * 0.88 : SP;

        scene.push(h('polygon', {
          key: 'mat' + a.id,
          points: isoDiamond(p, TW * 0.86, TH * 0.86),
          fill: tone(run ? 9 : 2),
          stroke: run ? tone(30) : 'none',
          strokeWidth: 1.2,
          strokeDasharray: run ? '8 6' : 'none',
        }));

        const dw = TW * 0.34;
        const dh = TH * 0.32;
        const dy = p.y + 8;
        const topFace = [
          [p.x, dy - dh / 2 - DESK], [p.x + dw / 2, dy - DESK], [p.x, dy + dh / 2 - DESK], [p.x - dw / 2, dy - DESK],
        ].map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
        const leftFace = [
          [p.x - dw / 2, dy - DESK], [p.x, dy + dh / 2 - DESK], [p.x, dy + dh / 2], [p.x - dw / 2, dy],
        ].map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
        const rightFace = [
          [p.x, dy + dh / 2 - DESK], [p.x + dw / 2, dy - DESK], [p.x + dw / 2, dy], [p.x, dy + dh / 2],
        ].map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
        scene.push(h('g', { key: 'dk' + a.id }, [
          h('polygon', { key: 'l', points: leftFace, fill: tone(24, bg2), stroke: hair, strokeWidth: 0.8 }),
          h('polygon', { key: 'r', points: rightFace, fill: tone(15, bg2), stroke: hair, strokeWidth: 0.8 }),
          h('polygon', { key: 't', points: topFace, fill: tone(8, bg2), stroke: hair, strokeWidth: 1 }),
        ]));

        const sprite = spriteParts(a.id || a.name);
        const sx = p.x - 4 * sp;
        const sy = p.y + 14 - 8 * sp;
        scene.push(h('g', {
          key: 'sp' + a.id,
          className: run ? 'fg-iso-run' : undefined,
        }, sprite.map((q, i) => h('rect', {
          key: i,
          x: sx + q[0] * sp,
          y: sy + q[1] * sp,
          width: q[2] * sp,
          height: q[3] * sp,
          rx: sp * 0.24,
          fill: q[4],
        })).concat(run ? [h('rect', {
          key: 'led',
          x: sx + 6.2 * sp,
          y: sy + 5.4 * sp,
          width: sp,
          height: sp,
          rx: sp * 0.3,
          fill: '#38bdf8',
        })] : [])));

        const tw = 160;
        const tx = Math.max(6, Math.min(W - tw - 6, p.x - tw / 2));
        const ty = p.y - 96;
        const status = run ? okc : a.status === 'STANDBY' ? warnc : dim;
        const files = (a.files || []).slice(0, 2).map((f) => (f.write ? '改 ' : '') + f.name).join(' · ');
        tags.push(h('g', {
          key: 'tg' + a.id,
          'data-tag': '1',
          style: { cursor: 'pointer' },
          onClick: () => onOpen && onOpen(a),
        }, [
          h('line', {
            key: 'stem', x1: p.x, y1: ty + 40, x2: p.x, y2: p.y - 14,
            stroke: hair, strokeWidth: 1, strokeDasharray: '3 3',
          }),
          h('rect', { key: 'bg', x: tx, y: ty, width: tw, height: 40, rx: 9, fill: bg1, stroke: hair, strokeWidth: 1 }),
          h('circle', { key: 'd', cx: tx + 10, cy: ty + 12, r: 3.2, fill: status }),
          h('text', {
            key: 'n', x: tx + 18, y: ty + 16, fill: ink, fontSize: 10, fontWeight: 650,
          }, (a.name || '未命名').slice(0, 16)),
          h('rect', { key: 'tr', x: tx + 9, y: ty + 22, width: tw - 18, height: 3, rx: 2, fill: tone(12) }),
          h('rect', {
            key: 'fl', x: tx + 9, y: ty + 22, width: (tw - 18) * (progress(a) / 100), height: 3, rx: 2,
            fill: run ? okc : tone(34),
          }),
          h('text', {
            key: 'm', x: tx + 9, y: ty + 35, fill: dim, fontSize: 8.8,
          }, (files || (kid ? '子工程师 · 第 ' : '主工程师 · 第 ') + (a.step || 0) + ' 步')),
        ]));

        if (run && a.tool) {
          const label = (a.tool.name || 'tool') + (a.tool.target ? ' · ' + a.tool.target : '');
          const text = label.length > 26 ? label.slice(0, 25) + '…' : label;
          const bw = Math.min(200, Math.max(78, 15 + text.length * 5.9));
          const bx = Math.max(6, Math.min(W - bw - 6, p.x - bw / 2));
          const by = p.y - 128;
          tags.push(h('g', { key: 'bb' + a.id }, [
            h('polygon', {
              key: 'tail',
              points: (bx + bw / 2 - 5).toFixed(1) + ',' + (by + 21) + ' ' + (bx + bw / 2 + 6).toFixed(1) + ',' + (by + 21) + ' ' + (bx + bw / 2).toFixed(1) + ',' + (by + 28),
              fill: bg1, stroke: accent, strokeWidth: 1,
            }),
            h('rect', { key: 'b', x: bx, y: by, width: bw, height: 22, rx: 7, fill: bg1, stroke: accent, strokeWidth: 1 }),
            h('text', {
              key: 't', x: bx + 8, y: by + 15, fill: ink, fontSize: 9.8, fontWeight: 600,
            }, text),
          ]));
        }
      });

      fixed.forEach((seat) => {
        const a = seat.agent;
        if (!a.parent) return;
        const from = bySeat.get(a.parent);
        const to = seat.p;
        if (!from) return;
        const pid = 'fgwalk' + Math.abs(hash(String(a.id))).toString(36);
        const lift = Math.min(from.y, to.y) - 66;
        const d = 'M ' + from.x.toFixed(1) + ' ' + (from.y + 2).toFixed(1) + ' Q ' + ((from.x + to.x) / 2).toFixed(1) + ' ' + lift.toFixed(1) + ' ' + to.x.toFixed(1) + ' ' + (to.y + 2).toFixed(1);
        const dur = a.status === 'RUNNING' ? '3.4s' : '7s';
        couriers.push(h('path', {
          key: 'p' + pid, id: pid, d, fill: 'none', stroke: tone(30), strokeWidth: 1.4,
          strokeDasharray: '5 7', className: 'fg-flow', opacity: 0.8,
        }));
        const mini = spriteParts(a.id || a.name).slice(5);
        couriers.push(h('g', { key: 'c' + pid, className: 'fg-flow-g' }, [
          h('animateMotion', {
            key: 'am', dur, repeatCount: 'indefinite', rotate: '0', xlinkHref: '#' + pid,
          }),
          ...mini.map((q, i) => h('rect', {
            key: i, x: q[0] * 1.8 - 6, y: q[1] * 1.8 - 6, width: q[2] * 1.8, height: q[3] * 1.8, fill: q[4], rx: 1,
          })),
        ]));
      });

      const zoom = Math.min(2.2, Math.max(0.6, Number(scale) || 1));
      const off = offset || { x: 0, y: 0 };
      const ox = Number(off.x) || 0;
      const oy = Number(off.y) || 0;
      const vcx = W / 2;
      const vcy = H / 2;
      const view = 'translate(' + (vcx + ox).toFixed(2) + ' ' + (vcy + oy).toFixed(2) + ')'
        + ' scale(' + zoom.toFixed(4) + ')'
        + ' translate(' + (-vcx).toFixed(2) + ' ' + (-vcy).toFixed(2) + ')';

      return h('svg', {
        className: 'fg-iso',
        viewBox: '0 0 ' + W + ' ' + H,
        preserveAspectRatio: 'xMidYMin meet',
        style: { width: '100%', height: '100%', display: 'block' },
      }, h('g', { key: 'viewport', transform: view }, scene.concat(couriers, tags)));
    }

    function useFloor(active) {
      const [state, setState] = useState(null);
      useEffect(() => {
        let alive = true;
        let timer = 0;
        const load = async () => {
          try {
            const res = await fetch('/dsh-agent-floor/state', { headers: { accept: 'application/json' } });
            if (!res.ok) throw new Error(String(res.status));
            const body = await res.json();
            if (alive) setState(body);
          } catch (e) {
            if (alive) setState(null);
          }
          if (alive) timer = window.setTimeout(load, active ? 1800 : 7000);
        };
        load();
        return () => { alive = false; window.clearTimeout(timer); };
      }, [active]);
      return state;
    }

    function openSession(id) {
      try {
        const ctx = moduleCtx;
        if (!ctx) return;
        const ws = ctx.get ? ctx.get('uiWorkspace') : null;
        if (ws && typeof ws.openSession === 'function') { ws.openSession(id); return; }
        const sessions = ctx.get ? ctx.get('sessions') : null;
        if (sessions && typeof sessions.scope === 'function') sessions.scope(id);
      } catch (e) { /* read-only fallback */ }
    }

    function deriveAgents(data) {
      if (!data) return [];
      const rows = Array.isArray(data.sessions) ? data.sessions : null;
      const now = Date.now();
      const list = rows ? rows.map((s) => ({
        id: s.id,
        name: s.title || s.cwd || s.id,
        parent: s.parent || null,
        role: s.parent ? 'SUBAGENT' : 'LEAD',
        status: s.running ? 'RUNNING' : (now - (s.updatedAt || 0) < 300000 ? 'STANDBY' : 'IDLE'),
        step: s.step || 0,
        turn: s.turn || 0,
        tools: s.toolCalls || 0,
        tokens: (s.tokensIn || 0) + (s.tokensOut || 0),
        lastEvent: s.lastLabel || '',
        tool: s.lastTool || null,
        files: (Array.isArray(s.diffFiles) && s.diffFiles.length)
          ? s.diffFiles.slice(0, 4).map((f) => ({ name: String(f).split('/').pop(), write: true }))
          : (Array.isArray(s.files) ? s.files : []),
        updatedAt: s.updatedAt,
        sessionId: s.id,
      })) : (Array.isArray(data.agents) ? data.agents : []);

      const seen = new Map();
      for (const a of list) {
        const key = (a.name || '').trim();
        seen.set(key, (seen.get(key) || 0) + 1);
      }
      for (const a of list) {
        if (seen.get((a.name || '').trim()) > 1) {
          a.name = a.name + ' · ' + String(a.id || a.sessionId || '').slice(-4);
        }
      }
      for (const a of list) {
        if (a.parent && a.name && a.name.length > 18) a.name = a.name.slice(0, 18) + '…';
      }

      const fresh = list.filter((a) => {
        if (!a.parent) return true;
        return a.status === 'RUNNING' || (now - (a.updatedAt || 0)) < CHILD_TTL;
      });

      const byId = new Map(fresh.map((a) => [a.id || a.sessionId, a]));
      const leaders = [];
      const children = new Map();
      for (const a of fresh) {
        const pid = a.parent && byId.has(a.parent) ? a.parent : null;
        if (pid) {
          const bucket = children.get(pid) || [];
          bucket.push(a);
          children.set(pid, bucket);
        } else {
          leaders.push(a);
        }
      }
      const ordered = [];
      for (const lead of leaders) {
        ordered.push({ agent: lead, depth: 0 });
        const kids = children.get(lead.id || lead.sessionId) || [];
        for (const kid of kids) ordered.push({ agent: kid, depth: 1 });
      }
      for (const [pid, kids] of children) {
        if (byId.has(pid)) continue;
        for (const kid of kids) ordered.push({ agent: kid, depth: 1 });
      }
      return ordered;
    }

    function AgentRow({ a, depth, kidCount = 0 }) {
      const st = statusOf(a);
      const run = a.status === 'RUNNING';
      return h('div', {
        className: 'fg-row',
        'data-run': run ? '1' : '0',
        'data-depth': String(depth || 0),
        title: '点击打开这个会话',
        onClick: () => { if (a.sessionId || a.id) openSession(a.sessionId || a.id); },
      }, [
        h('div', { className: 'fg-av', key: 'av' }, h(Engine, {
          seed: a.id || a.name, size: depth ? 22 : 30, running: run,
        })),
        h('div', { className: 'fg-main', key: 'main' }, [
          h('div', { className: 'fg-top', key: 'top' }, [
            h('span', { className: 'fg-name', key: 'n' }, a.name || '未命名'),
            h('span', { className: 'fg-chip ' + st.cls, key: 'c' }, st.text),
          ]),
          h('div', { className: 'fg-sub', key: 'sub' }, [
            h('span', { key: 'r' }, depth ? '子工程师' : (kidCount ? '组长 · 带队 ' + kidCount + ' 人' : '主工程师')),
            h('span', { key: 's' }, '第 ' + (a.step || 0) + ' 步 · 第 ' + (a.turn || 0) + ' 轮'),
            h('span', { key: 't' }, num(a.tools) + ' 次工具'),
          ]),
          a.tool ? h('div', { className: 'fg-task', key: 'task' }, [
            h('b', { key: 'k' }, a.tool.name || '工具'),
            h('span', { key: 'v' }, a.tool.target || ''),
          ]) : null,
          (a.files && a.files.length) ? h('div', { className: 'fg-files', key: 'files' },
            a.files.slice(0, 3).map((f) => (f.write ? '改 ' : '') + f.name).join('  ·  ')) : null,
          h('div', { className: 'fg-bar', key: 'bar' }, h('i', { style: { width: progress(a) + '%' } })),
          h('div', { className: 'fg-meta', key: 'meta' }, [
            h('span', { key: 'tok' }, num(a.tokens) + ' tok'),
            h('span', { key: 'ago' }, ago(a.updatedAt)),
          ]),
        ]),
      ]);
    }

    function FloorDock() {
      const [open, setOpen] = useState(() => {
        try { return localStorage.getItem(OPEN_KEY) === '1'; } catch (e) { return false; }
      });
      const [full, setFull] = useState(false);
      const [onlyActive, setOnlyActive] = useState(() => {
        try { return localStorage.getItem(ACTIVE_KEY) === '1'; } catch (e) { return false; }
      });
      const [pos, setPos] = useState(() => {
        try {
          const raw = localStorage.getItem(POS_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
      });
      const [dragging, setDragging] = useState(false);
      const panelRef = useRef(null);
      const dragRef = useRef(null);

      // 工位视图：缩放 / 平移 / 复位
      const [viewScale, setViewScale] = useState(1);
      const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
      const [viewDrag, setViewDrag] = useState(false);
      const stageRef = useRef(null);
      const panRef = useRef(null);
      const suppressRef = useRef(false);
      const data = useFloor(open || full);
      const ordered = deriveAgents(data);
      const agents = ordered.map((o) => o.agent);
      const running = agents.filter((a) => a.status === 'RUNNING').length;
      const leaderCount = ordered.filter((o) => o.depth === 0).length;
      const visible = onlyActive
        ? ordered.filter((o) => o.agent.status === 'RUNNING').map((o) => ({ agent: o.agent, depth: 0 }))
        : ordered;

      useEffect(() => {
        try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch (e) { /* private mode */ }
      }, [open]);

      useEffect(() => {
        try { localStorage.setItem(ACTIVE_KEY, onlyActive ? '1' : '0'); } catch (e) { /* private mode */ }
      }, [onlyActive]);

      const onDragStart = (e) => {
        if (e.button !== 0) return;
        const el = panelRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width, h: rect.height };
        setDragging(true);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* older engines */ }
      };
      const onDragMove = (e) => {
        const d = dragRef.current;
        if (!d) return;
        const x = Math.min(Math.max(8, e.clientX - d.dx), Math.max(8, window.innerWidth - d.w - 8));
        const y = Math.min(Math.max(8, e.clientY - d.dy), Math.max(8, window.innerHeight - d.h - 8));
        setPos({ x, y });
      };
      const onDragEnd = () => {
        if (!dragRef.current) { return; }
        dragRef.current = null;
        setDragging(false);
        try {
          const rect = panelRef.current ? panelRef.current.getBoundingClientRect() : null;
          if (rect) localStorage.setItem(POS_KEY, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
        } catch (e) { /* private mode */ }
      };

      // 视图尺度：像素 delta 换算成 viewBox 单位（preserveAspectRatio=xMidYMin meet）
      const stageMetrics = () => {
        const stage = stageRef.current;
        const svg = stage && stage.querySelector ? stage.querySelector('svg') : null;
        const vb = svg && svg.viewBox ? svg.viewBox.baseVal : null;
        if (!svg || !vb || !vb.width || !vb.height) return null;
        let rect = null;
        try { rect = svg.getBoundingClientRect(); } catch (err) { return null; }
        if (!rect || !rect.width || !rect.height) return null;
        const k = Math.min(rect.width / vb.width, rect.height / vb.height);
        if (!k || !isFinite(k)) return null;
        return { k: k, w: vb.width, h: vb.height };
      };

      const clampScale = (v) => Math.min(2.2, Math.max(0.6, v));

      // 滚轮缩放：原生监听，passive:false 才能 preventDefault 阻止页面/容器滚动
      useEffect(() => {
        const el = stageRef.current;
        if (!el || typeof el.addEventListener !== 'function') return undefined;
        const onWheel = (e) => {
          if (!e.deltaY) return;
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.1 : 0.9;
          setViewScale((prev) => clampScale(prev * factor));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
      }, [full]);

      // 拖拽平移：按下后在 window 上跟随，松手/取消结束
      useEffect(() => {
        if (!viewDrag) return undefined;
        const onMove = (e) => {
          const p = panRef.current;
          if (!p) return;
          const dx = e.clientX - p.x;
          const dy = e.clientY - p.y;
          if (!p.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) p.moved = true;
          if (!p.moved) return;
          const m = stageMetrics();
          const k = m ? m.k : 1;
          const limX = m ? m.w * 0.9 : 3000;
          const limY = m ? m.h * 0.9 : 3000;
          setViewOffset({
            x: Math.max(-limX, Math.min(limX, p.ox + dx / k)),
            y: Math.max(-limY, Math.min(limY, p.oy + dy / k)),
          });
        };
        const onUp = () => {
          const p = panRef.current;
          if (p && p.moved) suppressRef.current = true;
          panRef.current = null;
          setViewDrag(false);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
        };
      }, [viewDrag]);

      const onStageDown = (e) => {
        if (e && e.button !== 0) return;
        suppressRef.current = false;
        panRef.current = { x: e.clientX, y: e.clientY, ox: viewOffset.x, oy: viewOffset.y, moved: false };
        setViewDrag(true);
      };

      const onStageDoubleClick = (e) => {
        const t = e ? e.target : null;
        if (t && typeof t.closest === 'function' && t.closest('[data-tag="1"]')) return;
        setViewScale(1);
        setViewOffset({ x: 0, y: 0 });
      };

      const onStageOpen = (a) => {
        if (suppressRef.current) { suppressRef.current = false; return; }
        if (a && (a.sessionId || a.id)) openSession(a.sessionId || a.id);
      };

      if (full) {
        const kidsOf = new Map();
        for (const o of ordered) {
          if (o.depth !== 1) continue;
          const pid = o.agent.parent;
          if (!pid) continue;
          const bucket = kidsOf.get(pid) || [];
          bucket.push(o.agent);
          kidsOf.set(pid, bucket);
        }
        const leaders = ordered.filter((o) => o.depth === 0).map((o) => o.agent);
        leaders.sort((p1, q1) => (q1.status === 'RUNNING' ? 1 : 0) - (p1.status === 'RUNNING' ? 1 : 0));
        const COLS = 4;
        const seats = [];
        let cursor = { row: 0, col: 0 };
        const place = (agent) => {
          seats.push({ agent, row: cursor.row, col: cursor.col });
          cursor.col += 1;
          if (cursor.col >= COLS) { cursor.col = 0; cursor.row += 1; }
        };
        leaders.forEach(place);
        if (cursor.col !== 0) { cursor.col = 0; cursor.row += 1; }
        const orphans = [];
        for (const [pid, kids] of kidsOf) {
          if (!leaders.some((a) => (a.id || a.sessionId) === pid)) orphans.push.apply(orphans, kids);
        }
        const childSeats = [];
        for (const lead of leaders) {
          const kids = kidsOf.get(lead.id || lead.sessionId) || [];
          for (const k of kids) childSeats.push(k);
        }
        childSeats.concat(orphans).forEach(place);
        return h('div', { className: 'fg-root fg-full' }, [
          h('div', { className: 'fg-full-head', key: 'head' }, [
            h('span', { className: 'fg-full-title', key: 't' }, 'Agent Floor'),
            h('span', { className: 'fg-full-sub', key: 's' }, leaderCount + ' 位组长 · ' + agents.length + ' 位工程师 · ' + running + ' 人在干活'),
            h('span', {
              className: 'fg-full-sub',
              key: 'hint',
              style: { opacity: 0.42, marginLeft: 6 },
              title: '滚轮缩放 · 按住拖动平移 · 双击空白复位',
            }, Math.round(viewScale * 100) + '%'),
            h('button', { className: 'fg-icon', key: 'x', style: { marginLeft: 'auto' }, onClick: () => setFull(false), title: '关闭' }, '✕'),
          ]),
          h('div', {
            className: 'fg-stage',
            key: 'stage',
            ref: stageRef,
            style: { cursor: viewDrag ? 'grabbing' : 'grab', userSelect: viewDrag ? 'none' : undefined },
            onPointerDown: onStageDown,
            onDoubleClick: onStageDoubleClick,
            title: '滚轮缩放 · 按住拖动平移 · 双击空白复位',
          }, seats.length
            ? h(IsoFloor, { seats, onOpen: onStageOpen, scale: viewScale, offset: viewOffset })
            : h('div', { className: 'fg-empty' }, '还没有工程师上岗')),
        ]);
      }

      if (!open) {
        return h('div', { className: 'fg-root' },
          h('button', { className: 'fg-pill', onClick: () => setOpen(true), title: '打开 Agent Floor' }, [
            h('span', { className: 'fg-dot' + (running ? ' fg-dot-live' : ''), key: 'd' }),
            h('span', { key: 't' }, '工位 ' + agents.length + ' 人'),
            running ? h('span', { key: 'r' }, '· ' + running + ' 在干活') : null,
          ].filter(Boolean)));
      }

      const style = pos
        ? { left: pos.x + 'px', top: pos.y + 'px', bottom: 'auto', cursor: dragging ? 'grabbing' : undefined }
        : undefined;

      return h('div', {
        className: 'fg-root fg-panel' + (dragging ? ' fg-dragging' : ''),
        ref: panelRef,
        style,
      }, [
        h('div', {
          className: 'fg-head',
          key: 'head',
          onPointerDown: onDragStart,
          onPointerMove: onDragMove,
          onPointerUp: onDragEnd,
          onPointerCancel: onDragEnd,
          title: '拖动标题栏可移动',
        }, [
          h('span', { className: 'fg-dot' + (running ? ' fg-dot-live' : ''), key: 'd' }),
          h('span', { className: 'fg-title', key: 't' }, 'Agent Floor'),
          h('span', { className: 'fg-count', key: 'c' }, running + ' 在干活 / ' + agents.length + ' 在岗'),
          h('button', {
            className: 'fg-icon',
            key: 'a',
            onClick: () => setOnlyActive((v) => !v),
            title: onlyActive ? '显示全部工程师' : '只显示在干活的',
            style: onlyActive ? { color: 'var(--dsw-alias-state-success-primary,#22c55e)', opacity: 1 } : undefined,
          }, '●'),
          h('button', { className: 'fg-icon', key: 'f', onClick: () => setFull(true), title: '上帝视角' }, '⛶'),
          h('button', { className: 'fg-icon', key: 'x', onClick: () => setOpen(false), title: '收起' }, '⌄'),
        ]),
        h('div', { className: 'fg-list', key: 'list' }, visible.length
          ? visible.map((o) => h(AgentRow, {
            key: (o.agent.id || o.agent.sessionId) + ':' + o.depth,
            a: o.agent,
            depth: o.depth,
            kidCount: ordered.filter((x) => x.depth === 1 && x.agent.parent === (o.agent.id || o.agent.sessionId)).length,
          }))
          : h('div', { className: 'fg-empty' }, onlyActive ? '现在没人干活' : '还没有工程师上岗')),
      ]);
    }

    const inject = ['slots'];

    function apply(ctx) {
      moduleCtx = ctx;
      installStyle();
      const mount = (ready) => {
        const target = ready && ready.slots ? ready : ctx;
        const slots = target.slots;
        if (!slots) return;
        const render = () => {
          slots.inject('shell.overlay', () => slots.register({
            name: 'shell.overlay',
            id: 'dsh-agent-floor',
            order: 940,
            label: 'Agent Floor',
          }, (props) => h(FloorDock, props)));
        };
        if (typeof target.effect === 'function') target.effect(render, 'dsh-agent-floor: mounts');
        else render();
      };
      if (typeof ctx.inject === 'function') {
        ctx.inject(['slots'], mount);
        return;
      }
      if (ctx.slots) mount(ctx);
    }

    return { inject, apply };
  },
});

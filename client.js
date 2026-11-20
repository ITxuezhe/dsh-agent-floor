window.__ModuleLoader__.load({
  id: 'dsh-agent-floor',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useRef } = React;

    const inject = ['slots'];
    const ROUTE = '/dsh-agent-floor/state';
    const OPEN_KEY = 'dsh.agent-floor.open';
    const CHILD_TTL = 10 * 60 * 1000;
    const MAX_ROWS = 8;

    const CSS = `
.fg-root{position:fixed;left:14px;bottom:14px;z-index:60;pointer-events:auto;
  font:12px/1.5 ui-sans-serif,-apple-system,"SF Pro Text","PingFang SC",system-ui,sans-serif;
  color:var(--dsw-alias-label-primary,#1c1c1e);}
.fg-dock{min-width:196px;max-width:340px;border-radius:12px;overflow:hidden;
  background:var(--dsw-alias-bg-overlay,#fff);
  border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.09));
  box-shadow:0 8px 28px rgba(0,0,0,.12);}
.fg-head{display:flex;align-items:center;gap:7px;padding:7px 10px;cursor:pointer;
  user-select:none;-webkit-user-select:none;}
.fg-head:hover{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.03));}
.fg-pulse{width:7px;height:7px;border-radius:50%;flex:0 0 auto;
  background:var(--dsw-alias-state-idle-primary,#9aa0a6);}
.fg-pulse.on{background:var(--dsw-alias-state-success-primary,#1a9b4e);
  animation:fg-breathe 1.6s ease-in-out infinite;}
@keyframes fg-breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}
.fg-sum{font-weight:600;letter-spacing:.1px;white-space:nowrap;}
.fg-sum i{font-style:normal;font-weight:500;opacity:.55;}
.fg-caret{margin-left:auto;opacity:.45;font-size:11px;}
.fg-body{max-height:280px;overflow:auto;
  border-top:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.07));}
.fg-row{display:grid;grid-template-columns:9px 1fr auto;gap:2px 7px;
  padding:6px 10px;cursor:pointer;align-items:center;}
.fg-row:hover{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.035));}
.fg-dot{width:7px;height:7px;border-radius:50%;
  background:var(--dsw-alias-state-idle-primary,#c2c6cc);}
.fg-dot.run{background:var(--dsw-alias-state-success-primary,#1a9b4e);}
.fg-dot.wait{background:var(--dsw-alias-state-warn-primary,#e0a72e);}
.fg-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;}
.fg-name em{font-style:normal;font-weight:500;opacity:.5;font-size:11px;margin-left:5px;}
.fg-num{font-variant-numeric:tabular-nums;opacity:.6;white-space:nowrap;font-size:11px;}
.fg-file{grid-column:2 / 4;font-size:11px;opacity:.5;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;}
.fg-more{grid-column:1 / 4;padding:5px 10px;font-size:11px;opacity:.5;}
`;

    function ensureStyle() {
      if (typeof document === 'undefined' || !document.head) return;
      if (document.getElementById('fg-style')) return;
      const el = document.createElement('style');
      el.id = 'fg-style';
      el.textContent = CSS;
      document.head.appendChild(el);
    }

    function num(n) {
      if (!n) return '0';
      if (n < 1000) return String(n);
      if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0) + 'k';
      return (n / 1e6).toFixed(1) + 'M';
    }

    function ago(t) {
      if (!t) return '';
      const s = Math.max(0, Math.round((Date.now() - t) / 1000));
      if (s < 60) return s + '秒前';
      if (s < 3600) return Math.round(s / 60) + '分钟前';
      return Math.round(s / 3600) + '小时前';
    }

    function useFloor(open, initial) {
      const [data, setData] = useState(() => initial || null);
      useEffect(() => {
        let alive = true;
        let timer = null;
        const tick = () => {
          Promise.resolve()
            .then(() => fetch(ROUTE, { headers: { accept: 'application/json' } }))
            .then((r) => (r && r.ok ? r.json() : null))
            .then((d) => { if (alive && d) setData(d); })
            .catch(() => {})
            .then(() => { if (alive) timer = setTimeout(tick, open ? 2000 : 6000); });
        };
        tick();
        return () => { alive = false; if (timer) clearTimeout(timer); };
      }, [open]);
      return data;
    }

    function deriveAgents(data) {
      if (!data) return [];
      const rows = Array.isArray(data.sessions) ? data.sessions : null;
      const now = Date.now();
      const list = rows ? rows.map((s) => ({
        id: s.id,
        name: s.title || s.cwd || s.id,
        parent: s.parent || null,
        status: s.running ? 'RUNNING' : (now - (s.updatedAt || 0) < 300000 ? 'STANDBY' : 'IDLE'),
        step: s.step || 0,
        turn: s.turn || 0,
        tools: s.toolCalls || 0,
        tokens: (s.tokensIn || 0) + (s.tokensOut || 0),
        tool: s.lastTool || null,
        forked: !!(data.focus && s.id === data.focus),
        files: (Array.isArray(s.diffFiles) && s.diffFiles.length)
          ? s.diffFiles.slice(0, 4).map((f) => ({ name: String(f).split('/').pop(), write: true }))
          : (Array.isArray(s.files) ? s.files : []),
        updatedAt: s.updatedAt || 0,
      })) : [];

      const seen = new Map();
      for (const a of list) seen.set((a.name || '').trim(), (seen.get((a.name || '').trim()) || 0) + 1);
      for (const a of list) {
        if (seen.get((a.name || '').trim()) > 1) {
          a.name = a.name + ' · ' + String(a.id || '').slice(-4);
        }
      }

      const live = list.filter((a) => {
        if (!a.parent) return true;
        if (a.status === 'RUNNING') return true;
        return now - (a.updatedAt || 0) < CHILD_TTL;
      });

      const rank = (a) => (a.status === 'RUNNING' ? 0 : a.status === 'STANDBY' ? 1 : 2);
      const byId = new Map(live.map((a) => [a.id, a]));
      const leaders = live.filter((a) => !a.parent || !byId.has(a.parent));
      leaders.sort((x, y) => rank(x) - rank(y) || (y.updatedAt || 0) - (x.updatedAt || 0));

      const out = [];
      for (const lead of leaders) {
        const kids = live.filter((a) => a.parent === lead.id);
        kids.sort((x, y) => rank(x) - rank(y) || (y.updatedAt || 0) - (x.updatedAt || 0));
        out.push({ ...lead, depth: 0, kids: kids.length });
        for (const k of kids) out.push({ ...k, depth: 1, kids: 0 });
      }
      return out;
    }

    function fileLine(a) {
      const files = (a.files || []).slice(0, 3).map((f) => (f.write ? '改 ' : '') + f.name);
      if (files.length) return files.join('  ·  ');
      if (a.tool && a.tool.name) {
        const target = String(a.tool.target || '').split('/').pop();
        return a.tool.name + (target ? ' · ' + target : '');
      }
      return '';
    }

    function MonitorRow(props) {
      const a = props.agent;
      const cls = 'fg-dot ' + (a.status === 'RUNNING' ? 'run' : a.status === 'STANDBY' ? 'wait' : '');
      const shot = fileLine(a);
      return h('div', { className: 'fg-row', onClick: () => props.onOpen(a) }, [
        h('span', { className: cls, key: 'dot' }),
        h('span', { className: 'fg-name', key: 'name' }, [
          a.depth ? '↳ ' : '',
          a.name || '未命名',
          a.depth ? null : (a.kids ? h('em', { key: 'k' }, '带队 ' + a.kids) : null),
        ]),
        h('span', { className: 'fg-num', key: 'num' },
          '第' + a.step + '步·第' + a.turn + '轮 · ' + num(a.tokens) + ' tok'),
        shot ? h('span', { className: 'fg-file', key: 'file' }, shot) : null,
      ]);
    }

    function MonitorBar(props) {
      const ctx = (props && props.ctx) || null;
      const [open, setOpen] = useState(() => {
        try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
      });
      const data = useFloor(open, props && props.initialData);
      const agents = deriveAgents(data);
      const running = agents.filter((a) => a.status === 'RUNNING').length;
      const shown = agents.slice(0, MAX_ROWS);
      const hidden = agents.length - shown.length;

      const toggle = () => {
        const next = !open;
        setOpen(next);
        try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch {}
      };

      useEffect(() => { ensureStyle(); }, []);

      const openSession = (a) => {
        const id = a && a.id;
        if (!id) return;
        try {
          const ui = ctx && typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : null;
          if (ui && typeof ui.openSession === 'function') { ui.openSession(id); return; }
          const ses = ctx && typeof ctx.get === 'function' ? ctx.get('sessions') : null;
          if (ses && typeof ses.scope === 'function') ses.scope(id);
        } catch {}
      };

      return h('div', { className: 'fg-root' }, h('div', { className: 'fg-dock' }, [
        h('div', { className: 'fg-head', key: 'head', onClick: toggle, title: open ? '收起监控条' : '展开监控条' }, [
          h('span', { className: 'fg-pulse' + (running ? ' on' : ''), key: 'p' }),
          h('span', { className: 'fg-sum', key: 's' }, [
            running ? running + ' 在跑' : '全部空闲',
            h('i', { key: 'i' }, '  / ' + agents.length + ' 在岗'),
          ]),
          h('span', { className: 'fg-caret', key: 'c' }, open ? '⌄' : '⌃'),
        ]),
        open ? h('div', { className: 'fg-body', key: 'body' }, [
          ...shown.map((a) => h(MonitorRow, { key: a.id || a.name, agent: a, onOpen: openSession })),
          hidden > 0 ? h('div', { className: 'fg-more', key: 'more' }, '还有 ' + hidden + ' 个会话') : null,
          agents.length === 0 ? h('div', { className: 'fg-more', key: 'empty' }, '暂无会话') : null,
        ]) : null,
      ]));
    }

    function apply(ctx) {
      const bridge = (ready) => {
        const target = ready && ready.slots ? ready : ctx;
        const slots = target && target.slots;
        if (!slots) return;
        const render = () => {
          slots.inject('shell.overlay', () => slots.register({
            name: 'shell.overlay',
            id: 'dsh-agent-floor',
            order: 940,
            label: 'Agent Floor',
          }, () => h(MonitorBar, { ctx })));
        };
        if (typeof target.effect === 'function') target.effect(render, 'dsh-agent-floor: mounts');
        else render();
      };
      if (typeof ctx.inject === 'function') {
        ctx.inject(['slots'], bridge);
        return;
      }
      if (ctx.slots) bridge(ctx);
    }

    return { inject, apply, __dshTest: { deriveAgents, MonitorBar, MonitorRow } };
  },
});

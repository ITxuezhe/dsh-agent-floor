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
.fg-root{font:11.5px/1.45 ui-sans-serif,-apple-system,"SF Pro Text","PingFang SC",system-ui,sans-serif;
  color:var(--dsw-alias-label-primary,#1c1c1e);}
.fg-chip{display:flex;align-items:center;gap:6px;width:100%;padding:5px 8px;
  border:0;border-radius:8px;background:transparent;cursor:pointer;
  font:inherit;color:inherit;text-align:left;}
.fg-chip:hover{background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.04));}
.fg-pulse{width:7px;height:7px;border-radius:50%;flex:0 0 auto;
  background:var(--dsw-alias-state-idle-primary,#9aa0a6);}
.fg-pulse.on{background:var(--dsw-alias-state-success-primary,#1a9b4e);
  animation:fg-breathe 1.6s ease-in-out infinite;}
@keyframes fg-breathe{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.82)}}
.fg-chip.rail{justify-content:center;padding:5px 4px;gap:4px;}
.fg-rail-num{font-weight:600;font-variant-numeric:tabular-nums;font-size:11px;}
.fg-sum{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fg-sum i{font-style:normal;font-weight:500;opacity:.55;}
.fg-panel{position:fixed;left:12px;bottom:64px;z-index:61;width:290px;max-height:min(420px,60vh);
  overflow:auto;border-radius:12px;padding:4px;
  background:var(--dsw-alias-bg-overlay,#fff);
  border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.09));
  box-shadow:0 10px 30px rgba(0,0,0,.14);
  font:12px/1.5 ui-sans-serif,-apple-system,"SF Pro Text","PingFang SC",system-ui,sans-serif;
  color:var(--dsw-alias-label-primary,#1c1c1e);}
.fg-panel-head{display:flex;align-items:center;gap:7px;padding:6px 8px 7px;font-weight:600;
  border-bottom:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.07));margin-bottom:4px;}
.fg-panel-head span.close{margin-left:auto;cursor:pointer;opacity:.45;font-weight:500;padding:0 3px;}
.fg-panel-head span.close:hover{opacity:.9;}
.fg-row{display:grid;grid-template-columns:9px 1fr auto;gap:2px 7px;
  padding:6px 8px;cursor:pointer;align-items:center;border-radius:8px;}
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
.fg-more{grid-column:1 / 4;padding:5px 8px;font-size:11px;opacity:.5;}
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

    // One shared poller for every mount point, so the chip and the panel never
    // fetch twice and always show the same snapshot.
    const store = { open: false, data: null, subs: new Set(), timer: null, started: false };

    function readOpen() {
      try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
    }

    function setOpen(next) {
      store.open = next;
      try { localStorage.setItem(OPEN_KEY, next ? '1' : '0'); } catch {}
      notify();
    }

    function notify() {
      store.subs.forEach((fn) => { try { fn(); } catch {} });
    }

    function startPolling() {
      if (store.started) return;
      store.started = true;
      const tick = () => {
        Promise.resolve()
          .then(() => fetch(ROUTE, { headers: { accept: 'application/json' } }))
          .then((r) => (r && r.ok ? r.json() : null))
          .then((d) => { if (d) { store.data = d; notify(); } })
          .catch(() => {})
          .then(() => { store.timer = setTimeout(tick, store.open ? 2000 : 6000); });
      };
      tick();
    }

    function useStore() {
      const [, bump] = useState(0);
      useEffect(() => {
        const fn = () => bump((v) => v + 1);
        store.subs.add(fn);
        startPolling();
        return () => { store.subs.delete(fn); };
      }, []);
      return store;
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

    function openSession(ctx, a) {
      const id = a && a.id;
      if (!id) return;
      try {
        const ui = ctx && typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : null;
        if (ui && typeof ui.openSession === 'function') { ui.openSession(id); return; }
        const ses = ctx && typeof ctx.get === 'function' ? ctx.get('sessions') : null;
        if (ses && typeof ses.scope === 'function') ses.scope(id);
      } catch {}
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

    /** Sidebar-foot chip: always visible, one line, no overlay over the page. */
    function FloorChip(props) {
      const ctx = (props && props.ctx) || null;
      const s = useStore();
      const agents = deriveAgents(s.data);
      const running = agents.filter((a) => a.status === 'RUNNING').length;
      useEffect(() => { ensureStyle(); }, []);
      const rail = props && props.wide === false;
      const label = agents.length === 0
        ? '暂无会话'
        : (running ? running + ' 在跑' : '全部空闲') + ' / ' + agents.length + ' 在岗';
      return h('div', { className: 'fg-root' },
        h('button', {
          className: 'fg-chip' + (rail ? ' rail' : ''),
          type: 'button',
          title: label + ' · 点开看详情',
          onClick: () => setOpen(!s.open),
        }, [
          h('span', { className: 'fg-pulse' + (running ? ' on' : ''), key: 'p' }),
          rail ? (running ? h('span', { className: 'fg-rail-num', key: 'n' }, String(running)) : null)
            : h('span', { className: 'fg-sum', key: 's' }, label),
        ]));
    }

    /** Frame-wide panel, only mounted while open; anchored above the chip. */
    function FloorPanel(props) {
      const ctx = (props && props.ctx) || null;
      const s = useStore();
      const agents = deriveAgents(s.data);
      const running = agents.filter((a) => a.status === 'RUNNING').length;
      const shown = agents.slice(0, MAX_ROWS);
      const hidden = agents.length - shown.length;
      const ref = useRef(null);

      useEffect(() => { ensureStyle(); }, []);

      useEffect(() => {
        if (!s.open) return undefined;
        const onDown = (e) => {
          const el = ref.current;
          if (el && e && e.target && el.contains && el.contains(e.target)) return;
          setOpen(false);
        };
        const onKey = (e) => { if (e && e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('pointerdown', onDown, true);
          document.removeEventListener('keydown', onKey);
        };
      }, [s.open]);

      if (!s.open) return null;

      return h('div', { className: 'fg-panel', ref }, [
        h('div', { className: 'fg-panel-head', key: 'head' }, [
          h('span', { className: 'fg-pulse' + (running ? ' on' : ''), key: 'p' }),
          h('span', { key: 't' }, running ? running + ' 个在跑' : '全部空闲'),
          h('span', { key: 'n', style: { opacity: .5, fontWeight: 500 } }, '共 ' + agents.length + ' 个会话'),
          h('span', { className: 'close', key: 'x', onClick: () => setOpen(false), title: '关闭' }, '✕'),
        ]),
        ...shown.map((a) => h(MonitorRow, { key: a.id || a.name, agent: a, onOpen: (x) => openSession(ctx, x) })),
        hidden > 0 ? h('div', { className: 'fg-more', key: 'more' }, '还有 ' + hidden + ' 个会话') : null,
        agents.length === 0 ? h('div', { className: 'fg-more', key: 'empty' }, '暂无会话') : null,
      ]);
    }

    function apply(ctx) {
      const bridge = (ready) => {
        const target = ready && ready.slots ? ready : ctx;
        const slots = target && target.slots;
        if (!slots) return;
        const register = (name, id, order, label, Comp) => {
          slots.inject(name, () => slots.register({ name, id, order, label }, (props) => h(Comp, { ...props, ctx })));
        };
        const render = () => {
          store.open = readOpen();
          // Chip lives in the sidebar foot next to Settings — out of the content area.
          register('sidebar.footer.action', 'dsh-agent-floor', 10, 'Agent Floor', FloorChip);
          // Panel is frame-wide so the sidebar can never clip it.
          register('shell.overlay', 'dsh-agent-floor.panel', 940, 'Agent Floor', FloorPanel);
        };
        if (typeof target.effect === 'function') target.effect(render, 'dsh-agent-floor: mounts');
        else render();
      };
      if (ctx && typeof ctx.inject === 'function') ctx.inject(['slots'], bridge);
      else bridge(ctx);
    }

    return {
      inject,
      apply,
      __dshTest: { deriveAgents, FloorChip, FloorPanel, MonitorRow, store },
    };
  },
});

# 自检工具

改 `client.js` / `index.js` 的 UI 后，用这三条命令在没有 DSH、没有浏览器的情况下自检：

```bash
node scripts/harness.js
node scripts/render.js
python3 scripts/raster.py
```

三条命令都没有 npm 依赖（Node 22+ 与系统 `python3` + Pillow 即可），也不需要启动或重载 DSH。

## 1. `node scripts/harness.js`

把 `client.js` 放进一个最小宿主里跑一遍：桩掉 `window.__ModuleLoader__`、`React`、`document`、`localStorage`、`fetch`，
然后

1. 加载 `client.js` 并调用 `apply()`，确认它会往 `shell.overlay` 注册组件；
2. 真的调用一次注册出来的 `FloorDock`（跑一遍所有 hooks、effect）；
3. 用 5 个假 agent 调 `IsoFloor`，确认场景 SVG 能画出来、`deriveAgents` 能排出子代理层级。

成功时最后一行固定是 `render ok`（exit 0），失败时打印堆栈并 exit 1。

- 可选参数：`node scripts/harness.js /path/to/client.js`。
- 失败先看：
  - `client.js: 找不到 return { inject, apply };` → 导出语句被改了，同步修改 `harness.js` / `render.js` 顶部的 `EXPORT_RE`；
  - `unexpected require("...")` → 客户端新增了 npm 依赖，需要给 harness 的 `React` 桩补上对应导出；
  - 堆栈指向 `useState called outside a component render` → 组件在 `apply()` 之外被调用，或渲染器需要支持新的 hook（目前只桩了 `useState/useRef/useEffect`）。

## 2. `node scripts/render.js`

同样的宿主桩，用 5 个假 agent（1 个 RUNNING 组长、1 个带 `parent` 的子代理、其余 IDLE，每个都带 `tool` / `files` 字段）
渲染 `IsoFloor`，把 React 元素树序列化成静态 SVG：

```
scripts/out/iso.svg
```

目录会自动创建。所有 `var(--dsw-*)` 会替换成主题兜底色，所以产物是**浅色皮肤**快照。
生成后会自检：agent 数 / RUNNING 数 / 子代理层级 / SVG 字节数（> 5000），任何一项不对就 exit 1。

- 可选参数：`node scripts/render.js [clientPath] [outPath]`。
- 失败先看：
  - `还有 var(--*) 没兜底色` → `client.js` 新增的颜色变量没有写 fallback，补一个 `var(--dsw-xxx, #hex)`；
  - `生成的 SVG 只有 N 字节` → `IsoFloor` 没渲染出东西（props 形状或 `seats` 计算变了），先跑 `harness.js` 定位；
  - 鼠标悬停等交互态不会出现在快照里，这是静态序列化的预期行为。

## 3. `python3 scripts/raster.py`

Pillow 写的极简 SVG → PNG 光栅化器，是**唯一**不打开 DSH 就能看画面的手段：

```
scripts/out/iso.svg  →  scripts/out/iso.png   （默认路径，可省略参数）
python3 scripts/raster.py in.svg out.png
```

支持 `polygon` / `rect` / `circle` / `line` / `text` / `path`（二次贝塞尔）、
`translate/scale/matrix/rotate` 变换，以及 hex / `hsl()` / `rgba()` / `color-mix()` 颜色。
只跳过 `animateMotion` 这类动画节点的直属父级（小人传送动画不会出现在静帧里）。

- 失败先看：
  - `ModuleNotFoundError: No module named 'PIL'` → `python3 -m pip install pillow`；
  - `ParseError: unbound prefix` → SVG 里出现了 `xlink:` 等未声明前缀，检查 `render.js` 的属性映射；
  - 画面空白/错位 → 多半是某个 `transform` 复合写法没被解析，或整棵节点被误判成动画节点；
  - 字体和真实 DSH 有差异（fallback 到 Hiragino / PingFang / DejaVu），只用于看布局和配色，不是像素级还原。

## 提示

- 只读检查：三个脚本都只读 `client.js` 并在内存里改写导出语句，不会落盘改客户端代码。
- 改完 `client.js` 后不用重启 DSH：到插件设置里把 Agent Floor 关一次再开，即完成热重载。

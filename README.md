# Agent Floor · 工位视图

给 DeepSeek Harness 加一个「上帝视角」浮层：**每个会话就是一位像素工程师**，坐在等距工位房间里，
名牌上实时显示状态、第几步、第几轮、多少次工具、改了哪些文件；点名牌直接跳到那个会话。

- 左下角胶囊：`工位 N 人 · M 在干活`
- 点开是值班名单（主工程师 / 组长带队 N 人 / 子工程师）
- `⛶` 进等距工位房间：滚轮缩放（0.6–2.2）、按住拖动、双击复位
- 子代理会从工位走向组长的工位（虚线 + 动画），表示"在传话"

## 安装

### 从插件市场（推荐）

1. 设置 → 插件市场 → 索引源，添加：
   `https://raw.githubusercontent.com/ITxuezhe/dsh-agent-floor/main/market/index.json`
2. 在发现页找到 **Agent Floor**，点安装，然后刷新页面（⌘⇧R）。

### 手动安装

```bash
dsh plugin install dsh-agent-floor            # npm
# 或从源码目录
dsh plugin install file:/path/to/dsh-agent-floor
```

装完切一次插件开关（关掉再打开），再 ⌘⇧R 刷新页面。

## 数据从哪来

插件挂的是官方插槽 `shell.overlay`，客户端每 1.8 秒（面板收起时 7 秒）拉一次只读路由
`GET /dsh-agent-floor/state`；Host 半监听会话事件折叠成快照：

- `status`：会话在跑，或 45 秒内有动静 → RUNNING；5 分钟内 → STANDBY；否则 IDLE
- `diffFiles`：按会话 cwd 跑 `git status --porcelain`（10 秒缓存，非 git 仓库返回空）
- 子代理靠 `parentSession` 归到组长名下；空闲超过 10 分钟的子工程师自动淡出

## 自检工具

界面改动可以脱离 DSH 自检：`scripts/` 下有 `harness.js`（加载 `client.js`、走一遍 `apply()` 并真实渲染 `FloorDock` 与 `IsoFloor`）、
`render.js`（假数据渲染成 `scripts/out/iso.svg`）和 `raster.py`（SVG → PNG，Pillow）。

```bash
node scripts/harness.js      # 渲染自检，成功打印 render ok，exit 0
node scripts/render.js       # 生成 scripts/out/iso.svg（浅色皮肤快照）
python3 scripts/raster.py    # 生成 scripts/out/iso.png，肉眼确认布局
```

详见 [scripts/README.md](scripts/README.md)。

## 皮肤与重载

- **深色 / 浅色皮肤都自适应**：所有颜色都来自 `--dsw-*` 主题 token（`var(--dsw-alias-*, fallback)`），
  不写死任何一套配色；切换 DSH 的深浅色皮肤时组件会自动跟随。
- **插件热重载**：改完 `client.js` / `index.js` 后不用重启 DSH，到插件设置里把 Agent Floor
  开关切一次（关掉再打开）即可加载新代码。

## 局限

- 只有从 Git 提交安装的副本能"一键更新"；本地目录安装的副本需要卸载重装。
- 面板是只读观察器：不能从面板里派活或打断会话。
- 非 git 工作区看不到真实改动文件，只能显示工具调用推断出的文件名。

## License

MIT

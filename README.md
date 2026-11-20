# Agent Floor · 常驻监控条

给 DeepSeek Harness 左下角挂一条**常驻监控条**：不用开标签页，随时能瞄一眼哪个会话在跑、跑到第几步、烧了多少 token、改了哪些文件。

DSH 自带的「任务管理」页已经能看到 agent 树和后台任务，但它是**按会话打开的标签页**，而且没有步/轮/token/改动文件这些指标。这个插件只补这块，不重复画树。

## 长什么样

- **收起**：`● 2 在跑 / 5 在岗`（有会话在跑时圆点呼吸）
- **点开**：每个会话一行 —— 状态点、名字（组长带 `带队 N`）、`第N步·第T轮 · 12.3k tok`、正在跑的 `bash · pnpm run build` 或 `改 client.js · index.js`
- 点任意一行 → 跳到那个会话

## 装

```bash
dsh plugin install dsh-agent-floor          # npm，0.2.0+
```

或加市场索引源：`https://raw.githubusercontent.com/ITxuezhe/dsh-agent-floor/main/market/index.json`

装完刷新页面（⌘⇧R）。

## 数据从哪来

插件挂官方插槽 `shell.overlay`，客户端每 2 秒（收起时 6 秒）拉一次只读路由 `GET /dsh-agent-floor/state`。
Host 半监听会话事件折叠成快照，并按会话 cwd 跑 `git status --porcelain`（10 秒缓存、失败降级为空）拿真实改动文件。

- 状态：`running` 或 45 秒内有动静 → RUNNING；5 分钟内 → STANDBY；否则 IDLE
- 子代理靠 `parentSession` 归到组长名下，空闲超过 10 分钟自动淡出
- 展开/收起状态存在 localStorage `dsh.agent-floor.open`

## 自检

```bash
node scripts/harness.js     # 桩宿主环境、真渲染一次，成功打印 render ok
```

详见 [scripts/README.md](scripts/README.md)。

## 皮肤与重载

- 颜色全部来自 `--dsw-*` 主题 token，深浅色皮肤自动跟随。
- 改完代码到插件设置里把开关切一次即可热重载，不用重启 DSH。

## License

MIT

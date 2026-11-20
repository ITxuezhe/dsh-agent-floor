# 自检脚本

改 `client.js` 之后，不用开浏览器就能验证它没炸。

```bash
node scripts/harness.js              # 默认检查 ../client.js
node scripts/harness.js path/to.js   # 检查别的构建产物
```

它做四件事：

1. 桩掉 `window.__ModuleLoader__` / `React` / `document` / `localStorage` / `fetch`，
2. 真的执行 `client.js`，走一遍 `apply()` 的 `ctx.inject(['slots'])` → `slots.register('shell.overlay', …)` 链路，
3. 把注册出来的 **MonitorBar** 真渲染一次（带假会话数据），再单独渲染一行 **MonitorRow**，
4. 顺带验证 `deriveAgents` 的分组与排序（子代理挂到组长后面、depth=1）。

成功时末行固定打印 `render ok` 并以 0 退出；失败打印堆栈、退出码 1。

常见失败：

- `client.js 没有调用 window.__ModuleLoader__.load(...)` —— 文件头被改坏了。
- `apply() 没有注册任何组件到 shell.overlay` —— `inject`/`apply` 链路断了。
- `MonitorBar 顶层不是 div` / `缺少 fg-* className` —— 组件根节点被换了。
- `ReferenceError: xxx is not defined` —— 改代码时删掉了函数还在被引用（`node --check` 查不出来这种）。

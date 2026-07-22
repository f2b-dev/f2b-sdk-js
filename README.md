# @f2b/sdk · f2b-sdk-js

灵境云官方 **TypeScript / JavaScript** SDK：创建沙箱 → 命令 → 文件 → 销毁。

## 安装（开发期）

```bash
# 与 f2b-spec 同级克隆时
pnpm add @f2b/sdk@file:../f2b-sdk-js
# 或发布后
# pnpm add @f2b/sdk
```

## 60 秒 quickstart

先启动 [f2b-sandbox](https://github.com/f2b-dev/f2b-sandbox)：

```bash
cd ../f2b-sandbox && F2B_SANDBOX_BACKEND=fake pnpm dev
# → http://127.0.0.1:13287
```

```ts
import { F2bClient, Sandbox } from "@f2b/sdk";

const client = new F2bClient({
  baseUrl: "http://127.0.0.1:13287", // 直连产品 API /v1
  // apiKey: "lj_...",               // 鉴权就绪后
});

const sbx = await Sandbox.create(client, { template: "base" });
const { stdout } = await sbx.run("echo hello");
console.log(stdout);

await sbx.write("/home/user/a.txt", "ok");
console.log(await sbx.read("/home/user/a.txt"));
await sbx.kill();

const usage = await client.getUsage(7);
console.log(usage.totalSandboxHours, usage.totalCommands);
```

本仓：

```bash
pnpm install
pnpm typecheck
pnpm smoke    # 需 :13287 已启动
pnpm example
```

## API 路径

| 配置 | 用途 |
|------|------|
| `baseUrl: http://127.0.0.1:13287`（默认 `pathPrefix: "/v1"`） | 直连 **f2b-sandbox** |
| `baseUrl: http://127.0.0.1:13200` + 若 BFF 将来暴露 `/v1` | 经控制台同源 |
| `pathPrefix: "/api"` | 兼容旧式 `/api/sandboxes` 代理 |

浏览器控制台请走 **f2b-web BFF**，不要在前端塞管理密钥。SDK 适合 **Node / 服务端 / Agent 运行时**。

## 导出

- `F2bClient` / `LingjingClient`（别名）— `listSandboxes` / `createSandbox` / `getSandbox` / `getUsage` / `listTemplates` / 隧道
- `Sandbox` — `run` / **`runStream`**（SSE）/ `write` / `read` / `listFiles` / **`deleteFile`** / `pause` / `resume` / **`update`**（PATCH timeout/metadata）/ `kill`
- `F2bError` / `ErrorCode` / `CommandStreamEvent` / `UsageSummary` 等（来自 `@f2b/spec`）

## 相关

- 契约：https://github.com/f2b-dev/f2b-spec  
- 沙箱服务：https://github.com/f2b-dev/f2b-sandbox  
- 组织：https://github.com/f2b-dev  

Apache-2.0

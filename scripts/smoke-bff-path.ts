/**
 * 兼容旧 BFF 路径：pathPrefix=/api → 请求 /api/sandboxes*（由 f2b-web 代理到 /v1）。
 *
 * 需 f2b-web 已启动（默认 :13200），且 BFF 可连 sandbox：
 *   F2B_BFF_URL=http://127.0.0.1:13200 pnpm smoke:bff
 *
 * 无 web 时跳过（exit 0）—— 本地仅 sandbox 时不失败。
 */
import { F2bClient, Sandbox } from "../src/index";

const bffUrl = process.env.F2B_BFF_URL ?? "http://127.0.0.1:13200";

async function main() {
  try {
    const h = await fetch(`${bffUrl}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!h.ok) {
      console.log("SKIP smoke:bff — BFF /api/health not ok", h.status);
      return;
    }
  } catch (e) {
    console.log(
      "SKIP smoke:bff — BFF unreachable:",
      e instanceof Error ? e.message : e,
    );
    return;
  }

  const client = new F2bClient({
    baseUrl: bffUrl,
    pathPrefix: "/api",
  });
  console.log("bff", bffUrl, "pathPrefix=/api");

  const sbx = await Sandbox.create(client, {
    name: "sdk-bff-smoke",
    template: "base",
  });
  console.log("created", sbx.id);

  const { stdout, exitCode } = await sbx.run("echo bff-path-ok");
  if (exitCode !== 0 || !stdout.includes("bff-path-ok")) {
    throw new Error(`run failed: ${JSON.stringify({ exitCode, stdout })}`);
  }

  await sbx.write("/home/user/bff.txt", "via-api-prefix");
  const text = await sbx.read("/home/user/bff.txt");
  if (text !== "via-api-prefix") throw new Error("file mismatch");

  await sbx.kill();
  console.log("SDK_BFF_PATH_SMOKE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

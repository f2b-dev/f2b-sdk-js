/**
 * 直连 f2b-sandbox :8787 冒烟。需服务已启动：
 *   cd ../f2b-sandbox && F2B_SANDBOX_BACKEND=fake pnpm dev
 */
import { F2bClient, Sandbox } from "../src/index";

const baseUrl = process.env.F2B_SANDBOX_URL ?? "http://127.0.0.1:8787";

async function main() {
  const client = new F2bClient({ baseUrl });
  console.log("baseUrl", baseUrl);

  const sbx = await Sandbox.create(client, {
    name: "sdk-smoke",
    template: "base",
  });
  console.log("created", sbx.id, sbx.data.status, sbx.data.backend);

  const { stdout, exitCode } = await sbx.run("echo hello-sdk");
  console.log("run", { exitCode, stdout: stdout.trim() });
  if (exitCode !== 0 || !stdout.includes("hello-sdk")) {
    throw new Error("unexpected command result");
  }

  await sbx.write("/home/user/sdk.txt", "from-sdk");
  const content = await sbx.read("/home/user/sdk.txt");
  console.log("file", content);
  if (content !== "from-sdk") throw new Error("file mismatch");

  const entries = await sbx.listFiles("/home/user");
  console.log(
    "list",
    entries.map((e) => e.name),
  );

  const killed = await sbx.kill();
  console.log("killed", killed.status);
  if (killed.status !== "killed") throw new Error("kill failed");

  console.log("SDK_SMOKE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

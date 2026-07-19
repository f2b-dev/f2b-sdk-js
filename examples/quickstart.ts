/**
 * 60 秒 quickstart — 对接本地 f2b-sandbox
 *
 *   F2B_SANDBOX_URL=http://127.0.0.1:8787 pnpm example
 */
import { F2bClient, Sandbox } from "../src/index";

const client = new F2bClient({
  baseUrl: process.env.F2B_SANDBOX_URL ?? "http://127.0.0.1:8787",
  // apiKey: process.env.F2B_API_KEY,
});

const sbx = await Sandbox.create(client, { template: "code-interpreter" });
try {
  const r = await sbx.run('python -c "print(40+2)"');
  // Fake 后端会回显 executed；真集群才有 python
  console.log(r.stdout || r.stderr);
  await sbx.write("/home/user/out.txt", "ok");
  console.log(await sbx.read("/home/user/out.txt"));
} finally {
  await sbx.kill();
}

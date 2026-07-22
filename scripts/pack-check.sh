#!/usr/bin/env bash
# 1.0 前：本地/CI 打包审阅，**绝不** npm publish。
# 不改动工作区 package.json（在临时目录 pack）。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# 拷贝 pack 所需文件到临时目录
mkdir -p "$TMP/pkg/src"
cp "$ROOT/package.json" "$TMP/pkg/package.json"
cp "$ROOT/README.md" "$TMP/pkg/README.md"
cp "$ROOT/LICENSE" "$TMP/pkg/LICENSE"
cp -R "$ROOT/src/." "$TMP/pkg/src/"

# 临时把 file: 依赖改成版本占位，避免 tarball 绑本机路径
node <<NODE
const fs = require("node:fs");
const p = "$TMP/pkg/package.json";
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
if (pkg.dependencies?.["@f2b/spec"]?.startsWith("file:")) {
  pkg.dependencies["@f2b/spec"] = ">=0.1.0 <2";
}
// 去掉 pack:check 脚本噪音无所谓
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
NODE

cd "$TMP/pkg"
pnpm pack --pack-destination "$TMP"
TGZ=$(ls -1 "$TMP"/*.tgz | head -1)
echo "packed: $TGZ"
tar -tzf "$TGZ" | head -80
if tar -tzf "$TGZ" | grep -E '(^package/\.env|/data/|credentials|\.pem$)' >/dev/null; then
  echo "pack-check: refuse — sensitive paths" >&2
  exit 2
fi
tar -tzf "$TGZ" | grep -q 'package/src/index.ts'
# 确认工作区 package.json 仍为 file: 依赖
if ! grep -q 'file:../f2b-spec' "$ROOT/package.json"; then
  echo "pack-check: refuse — workspace package.json lost file:../f2b-spec" >&2
  exit 3
fi
echo "PACK_CHECK_OK name=@f2b/sdk"

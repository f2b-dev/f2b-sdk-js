#!/usr/bin/env bash
# 1.0 前：本地/CI 打包审阅，**绝不** npm publish。
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf .pack-check && mkdir -p .pack-check
# 临时把 file: 依赖改写为版本占位再 pack，避免 tarball 绑本机路径
node <<'NODE'
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
copyFileSync("package.json", ".pack-check/package.json.bak");
if (pkg.dependencies?.["@f2b/spec"]?.startsWith("file:")) {
  pkg.dependencies["@f2b/spec"] = ">=0.1.0 <2";
  writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
}
NODE
cleanup() {
  if [[ -f .pack-check/package.json.bak ]]; then
    mv .pack-check/package.json.bak package.json
  fi
}
trap cleanup EXIT
pnpm pack --pack-destination .pack-check
TGZ=$(ls -1 .pack-check/*.tgz | head -1)
echo "packed: $TGZ"
tar -tzf "$TGZ" | head -80
if tar -tzf "$TGZ" | grep -E '(^package/\.env|/data/|credentials|\.pem$)' >/dev/null; then
  echo "pack-check: refuse — sensitive paths" >&2
  exit 2
fi
tar -tzf "$TGZ" | grep -q 'package/src/index.ts'
echo "PACK_CHECK_OK name=@f2b/sdk"
rm -rf .pack-check

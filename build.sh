#!/bin/bash
# CloudPan 构建脚本（Linux/macOS）
set -e
cd "$(dirname "$0")"

# 纯 Go 构建（SQLite 驱动为 modernc 纯 Go 实现），便于跨发行版部署
export CGO_ENABLED=0

echo "[1/3] building frontend..."
cd web && npm run build && cd ..

echo "[2/3] embedding dist..."
rm -rf server/internal/web/dist
cp -r web/dist server/internal/web/dist
# 保留 embed 占位（.gitignore 排除 dist 内容，占位文件保证空克隆也能 go build）
touch server/internal/web/dist/.keep

echo "[3/3] building..."
cd server && go build -o cloudpan .

echo "BUILD OK: server/cloudpan"

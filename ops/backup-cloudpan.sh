#!/bin/bash
# CloudPan 数据库自动备份：mysqldump → gzip → /www/backup/database/cloudpan/
# 凭据从 env.local 读取（脚本内不含密码）；保留最近 14 份，超出自动清理。
# cron 示例：30 3 * * * /www/wwwhdd/cloudpan/ops/backup-cloudpan.sh >> /var/log/cloudpan-backup.log 2>&1
set -euo pipefail

PROJ_DIR="/www/wwwhdd/cloudpan"
ENV_FILE="$PROJ_DIR/env.local"
BACKUP_DIR="/www/backup/database/cloudpan"
KEEP=14

[ -f "$ENV_FILE" ] || { echo "[backup] 缺少 $ENV_FILE"; exit 1; }
set -a; source "$ENV_FILE"; set +a
[ "${CP_DB:-}" = "mysql" ] || { echo "[backup] CP_DB 非 mysql，跳过"; exit 0; }

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/cloudpan-$STAMP.sql.gz"

echo "[backup] $(date '+%F %T') 开始导出 ${CP_MYSQL_NAME:-cloudpan}"
mysqldump -h "${CP_MYSQL_HOST:-127.0.0.1}" -P "${CP_MYSQL_PORT:-3306}" \
  -u "${CP_MYSQL_USER:?缺少 CP_MYSQL_USER}" -p"${CP_MYSQL_PASSWORD:?缺少 CP_MYSQL_PASSWORD}" \
  --single-transaction --routines --triggers --no-tablespaces \
  "${CP_MYSQL_NAME:?缺少 CP_MYSQL_NAME}" | gzip -6 > "$OUT"

SIZE=$(stat -c %s "$OUT")
[ "$SIZE" -gt 1000 ] || { echo "[backup] 产物异常偏小($SIZE B)，请检查"; exit 1; }
echo "[backup] 完成: $OUT ($((SIZE/1024)) KB)"

ls -1t "$BACKUP_DIR"/cloudpan-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  rm -f "$old"; echo "[backup] 清理过期: $old"
done

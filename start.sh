#!/bin/bash
# ============================================================
# CloudPan 一键管理脚本
#   直接运行 ./start.sh 进入数字菜单；也支持命令行子命令
#
# 配置存于 env.local（不进 git），常用项：
#   CP_PORT                 服务端口（默认 18322）
#   CP_DATA                 数据目录（默认 <项目>/server/data）
#   CP_DB                   数据库类型：sqlite | mysql（默认 sqlite）
#   CP_MYSQL_HOST           MySQL 主机
#   CP_MYSQL_PORT           MySQL 端口
#   CP_MYSQL_USER           MySQL 用户
#   CP_MYSQL_PASSWORD       MySQL 密码
#   CP_MYSQL_NAME           MySQL 库名
#   CP_MYSQL_DSN            完整 DSN（提供时覆盖以上 MySQL 单项）
#   CP_PUBLIC_URL           对外访问地址（ONLYOFFICE 用）
#   CP_TRUSTED_PROXIES      信任的反代网段（逗号分隔，默认不信任）
#
# 交互菜单（无参数运行）：
#   bash start.sh
#
# 命令行用法：
#   ./start.sh install          # 初次安装部署向导（依赖→配置→建库→构建→启动）
#   ./start.sh build            # 构建前端+后端
#   ./start.sh start            # 启动（二进制不存在时自动构建）
#   ./start.sh start --build    # 重新构建后启动
#   ./start.sh stop | restart | status | log
#   ./start.sh set port 18322   # 修改端口
#   ./start.sh set db mysql     # 切换数据库类型
#   ./start.sh set mysql_host 110.81.153.109
#   ./start.sh set mysql_password '你的密码'
#   ./start.sh test-db          # 测试 MySQL 连接（顺带自动建库）
#   ./start.sh deps             # 检查/安装依赖环境
#   ./start.sh admin [新密码]   # 重置管理员密码（不带参数则密文输入）
#   ./start.sh init             # 一键初始化（备份→清文件→清库→设置管理员账号→重建→启动）
# ============================================================
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT/env.local"
PID_FILE="${CP_PID_FILE:-/tmp/cloudpan.pid}"
LOG_FILE="${CP_LOG_FILE:-/tmp/cloudpan-native.log}"
SERVER_DIR="$ROOT/server"
BIN="$SERVER_DIR/cloudpan"
BACKUP_DIR="$ROOT/备份"   # init 备份位置（已在 .gitignore 排除）

DEFAULTS_PORT="18322"
DEFAULTS_MYSQL_PORT="3306"

c_red()   { printf '\033[31m%s\033[0m\n' "$*"; }
c_green() { printf '\033[32m%s\033[0m\n' "$*"; }
c_yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }
c_cyan()  { printf '\033[36m%s\033[0m\n' "$*"; }

# ---- 配置加载（KEY=VALUE 逐行导出，VALUE 原样不二次解析） ----
load_env() {
    if [ -f "$ENV_FILE" ]; then
        while IFS='=' read -r k v || [ -n "$k" ]; do
            case "$k" in ''|\#*) continue;; esac
            export "$k=$v"
        done < "$ENV_FILE"
    fi
    : "${CP_PORT:=$DEFAULTS_PORT}"
    : "${CP_MYSQL_PORT:=$DEFAULTS_MYSQL_PORT}"
    : "${CP_DB:=sqlite}"
    : "${CP_DATA:=$SERVER_DIR/data}"
    : "${CP_MYSQL_HOST:=127.0.0.1}"
    : "${CP_MYSQL_NAME:=cloudpan}"
}

ensure_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        cat > "$ENV_FILE" <<EOF
# CloudPan 运行配置（本文件已被 .gitignore 排除，勿提交）
CP_PORT=$DEFAULTS_PORT
CP_DATA=$SERVER_DIR/data
CP_DB=sqlite
CP_MYSQL_HOST=127.0.0.1
CP_MYSQL_PORT=$DEFAULTS_MYSQL_PORT
CP_MYSQL_USER=
CP_MYSQL_PASSWORD=
CP_MYSQL_NAME=cloudpan
CP_MYSQL_DSN=
CP_PUBLIC_URL=
CP_TRUSTED_PROXIES=
CP_ADMIN_USER=admin
CP_ADMIN_PASSWORD=
EOF
        chmod 600 "$ENV_FILE"
        c_yellow "[init] 已生成默认配置: $ENV_FILE"
    fi
}

# ---- 配置项白名单（set 用） ----
env_key_of() {
    case "$1" in
        port) echo CP_PORT;;
        data_dir) echo CP_DATA;;
        db) echo CP_DB;;
        mysql_host) echo CP_MYSQL_HOST;;
        mysql_port) echo CP_MYSQL_PORT;;
        mysql_user) echo CP_MYSQL_USER;;
        mysql_password) echo CP_MYSQL_PASSWORD;;
        mysql_name) echo CP_MYSQL_NAME;;
        mysql_dsn) echo CP_MYSQL_DSN;;
        public_url) echo CP_PUBLIC_URL;;
        trusted_proxies) echo CP_TRUSTED_PROXIES;;
        admin_user) echo CP_ADMIN_USER;;
        admin_password) echo CP_ADMIN_PASSWORD;;
        *) echo "";;
    esac
}

set_config() {
    local key="$1" val="${2:-}"
    local env_key; env_key="$(env_key_of "$key")"
    if [ -z "$env_key" ]; then
        c_red "[set] 未知配置项: $key"
        c_cyan "可用: port data_dir db mysql_host mysql_port mysql_user mysql_password mysql_name mysql_dsn public_url trusted_proxies admin_user admin_password"
        exit 1
    fi
    ensure_env_file
    # 重写该行（value 原样写入；读取端不经过 shell 二次解析，任意字符安全）
    if command -v python3 >/dev/null; then
        python3 - "$ENV_FILE" "$env_key" "$val" <<'PYEOF'
import sys
path, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path, encoding='utf-8').read().splitlines(True)
out, replaced = [], False
for ln in lines:
    if ln.split('=', 1)[0] == key:
        out.append(f"{key}={val}\n"); replaced = True
    else:
        out.append(ln)
if not replaced:
    out.append(f"{key}={val}\n")
open(path, 'w', encoding='utf-8').write(''.join(out))
PYEOF
    else
        # 兜底：sed 替换（对 & | 做转义）
        sed -i "s#^${env_key}=.*#${env_key}=$(printf '%s' "$val" | sed 's/[&|]/\\\\&/g')#" "$ENV_FILE"
    fi
    chmod 600 "$ENV_FILE"
    # 同步当前 shell
    export "$env_key=$val"
    if [ "$env_key" = "CP_MYSQL_PASSWORD" ] || [ "$env_key" = "CP_ADMIN_PASSWORD" ]; then
        c_green "[set] $key = ****（已写入 $ENV_FILE）"
    else
        c_green "[set] $key = $val（已写入 $ENV_FILE）"
    fi
    c_yellow "重启服务后生效: ./start.sh restart"
}

# mask_admin 管理员密码展示态：已设置打码，未设置显示(空)
mask_admin() { [ -n "${CP_ADMIN_PASSWORD:-}" ] && echo '********' || echo '(空)'; }

show_config() {
    load_env
    mask_pwd="$CP_MYSQL_PASSWORD"
    [ -n "$mask_pwd" ] && mask_pwd='********'
    c_cyan "──────── CloudPan 运行配置 ($ENV_FILE) ────────"
    printf '  %-20s %s\n' "port (CP_PORT)" "$CP_PORT"
    printf '  %-20s %s\n' "data_dir (CP_DATA)" "$CP_DATA"
    printf '  %-20s %s\n' "db (CP_DB)" "$CP_DB"
    if [ "$CP_DB" = "mysql" ]; then
        printf '  %-20s %s\n' "mysql_host" "$CP_MYSQL_HOST"
        printf '  %-20s %s\n' "mysql_port" "$CP_MYSQL_PORT"
        printf '  %-20s %s\n' "mysql_user" "$CP_MYSQL_USER"
        printf '  %-20s %s\n' "mysql_password" "${mask_pwd:-(空)}"
        printf '  %-20s %s\n' "mysql_name" "$CP_MYSQL_NAME"
        [ -n "${CP_MYSQL_DSN:-}" ] && printf '  %-20s %s\n' "mysql_dsn" "(已设置，覆盖单项配置)"
    fi
    [ -n "${CP_PUBLIC_URL:-}" ] && printf '  %-20s %s\n' "public_url" "$CP_PUBLIC_URL"
    [ -n "${CP_TRUSTED_PROXIES:-}" ] && printf '  %-20s %s\n' "trusted_proxies" "$CP_TRUSTED_PROXIES"
    printf '  %-20s %s\n' "admin_user (首次部署生效)" "${CP_ADMIN_USER:-admin}"
    printf '  %-20s %s\n' "admin_password (首次部署生效)" "$(mask_admin)"
    c_cyan "──────────────────────────────────────────────"
}

# ---- 进程控制 ----
running_pid() {
    if [ -f "$PID_FILE" ]; then
        local p; p="$(cat "$PID_FILE" 2>/dev/null)"
        if [ -n "$p" ] && kill -0 "$p" 2>/dev/null; then
            echo "$p"; return 0
        fi
    fi
    return 1
}

wait_health() {
    local i
    for i in $(seq 1 20); do
        local code; code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${CP_PORT}/api/site/public" 2>/dev/null || echo 000)"
        if [ "$code" = "200" ]; then
            c_green "[start] 启动成功: http://127.0.0.1:${CP_PORT}/  (HTTP $code)"
            return 0
        fi
        sleep 1
    done
    c_red "[start] 健康检查未通过（HTTP $code），最近日志："
    tail -n 30 "$LOG_FILE" 2>/dev/null
    return 1
}

do_start() {
    load_env
    local force_build=0
    [ "${1:-}" = "--build" ] && force_build=1

    if p="$(running_pid)"; then
        c_yellow "[start] 已在运行 (PID $p)。如需重启请执行: ./start.sh restart"
        return 0
    fi
    # 端口被其他进程占用时提前发现
    if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:${CP_PORT}/" 2>/dev/null; then
        c_red "[start] 端口 $CP_PORT 已被其他进程占用，请先处理或执行 ./start.sh set port <新端口>"
        return 1
    fi

    if [ "$force_build" = "1" ] || [ ! -x "$BIN" ]; then
        do_build || { c_red "[start] 构建失败，未启动"; return 1; }
    fi

    # 导出运行时环境
    export CP_PORT CP_DATA CP_DB CP_MYSQL_HOST CP_MYSQL_PORT CP_MYSQL_USER CP_MYSQL_PASSWORD CP_MYSQL_NAME
    [ -n "${CP_MYSQL_DSN:-}" ]        && export CP_MYSQL_DSN
    [ -n "${CP_PUBLIC_URL:-}" ]       && export CP_PUBLIC_URL
    [ -n "${CP_TRUSTED_PROXIES:-}" ]  && export CP_TRUSTED_PROXIES
    [ -n "${CP_ADMIN_USER:-}" ]       && export CP_ADMIN_USER
    [ -n "${CP_ADMIN_PASSWORD:-}" ]   && export CP_ADMIN_PASSWORD

    c_cyan "[start] 启动 CloudPan (port=$CP_PORT db=$CP_DB)…"
    cd "$SERVER_DIR" || exit 1
    nohup ./cloudpan >> "$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"
    disown "$pid" 2>/dev/null || true
    c_cyan "[start] PID=$pid 日志=$LOG_FILE"
    wait_health
}

do_stop() {
    if p="$(running_pid)"; then
        c_cyan "[stop] 停止 PID $p …"
        kill "$p" 2>/dev/null
        for _ in $(seq 1 15); do
            kill -0 "$p" 2>/dev/null || break
            sleep 1
        done
        if kill -0 "$p" 2>/dev/null; then
            c_yellow "[stop] 5s 未退出，强制结束"
            kill -9 "$p" 2>/dev/null
        fi
        rm -f "$PID_FILE"
        c_green "[stop] 已停止"
    else
        rm -f "$PID_FILE"
        # 兜底：清理脱离 pidfile 的历史进程
        pkill -f "^\./cloudpan$" 2>/dev/null && { c_yellow "[stop] 清理了游离进程"; sleep 1; } || c_green "[stop] 未在运行"
    fi
}

do_status() {
    load_env
    if p="$(running_pid)"; then
        local code; code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://127.0.0.1:${CP_PORT}/api/site/public" 2>/dev/null || echo 000)"
        local etime; etime="$(ps -o etime= -p "$p" 2>/dev/null | tr -d ' ')"
        echo "状态    : 运行中 (PID $p, 已运行 ${etime:-?})"
        echo "端口    : $CP_PORT"
        echo "健康    : HTTP $code $([ "$code" = "200" ] && echo '(正常)' || echo '(异常!)')"
        echo "数据库  : $CP_DB $([ "$CP_DB" = "mysql" ] && echo "($CP_MYSQL_HOST:$CP_MYSQL_PORT/$CP_MYSQL_NAME)")"
        echo "数据目录: $CP_DATA"
        echo "日志    : $LOG_FILE"
        if [ "$code" != "200" ]; then
            return 1
        fi
    else
        echo "状态    : 未运行"
        echo "数据库  : $CP_DB（配置）"
        return 3
    fi
}

# ---- 构建 ----
do_build() {
    c_cyan "[build] 构建前端…"
    ( cd "$ROOT/web" && npm run build ) || return 1
    c_cyan "[build] 嵌入 dist…"
    rm -rf "$SERVER_DIR/internal/web/dist"
    cp -r "$ROOT/web/dist" "$SERVER_DIR/internal/web/dist"
    touch "$SERVER_DIR/internal/web/dist/.keep"
    c_cyan "[build] 编译后端…"
    local ver; ver="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo dev)"
    ( cd "$SERVER_DIR" && CGO_ENABLED=0 go build -ldflags "-X cloudpan/internal/handler.Version=$ver" -o cloudpan . ) || return 1
    c_green "[build] 完成: server/cloudpan (version=$ver)"
}

# ---- 依赖环境 ----
do_deps() {
    c_cyan "── 依赖环境检查 ──"
    local ok=1
    if command -v go >/dev/null; then
        echo "Go      : $(go version)"
    else
        c_red "Go      : 未安装（需 1.21+，https://golang.google.cn/dl/ 或 apt install golang-go）"; ok=0
    fi
    if command -v node >/dev/null; then
        echo "Node.js : $(node --version)"
    else
        c_red "Node.js : 未安装（需 18+，建议用 NodeSource 或 nvm 安装）"; ok=0
    fi
    if command -v npm >/dev/null; then
        echo "npm     : $(npm --version)"
    else
        c_red "npm     : 未安装"; ok=0
    fi
    command -v mysql >/dev/null && echo "mysql   : $(mysql --version | cut -d' ' -f1-4)" || c_yellow "mysql   : 客户端未安装（仅影响 ./start.sh test-db，服务本身不需要）"

    if [ "$ok" = "1" ]; then
        c_cyan "── 安装项目依赖 ──"
        if [ ! -d "$ROOT/web/node_modules" ]; then
            echo "npm install（web 前端依赖）…"
            ( cd "$ROOT/web" && npm install --no-audit --no-fund ) || c_red "npm install 失败"
        else
            echo "web/node_modules 已存在，跳过（如需重装: rm -rf web/node_modules && ./start.sh deps）"
        fi
        echo "go mod download…"
        ( cd "$SERVER_DIR" && go mod download ) || c_red "go mod download 失败"
        c_green "依赖就绪"
    else
        c_red "缺少基础工具链，请先安装 Go 与 Node.js"
        return 1
    fi
}

# ---- MySQL 连接测试 ----
do_test_db() {
    load_env
    if [ "${CP_DB:-}" != "mysql" ]; then
        c_yellow "当前 CP_DB=$CP_DB（非 mysql）。先执行: ./start.sh set db mysql"
    fi
    if [ -z "${CP_MYSQL_USER:-}" ]; then
        c_red "未配置 MySQL 用户。示例:"
        c_cyan "  ./start.sh set db mysql"
        c_cyan "  ./start.sh set mysql_host 110.81.153.109"
        c_cyan "  ./start.sh set mysql_port 3306"
        c_cyan "  ./start.sh set mysql_user yun_johngko_com"
        c_cyan "  ./start.sh set mysql_password '密码'"
        c_cyan "  ./start.sh set mysql_name yun_johngko_com"
        return 1
    fi
    # 1) TCP 可达性
    if timeout 5 bash -c "cat < /dev/null > /dev/tcp/${CP_MYSQL_HOST}/${CP_MYSQL_PORT}" 2>/dev/null; then
        c_green "TCP $CP_MYSQL_HOST:$CP_MYSQL_PORT 可达"
    else
        c_red "TCP $CP_MYSQL_HOST:$CP_MYSQL_PORT 不可达（防火墙/端口错误/服务未启动）"
        return 1
    fi
    # 2) 账号密码 + 库
    if command -v mysql >/dev/null; then
        if mysql -h "$CP_MYSQL_HOST" -P "$CP_MYSQL_PORT" -u "$CP_MYSQL_USER" -p"$CP_MYSQL_PASSWORD" \
             -e "SELECT VERSION() AS version;" ${CP_MYSQL_NAME:+"$CP_MYSQL_NAME"} 2>/dev/null; then
            c_green "MySQL 登录成功（库: $CP_MYSQL_NAME）"
        else
            c_red "MySQL 登录失败（账号/密码/库名错误或无权限）"
            return 1
        fi
        # 3) 一键建库：库不存在时尝试创建（无建库权限且库不存在时会提示）
        if ! mysql -h "$CP_MYSQL_HOST" -P "$CP_MYSQL_PORT" -u "$CP_MYSQL_USER" -p"$CP_MYSQL_PASSWORD" \
             -e "USE \`$CP_MYSQL_NAME\`;" 2>/dev/null; then
            if mysql -h "$CP_MYSQL_HOST" -P "$CP_MYSQL_PORT" -u "$CP_MYSQL_USER" -p"$CP_MYSQL_PASSWORD" \
                 -e "CREATE DATABASE IF NOT EXISTS \`$CP_MYSQL_NAME\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null; then
                c_green "数据库 $CP_MYSQL_NAME 不存在，已自动创建"
            else
                c_red "数据库 $CP_MYSQL_NAME 不存在且无权限创建，请在 MySQL 里手动执行:"
                c_cyan "  CREATE DATABASE \`$CP_MYSQL_NAME\` DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;"
                return 1
            fi
        fi
    else
        c_yellow "mysql 客户端未安装，仅完成 TCP 探测"
    fi
}

do_log() {
    local n="${1:-80}"
    tail -n "$n" "$LOG_FILE" 2>/dev/null || c_yellow "暂无日志: $LOG_FILE"
}

# ---- 重置管理员密码（复用二进制的 reset-admin 子命令） ----
reset_admin_cmd() {
    load_env
    local pw="${1:-}"
    if [ -z "$pw" ]; then
        ask_secret "新管理员密码（至少 8 位，输入不回显）: "
        pw="$REPLY"
    fi
    if [ "${#pw}" -lt 8 ]; then
        c_red "密码至少 8 位"
        return 1
    fi
    if [ ! -x "$BIN" ]; then
        c_red "服务端二进制不存在，先执行: ./start.sh build"
        return 1
    fi
    # reset-admin 需要与服务的数据库配置一致
    export CP_PORT CP_DATA CP_DB CP_MYSQL_HOST CP_MYSQL_PORT CP_MYSQL_USER CP_MYSQL_PASSWORD CP_MYSQL_NAME
    [ -n "${CP_MYSQL_DSN:-}" ] && export CP_MYSQL_DSN
    "$BIN" reset-admin "$pw"
}

# ---- 管理员账号问答 ----
# admin_account_wizard 设置「首次部署/一键初始化」时创建的管理员账号密码，写入 env.local
# （已初始化的系统不再读取该配置，改密码请用 ./start.sh admin）
admin_account_wizard() {
    load_env
    local adm_user adm_pwd
    while true; do
        ask "管理员用户名" "${CP_ADMIN_USER:-admin}"
        adm_user="$REPLY"
        [[ "$adm_user" =~ ^[A-Za-z0-9_-]{2,32}$ ]] && break
        c_red "用户名需 2-32 位，仅字母/数字/下划线/短横线"
    done
    while true; do
        if [ -n "${CP_ADMIN_PASSWORD:-}" ]; then
            ask_secret "管理员密码（回车=沿用已保存；至少 8 位，输入不回显）: "
            if [ -z "$REPLY" ]; then adm_pwd="$CP_ADMIN_PASSWORD"; break; fi
        else
            ask_secret "管理员密码（至少 8 位，输入不回显；回车=随机生成）: "
            if [ -z "$REPLY" ]; then
                adm_pwd="admin$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 10)"
                c_cyan "  已随机生成密码: $adm_pwd （请记下）"
                break
            fi
        fi
        adm_pwd="$REPLY"
        if [ ${#adm_pwd} -lt 8 ]; then c_red "密码至少 8 位"; continue; fi
        ask_secret "再输一遍确认: "
        if [ "$REPLY" = "$adm_pwd" ]; then break; fi
        c_red "两次输入不一致，请重试"
    done
    set_config admin_user "$adm_user" > /dev/null
    set_config admin_password "$adm_pwd" > /dev/null
    load_env
    c_green "管理员账号已保存: $adm_user（首次部署/一键初始化创建账号时生效）"
}

# ---- 一键初始化（恢复出厂） ----
# 数据安全设计：文件与数据库都「先备份再清空」，绝不直接 rm——
# 文件整体移入 备份/数据目录-<时间>/（同盘移动瞬间完成），
# 数据库先 mysqldump 压缩备份再 DROP 全部表。确认系统正常后可手动删除备份腾空间。
do_init() {
    load_env
    echo
    c_red "════════ 一键初始化（恢复出厂）════════"
    echo "  该操作将："
    echo "   1) 停止服务"
    echo "   2) 数据目录整体移入备份（用户上传的全部文件）：$CP_DATA"
    if [ "$CP_DB" = "mysql" ]; then
        echo "   3) MySQL 先备份再清空：$CP_MYSQL_HOST/$CP_MYSQL_NAME"
    else
        echo "   3) SQLite：随数据目录一并清空"
    fi
    echo "   4) 重新构建并启动，生成全新系统（随后询问管理员账号密码）"
    echo "  备份位置: $BACKUP_DIR/（确认系统正常后可手动删除腾空间）"
    echo
    if ! confirm "确认清空全部数据并恢复出厂? (y=执行 n=取消)" "n"; then
        c_yellow "[init] 已取消，未做任何改动"
        return 1
    fi

    # 管理员账号：新系统首次启动按此创建
    echo
    c_cyan "── 管理员账号（新系统首次启动时按此创建）──"
    admin_account_wizard

    mkdir -p "$BACKUP_DIR"
    local ts; ts="$(date +%Y%m%d-%H%M%S)"

    # [1/4] 停止服务
    c_cyan "[init][1/4] 停止服务…"
    do_stop

    # [2/4] 数据目录整体移入备份
    c_cyan "[init][2/4] 备份并清空数据目录…"
    if [ -d "$CP_DATA" ]; then
        local bk="$BACKUP_DIR/数据目录-$ts"
        mv "$CP_DATA" "$bk" || { c_red "数据目录移动失败，终止（未做任何删除）"; return 1; }
        c_green "[init] 原数据已整体移入: $bk"
    else
        c_yellow "[init] 数据目录不存在，跳过备份"
    fi
    mkdir -p "$CP_DATA"

    # [3/4] 数据库：先备份再清空
    if [ "$CP_DB" = "mysql" ]; then
        local dump="$BACKUP_DIR/db-$ts.sql.gz"
        c_cyan "[init][3/4] 备份数据库 → $dump …"
        local dump_rc=0
        mysqldump -h "$CP_MYSQL_HOST" -P "$CP_MYSQL_PORT" -u "$CP_MYSQL_USER" -p"$CP_MYSQL_PASSWORD" \
             --single-transaction "$CP_MYSQL_NAME" 2>/dev/null | gzip > "$dump"
        dump_rc=${PIPESTATUS[0]}
        if [ "$dump_rc" != "0" ] || [ ! -s "$dump" ]; then
            rm -f "$dump"
            c_red "数据库备份失败，终止（数据库未动，文件已移入备份）"
            return 1
        fi
        c_green "[init] 数据库备份完成 ($(du -h "$dump" | cut -f1))"
        c_cyan "[init] 清空数据库全部表…"
        local tables t dropped=0
        tables="$(mysql -h "$CP_MYSQL_HOST" -P "$CP_MYSQL_PORT" -u "$CP_MYSQL_USER" -p"$CP_MYSQL_PASSWORD" \
             -N -e "SHOW TABLES" "$CP_MYSQL_NAME" 2>/dev/null)" || { c_red "读取表清单失败，终止"; return 1; }
        for t in $tables; do
            mysql -h "$CP_MYSQL_HOST" -P "$CP_MYSQL_PORT" -u "$CP_MYSQL_USER" -p"$CP_MYSQL_PASSWORD" \
                 -e "DROP TABLE IF EXISTS \`$t\`" "$CP_MYSQL_NAME" 2>/dev/null && dropped=$((dropped+1))
        done
        c_green "[init] 数据库已清空（删除 $dropped 张表）"
    else
        c_cyan "[init][3/4] SQLite 随数据目录一并清空"
    fi

    # [4/4] 重新构建并启动
    c_cyan "[init][4/4] 构建 + 启动…"
    do_build || { c_red "构建失败，初始化中止（数据已清空，修复构建后重跑 ./start.sh start 即可）"; return 1; }
    do_start || return 1

    # 收尾：提取本次启动日志里的新管理员密码
    echo
    c_green "════════ 初始化完成 ════════"
    echo "  访问地址 : http://127.0.0.1:${CP_PORT}/（外网以反代域名为准）"
    echo "  数据库   : $CP_DB $([ "$CP_DB" = "mysql" ] && echo "($CP_MYSQL_HOST/$CP_MYSQL_NAME)")"
    echo "  管理员   : ${CP_ADMIN_USER:-admin} / ${CP_ADMIN_PASSWORD:-(随机密码见上方提示或日志)}"
    echo "  磁盘策略 : 需在 管理后台 → 存储策略 重新添加（如 C:/D:/E: 盘）"
    echo "  备份     : $BACKUP_DIR/（无需后再删）"
    c_green "══════════════════════════"
}

usage() {
    cat <<'EOF'
CloudPan 一键管理脚本

  bash start.sh                进入交互菜单（数字选择功能）
  ./start.sh install           初次安装部署向导
  ./start.sh build             构建前端+后端
  ./start.sh start [--build]   启动服务
  ./start.sh stop|restart      停止/重启
  ./start.sh status            运行状态
  ./start.sh log [N]           查看日志（默认 80 行）
  ./start.sh deps              检查/安装依赖环境
  ./start.sh config            查看配置
  ./start.sh set <项> <值>     修改配置（port/db/mysql_host/mysql_port/
                               mysql_user/mysql_password/mysql_name/
                               mysql_dsn/data_dir/public_url/trusted_proxies/
                               admin_user/admin_password）
  ./start.sh test-db           测试 MySQL 连接（顺带自动建库）
  ./start.sh admin [新密码]    重置管理员密码（不带参数则密文输入）
  ./start.sh init              一键初始化/恢复出厂（备份→清空→设置管理员账号→重建，需 y/n 确认）
EOF
}

# ---- 交互输入辅助 ----
# ask "提示" "默认值" → 结果写入 REPLY
# 输入流结束（EOF / Ctrl-D）时直接中止脚本：绝不沿用上一次的旧值误确认
ask() {
    local prompt="$1" def="${2:-}" in p
    p="$prompt: "; [ -n "$def" ] && p="$prompt [$def]: "
    if ! read -r -p "$p" in; then
        echo
        c_red "输入已结束（EOF），为安全起见中止，未做任何改动"
        exit 1
    fi
    if [ -n "$def" ]; then
        REPLY="${in:-$def}"
    else
        REPLY="$in"
    fi
}
# ask_secret "提示" → 结果写入 REPLY（不回显）
ask_secret() {
    if ! read -r -s -p "$1" REPLY; then
        echo
        c_red "输入已结束（EOF），为安全起见中止，未做任何改动"
        exit 1
    fi
    echo
}

# ---- 初次安装部署向导 ----
do_install() {
    load_env
    echo
    c_cyan "════════════════════════════════════════════"
    c_cyan "        CloudPan 初次安装部署向导"
    c_cyan "════════════════════════════════════════════"
    echo "  流程：依赖环境 → 运行配置 → 数据库连接 → 管理员账号 → 构建 → 启动"
    echo

    # [1/5] 依赖环境
    c_cyan "[1/6] 检查并安装依赖环境…"
    do_deps || { c_red "依赖环境不完整，安装终止"; return 1; }

    # [2/5] 运行配置
    echo
    c_cyan "[2/6] 运行配置"
    if [ -f "$ENV_FILE" ] && grep -q '^CP_DB=' "$ENV_FILE" 2>/dev/null; then
        ask "检测到已有配置，是否沿用？(y=沿用/n=重新配置)" "y"
        [ "$REPLY" = "y" ] || config_wizard
    else
        config_wizard
    fi
    load_env

    # [3/5] 数据库连接
    echo
    c_cyan "[3/6] 数据库连接测试"
    if [ "$CP_DB" = "mysql" ]; then
        until do_test_db; do
            ask "连接失败，回车重新配置数据库 / 输入 q 放弃安装" ""
            [ "$REPLY" = "q" ] && { c_red "安装已取消"; return 1; }
            config_wizard
            load_env
        done
    else
        c_green "使用 SQLite（数据目录: $CP_DATA），无需外部数据库"
    fi

    # [4/6] 管理员账号（首次部署创建时生效；已初始化的系统不读取该配置）
    echo
    c_cyan "[4/6] 管理员账号设置"
    admin_account_wizard

    # [5/6] 构建
    echo
    c_cyan "[5/6] 构建项目（前端 + 后端，首次约 1-2 分钟）…"
    do_build || { c_red "构建失败，安装终止（可查看上方错误，修复后重跑）"; return 1; }

    # [5/5] 启动
    echo
    c_cyan "[6/6] 启动服务"
    do_stop > /dev/null 2>&1
    # 记录启动前日志行数：只在「本次启动」的日志段里找初始密码，避免翻到历史旧密码
    local log_offset; log_offset=$(( $(wc -l < "$LOG_FILE" 2>/dev/null || echo 0) + 1 ))
    do_start || return 1

    # 收尾提示
    echo
    c_green "════════ 安装完成 ════════"
    echo "  访问地址 : http://127.0.0.1:${CP_PORT}/"
    echo "  数据库   : $CP_DB $([ "$CP_DB" = "mysql" ] && echo "($CP_MYSQL_HOST:$CP_MYSQL_PORT/$CP_MYSQL_NAME)")"
    echo "  配置文件 : $ENV_FILE（含数据库密码，已排除 git，请勿泄露）"
    local pwd_line
    pwd_line="$(tail -n +$log_offset "$LOG_FILE" 2>/dev/null | grep -oE '初始管理员密码为 [A-Za-z0-9]+' | tail -1 | awk '{print $NF}')"
    if [ -n "$pwd_line" ]; then
        echo "  初始管理员账号: admin  密码: $pwd_line（请立即登录修改）"
    elif [ -n "${CP_ADMIN_PASSWORD:-}" ]; then
        echo "  管理员账号: ${CP_ADMIN_USER:-admin} / （安装时设置的密码，记录在 $ENV_FILE）"
    else
        echo "  管理员密码: 使用你已设置的密码（首次部署时在日志 $LOG_FILE 中输出过一次）"
    fi
    echo "  常用管理 : bash start.sh（数字菜单）｜ ./start.sh status ｜ ./start.sh log"
    c_green "══════════════════════════"
}

# confirm "提示" "默认(y/n)" → 确认返回 0
confirm() {
    ask "$1" "${2:-n}"
    [[ "$REPLY" =~ ^[Yy](es)?$ ]]
}

# config_wizard 配置问答（先填写 → 汇总确认 → 再保存）
config_wizard() {
    ensure_env_file
    load_env
    while true; do
        local port db my_host my_port my_user my_pwd my_name data_dir
        echo "—— 基础配置 ——"
        ask "服务端口" "$CP_PORT"; port="$REPLY"
        echo "—— 数据库选择 ——"
        echo "  1) SQLite（零依赖，适合小型/个人部署）"
        echo "  2) MySQL 8（外部数据库，适合长期/多用户部署）"
        local dbdef=1; [ "$CP_DB" = "mysql" ] && dbdef=2
        ask "请选择 [1/2]" "$dbdef"
        db=sqlite; [ "$REPLY" = "2" ] && db=mysql
        if [ "$db" = "mysql" ]; then
            echo "—— MySQL 连接 ——"
            ask "MySQL 主机" "$CP_MYSQL_HOST"; my_host="$REPLY"
            ask "MySQL 端口" "$CP_MYSQL_PORT"; my_port="$REPLY"
            ask "MySQL 用户名" "$CP_MYSQL_USER"; my_user="$REPLY"
            if [ -n "$CP_MYSQL_PASSWORD" ]; then
                ask "MySQL 密码（回车=沿用已保存的密码）" ""
                my_pwd="$REPLY"; [ -z "$my_pwd" ] && my_pwd="$CP_MYSQL_PASSWORD"
            else
                ask_secret "MySQL 密码: "; my_pwd="$REPLY"
            fi
            ask "MySQL 数据库名" "${CP_MYSQL_NAME:-cloudpan}"; my_name="$REPLY"
        else
            echo "—— SQLite ——"
            ask "数据目录" "${CP_DATA:-$SERVER_DIR/data}"; data_dir="$REPLY"
        fi
        # 汇总确认：确认后才写入
        echo
        c_cyan "──────── 配置确认 ────────"
        echo "  服务端口 : $port"
        if [ "$db" = "mysql" ]; then
            echo "  数据库   : MySQL  $my_host:$my_port/$my_name（用户: $my_user）"
        else
            echo "  数据库   : SQLite（数据目录: $data_dir）"
        fi
        c_cyan "──────────────────────────"
        if confirm "确认以上配置并保存? (y=保存 n=重填)" "y"; then
            set_config port "$port" > /dev/null
            set_config db "$db" > /dev/null
            if [ "$db" = "mysql" ]; then
                set_config mysql_host "$my_host" > /dev/null
                set_config mysql_port "$my_port" > /dev/null
                set_config mysql_user "$my_user" > /dev/null
                set_config mysql_password "$my_pwd" > /dev/null
                set_config mysql_name "$my_name" > /dev/null
            else
                set_config data_dir "$data_dir" > /dev/null
            fi
            break
        fi
        c_yellow "—— 好的，请重新填写 ——"
    done
    load_env
    show_config
}

# ---- 配置管理子菜单 ----
config_menu() {
    load_env
    while true; do
        echo
        c_cyan "──────── 配置管理 ────────"
        echo " 当前: port=$CP_PORT  db=$CP_DB $([ "$CP_DB" = "mysql" ] && echo "($CP_MYSQL_HOST:$CP_MYSQL_PORT/$CP_MYSQL_NAME)")"
        echo "  1) 修改服务端口"
        echo "  2) 切换数据库类型 (sqlite/mysql)"
        echo "  3) MySQL 主机"
        echo "  4) MySQL 端口"
        echo "  5) MySQL 用户名"
        echo "  6) MySQL 密码"
        echo "  7) MySQL 数据库名"
        echo "  8) 数据目录"
        echo "  9) 查看当前全部配置"
        echo " 10) 管理员账号（初始化/首次部署生效）"
        echo "  0) 返回主菜单"
        ask "请选择" ""
        case "$REPLY" in
            1) ask "新端口" "$CP_PORT"; set_config port "$REPLY";;
            2) ask "数据库类型 (sqlite/mysql)" "$CP_DB"; set_config db "$REPLY";;
            3) ask "MySQL 主机" "$CP_MYSQL_HOST"; set_config mysql_host "$REPLY";;
            4) ask "MySQL 端口" "$CP_MYSQL_PORT"; set_config mysql_port "$REPLY";;
            5) ask "MySQL 用户名" "$CP_MYSQL_USER"; set_config mysql_user "$REPLY";;
            6) ask_secret "新 MySQL 密码（输入不回显）: "; set_config mysql_password "$REPLY";;
            7) ask "MySQL 数据库名" "$CP_MYSQL_NAME"; set_config mysql_name "$REPLY";;
            8) ask "数据目录" "$CP_DATA"; set_config data_dir "$REPLY";;
            9) show_config;;
            10) admin_account_wizard; load_env;;
            0) return 0;;
            *) c_red "无效选择";;
        esac
    done
}

# ---- 交互主菜单 ----
interactive_menu() {
    load_env
    while true; do
        local st="未运行" info=""
        if p="$(running_pid 2>/dev/null)"; then
            st="运行中 (PID $p)"
        fi
        echo
        c_cyan "══════════════════════════════════════"
        c_cyan "   CloudPan 管理菜单   [$st]"
        c_cyan "══════════════════════════════════════"
        echo "  1) 启动服务            7) 配置管理（端口/数据库）"
        echo "  2) 停止服务            8) 测试 MySQL 连接"
        echo "  3) 重启服务            9) 重置管理员密码"
        echo "  4) 运行状态           10) 一键初始化（恢复出厂）"
        echo "  5) 重新构建           11) 初次安装部署向导"
        echo "  6) 查看日志            0) 退出"
        ask "请选择 [0-11]" ""
        case "$REPLY" in
            1) do_start;;
            2) do_stop;;
            3) do_stop; sleep 1; do_start;;
            4) do_status;;
            5) do_build;;
            6) do_log 80; read -r -p "—— 按回车返回菜单 ——";;
            7) config_menu; load_env;;
            8) do_test_db;;
            9) reset_admin_cmd;;
            10) do_init; load_env;;
            11) do_install; load_env;;
            0) echo "再见"; exit 0;;
            *) c_red "无效选择，请输入 0-11";;
        esac
    done
}

# ---- 入口 ----
cmd="${1:-menu}"
case "$cmd" in
    menu)    interactive_menu;;
    install) do_install;;
    build)   do_build;;
    start)   shift; do_start "$@";;
    init)    do_init;;
    admin)   shift; reset_admin_cmd "${1:-}";;
    reset-admin)
        load_env
        "$BIN" reset-admin "$2"
        ;;
    stop)    do_stop;;
    restart) do_stop; sleep 1; do_start;;
    status)  do_status;;
    log)     shift; do_log "${1:-80}";;
    deps)    do_deps;;
    config)  ensure_env_file; show_config;;
    set)     shift; set_config "${1:-}" "${2:-}";;
    test-db) do_test_db;;
    help|-h|--help) usage;;
    *) c_red "未知命令: $cmd"; usage; exit 1;;
esac

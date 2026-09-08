@echo off
rem CloudPan 启动脚本（首次运行自动建库，默认账号 admin / admin123）
cd /d "%~dp0server"
if not exist cloudpan.exe (
  echo cloudpan.exe 不存在，请先运行 build.bat
  pause
  exit /b 1
)
echo CloudPan 启动中: http://localhost:18322  (Ctrl+C 停止)
cloudpan.exe

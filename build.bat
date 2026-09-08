@echo off
rem CloudPan 一键构建：前端 -> 嵌入 -> 单 exe
setlocal
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files\Go\bin"
cd /d "%~dp0"

echo [1/3] building frontend...
cd web
call npm run build || goto :err
cd ..

echo [2/3] embedding dist...
if exist server\internal\web\dist rmdir /s /q server\internal\web\dist
xcopy /e /i /q web\dist server\internal\web\dist >nul || goto :err

echo [3/3] building cloudpan.exe...
cd server
go build -o cloudpan.exe . || goto :err
cd ..

echo.
echo BUILD OK: server\cloudpan.exe
goto :eof

:err
echo BUILD FAILED
exit /b 1

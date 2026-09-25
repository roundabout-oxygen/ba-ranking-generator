@echo off
chcp 65001 > nul
title ブルーアーカイブ Wiki ランキング編成生成ツール

echo ==========================================================
echo   ブルーアーカイブ Wiki ランキング編成生成ツールを起動します
echo ==========================================================
echo.

where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Pythonが見つかりました。ローカルサーバー (http://localhost:8080) を起動します...
    python server.py
) else (
    echo Pythonが見つからないため、ブラウザで index.html を直接開きます...
    start "" "index.html"
)

pause

@echo off
chcp 65001 >nul
title KHOI DONG HE THONG NEXUS MOBILITY
color 0A

echo =====================================================================
echo       HE THONG DIEU PHOI DI CHUYEN THONG MINH - NEXUS MOBILITY
echo =====================================================================
echo.

:: 1. Kiem tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [LOI] May tinh cua ban chua cai dat Node.js!
    echo Vui long vao https://nodejs.org de tai va cai dat Node.js (Ban LTS).
    echo.
    pause
    exit /b
)

echo [1/4] Kiem tra Node.js: OK!

:: 2. Kiem tra va cai dat thu vien Backend neu thieu
if not exist "node_modules\" (
    echo [2/4] Dang cai dat thu vien Backend, vui long doi it phut...
    call npm install
) else (
    echo [2/4] Thu vien Backend da san sang!
)

:: 3. Kiem tra va cai dat thu vien Frontend neu thieu
if not exist "client\node_modules\" (
    echo [3/4] Dang cai dat thu vien Frontend cho Client...
    cd client && call npm install && cd ..
) else (
    echo [3/4] Thu vien Frontend da san sang!
)

:: 4. Generate Prisma Client
echo [4/4] Khoi tao Prisma ORM Database Client...
call npx prisma generate >nul 2>nul

echo.
echo =====================================================================
echo    DANG KHOI CHAY HE THONG (PORT 4000 VA PORT 3000)...
echo =====================================================================
echo  - Backend API:    http://localhost:4000
echo  - Frontend Web:   http://localhost:3000
echo.
echo  * Luu y: Dam bao MySQL tren may (XAMPP / Laragon) da duoc BAT (Start)!
echo.
echo  Trinh duyet se tu dong mo sau 3 giay...
echo =====================================================================
echo.

:: Tu dong mo trinh duyet sau 3s
start "" http://localhost:3000

:: Chay song song ca Backend va Frontend
call npm run dev:all

pause

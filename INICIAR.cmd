@echo off
cd /d "%~dp0"
if not exist dist\client\index.html (
 echo Falta compilar la pagina. Ejecuta npm install y npm run build.
 pause
 exit /b 1
)
echo Abre http://localhost:3001 en tu navegador.
node server.mjs
pause

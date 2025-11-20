@echo off
cd /d D:\dev\financialtracker
call pm2 start index.js --name financialtracker
call pm2 save
pause

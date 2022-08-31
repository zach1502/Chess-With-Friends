@echo off
cls

:start
echo Starting test
node deploy-commands.js
node main.js
goto start

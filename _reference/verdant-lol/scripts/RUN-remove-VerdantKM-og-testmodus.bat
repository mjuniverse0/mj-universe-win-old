@echo off
REM Dobbeltklikk denne - godkjenn UAC («Ja») én gang. Kjør som vanlig bruker; scriptet opphever seg selv.
cd /d "%~dp0\.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Normal -File "%~dp0full-disable-verdantkm-testmode.ps1"
if errorlevel 1 pause
exit /b %errorlevel%

@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not defined JAVA_HOME for /d %%D in ("%ProgramFiles%\Java\jdk-*") do if exist "%%D\bin\javac.exe" set "JAVA_HOME=%%D"
if not defined JAVA_HOME for /d %%D in ("%ProgramFiles%\Eclipse Adoptium\jdk-*") do if exist "%%D\bin\javac.exe" set "JAVA_HOME=%%D"
call mvn -B verify
if errorlevel 1 (
 echo Для сборки нужны JDK 21+ и Apache Maven 3.9+. Готовый jar запускается без Maven.
 pause
 exit /b 1
)
copy /y "target\baltic-drive.jar" "baltic-drive.jar" >nul
echo Готово. Запустите start.cmd
pause

@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "JAVACMD=java"
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" set "JAVACMD=%JAVA_HOME%\bin\java.exe"
if not defined JAVA_HOME for /d %%D in ("%ProgramFiles%\Java\jdk-*") do if exist "%%D\bin\java.exe" set "JAVACMD=%%D\bin\java.exe"
if not defined JAVA_HOME for /d %%D in ("%ProgramFiles%\Eclipse Adoptium\jdk-*") do if exist "%%D\bin\java.exe" set "JAVACMD=%%D\bin\java.exe"
if not exist "baltic-drive.jar" (
 echo Сначала выполните build.cmd или скачайте готовый Java-архив.
 pause
 exit /b 1
)
echo Откройте http://localhost:3000
"%JAVACMD%" -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -jar baltic-drive.jar
pause

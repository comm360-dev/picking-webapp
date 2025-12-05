@echo off
echo Creation de la base de donnees PostgreSQL...
echo.

REM Creer la base de donnees
psql -U postgres -c "CREATE DATABASE picking_webapp;"

echo.
echo Base de donnees creee avec succes!
echo.
pause

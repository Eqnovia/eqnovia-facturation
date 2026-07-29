@echo off
title Facturation Eqnovia - Configuration des dossiers
color 0A

echo ============================================
echo    Facturation Eqnovia
echo    Creation de l'arborescence des dossiers
echo ============================================
echo.

:: Detecter le chemin du Bureau
set "DESKTOP=%USERPROFILE%\Desktop"
set "BASE=%DESKTOP%\Facturation Eqnovia"

echo Destination : %BASE%
echo.

:: Creer le dossier principal
if not exist "%BASE%" (
    mkdir "%BASE%"
    echo [OK] Dossier principal cree : Facturation Eqnovia
) else (
    echo [OK] Dossier principal existe deja
)

:: Creer les sous-dossiers
set SUBFOLDERS=Factures Devis Commandes Livraisons "Factures Pro Forma" "Contacts Clients" Fournisseurs

for %%f in (%SUBFOLDERS%) do (
    if not exist "%BASE%\%%~f" (
        mkdir "%BASE%\%%~f"
        echo [OK] Sous-dossier cree : %%~f
    ) else (
        echo [OK] Sous-dossier existe deja : %%~f
    )
)

echo.
echo ============================================
echo  Arborescence creee avec succes !
echo ============================================
echo.
echo  %BASE%\
echo    +-- Factures\
echo    +-- Devis\
echo    +-- Commandes\
echo    +-- Livraisons\
echo    +-- Factures Pro Forma\
echo    +-- Contacts Clients\
echo    +-- Fournisseurs\
echo.
echo  Vous pouvez maintenant fermer cette fenetre.
echo.
pause

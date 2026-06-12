$git = "C:\Program Files\Git\cmd\git.exe"

& $git init
& $git branch -m main
& $git config user.email "tesis@framework.com"
& $git config user.name "Framework NFR"
& $git add .
& $git commit -m "WIP: Fase 5 - UI Fixes y Flujo de App completados"
& $git remote add origin https://github.com/vbrizzi/TFG.git
Write-Host "Iniciando git push... es posible que aparezca una ventana pidiendo iniciar sesion en Github."
& $git push -u origin main

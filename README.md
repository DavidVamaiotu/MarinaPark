# Administrare clienti Marina Park

Aplicatie locala pentru administrarea clientilor Marina Park.

## Rulare

Porneste serverul local:

```powershell
npm start
```

Deschide apoi:

```text
http://localhost:4173
```

Cand ruleaza prin server, aplicatia salveaza rezervarile si configuratia intr-o baza de date SQLite locala: `data/marina-park.sqlite`. Daca deschizi direct `index.html`, aplicatia ramane functionala, dar poate salva doar in `localStorage`.

## Baza de date

- `data/marina-park.sqlite` contine rezervarile si configuratia aplicatiei.
- Tabela `reservations` contine cate un rand per rezervare.
- Tabela `app_config` contine configuratia locala a aplicatiei.

## Update automat pe toate PC-urile

Aplicatia se poate actualiza singura la pornire, folosind GitHub Releases.

Fluxul este:

1. Publici o versiune noua in GitHub Releases.
2. Fiecare PC porneste `MarinaPark.exe` (sau `MarinaPark.bat` ca varianta de rezerva).
3. `MarinaPark.ps1` citeste `version.json`, verifica manifestul `latest.json` din GitHub si descarca update-ul daca versiunea este mai noua.
4. Sunt inlocuite doar fisierele aplicatiei. Datele locale din `data/`, `node_modules/`, logurile si bonurile nu sunt incluse in update si raman pe PC.

Pentru a pregati un release nou:

```powershell
.\scripts\New-MarinaParkRelease.ps1 -Version 1.0.1
```

Scriptul creeaza:

- `dist/MarinaPark-1.0.1.zip`
- `dist/latest.json`

In GitHub, creezi un release cu tagul `v1.0.1` si incarci ambele fisiere ca assets. PC-urile se vor actualiza la urmatoarea pornire.

Dupa ce proiectul este pus pe GitHub, release-ul se poate face automat doar prin tag:

```powershell
git tag v1.0.1
git push origin v1.0.1
```

Workflow-ul `.github/workflows/release.yml` va construi zip-ul, va crea release-ul si va incarca `latest.json`.

Daca repo-ul GitHub are alt nume, modifica in `version.json` campul `manifestUrl` si ruleaza scriptul cu:

```powershell
.\scripts\New-MarinaParkRelease.ps1 -Version 1.0.1 -Repository "USER/REPO"
```

Pentru pornire fara update, foloseste:

```powershell
.\MarinaPark.ps1 --no-update
```

# Marina Park Desktop

Aplicație Windows pentru administrarea clienților Marina Park.

## Rulare în dezvoltare

```powershell
npm install
npm start
```

Pentru a porni doar serverul local în browser:

```powershell
npm run server
```

## Fișiere păstrate la actualizare

Instalarea Electron separă aplicația de fișierele care trebuie păstrate:

- `%APPDATA%\Marina Park\data` — baza SQLite, jurnalul și backupurile;
- `%APPDATA%\Marina Park\runtime` — fișiere generate în timpul rulării;
- `%APPDATA%\Marina Park\custom` — fișiere adăugate sau modificate de utilizator.

Actualizatorul înlocuiește numai fișierele administrate ale aplicației. Nu șterge datele de mai sus, nici la actualizare, nici la dezinstalare.

Fișierele puse de dezvoltator în `custom-defaults/` sunt copiate în directorul persistent `custom` la pornire. Copierea este de tip **missing-only**: un fișier nou este adăugat, dar un fișier existent cu același nume nu este înlocuit.

La prima instalare, aplicația poate importa baza de date din vechiul folder Marina Park. Pentru migrare automată, rulează prima dată installerul din folderul instalării vechi; dacă acesta nu este detectat, aplicația permite alegerea manuală a folderului.

Trecerea de la launcherul vechi PowerShell la Electron necesită o singură rulare manuală a installerului. După aceea, toate versiunile Electron se actualizează automat.

## Construire installer Windows

```powershell
npm run dist
```

Rezultatul este creat în `dist-electron/`:

- `MarinaPark-Setup-<versiune>.exe`;
- `latest.yml`;
- metadatele necesare actualizării diferențiale.

Installerul este NSIS per-user, nu cere drepturi de administrator și nu șterge datele aplicației la dezinstalare.

## Publicare și actualizare automată

Versiunea din tag devine versiunea aplicației:

```powershell
git tag v1.0.18
git push origin v1.0.18
```

Workflow-ul `.github/workflows/release.yml` construiește installerul pe Windows și publică în GitHub Releases installerul, `latest.yml` și metadatele de update.

Aplicația verifică actualizările la cinci secunde după pornire și apoi la fiecare patru ore. Update-ul este descărcat în fundal și instalat la repornire sau la închiderea aplicației.

Pentru distribuție în afara PC-urilor controlate, installerul trebuie semnat cu un certificat Windows pentru a evita avertismentele SmartScreen.

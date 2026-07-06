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

## Import din aplicația veche

Pune `dbField-2.json`, `Stationare.json` și baza țintă `marina-park.sqlite2`
în rădăcina proiectului. Verifică mai întâi importul fără modificări:

```powershell
npm run migrate:legacy -- --dry-run
```

Apoi execută migrarea:

```powershell
npm run migrate:legacy
```

Scriptul creează automat un backup, actualizează rezervările cu același GUID,
adaugă rezervările și staționările noi și păstrează nemodificate articolele,
stocurile și produsele de bar deja atașate rezervărilor.

## Fișiere păstrate la actualizare

Instalarea Electron separă aplicația de fișierele care trebuie păstrate:

- `%APPDATA%\Marina Park\data` — baza SQLite, jurnalul și backupurile;
- `%APPDATA%\Marina Park\runtime` — fișiere generate în timpul rulării;
- `%APPDATA%\Marina Park\custom` — fișiere adăugate sau modificate de utilizator.

## Fuziunea registrului de clienți

Lista „Rezervări efectuate” din formularul de adăugare client combină
rezervările citite din bazele SQL Marina Park cu istoricul local. Aplicația
păstrează istoricul într-un fișier SQLite separat:

- `%APPDATA%\Marina Park\data\client-history.sqlite`

La sincronizare, numele sunt comparate fără diferențe de majuscule, diacritice,
semne sau spații multiple. Rezervările SQL au prioritate. Un client local este
adăugat în istoricul separat și afișat în lista de import numai dacă numele lui
nu există în bazele SQL. Detaliile locale rămân în fișier chiar dacă rezervarea
activă este eliminată ulterior. Dacă SQL nu este disponibil, istoricul nu este
rescris pe baza unor date incomplete. Când este selectat un client din istoricul
local, formularul preia doar datele de identificare/contact; perioada și prețul
rămân cele ale rezervării noi.

Pentru o rezervare viitoare de camping, butonul de legare caută o staționare
cu același nume normalizat și cu nopți rămase. Dacă există exact una, formularul
este deschis automat pe Rulote, iar nopțile rezervării sunt înregistrate o
singură dată în contorul de staționare când rezervarea este salvată, fără să
scadă din preț sau din restul de plată. Dacă există mai multe potriviri,
alegerea rămâne manuală pentru a evita legarea staționării greșite.

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

Rulează scriptul `bump` din rădăcina proiectului. Implicit, acesta publică
următoarea versiune patch:

```bash
./bump
```

Poți cere o versiune minoră, majoră sau explicită:

```bash
./bump minor
./bump major
./bump 2.0.0
```

Scriptul verifică autentificarea GitHub, ia versiunea curentă din ultimul
release public, actualizează fișierele de versiune, rulează testele, comite
toate modificările curente, împinge branch-ul și tag-ul, așteaptă workflow-ul
Windows și verifică installerul, `latest.yml` și blockmap-ul descărcate din
release. Dacă un tag patch există deja după un release eșuat, scriptul trece
automat la următorul număr disponibil. Este disponibil și prin `npm run bump`.

La prima utilizare, dacă autentificarea a expirat:

```bash
gh auth login -h github.com -p https -w
```

Workflow-ul `.github/workflows/release.yml` construiește installerul pe Windows și publică în GitHub Releases installerul, `latest.yml` și metadatele de update.

Aplicația verifică actualizările la cinci secunde după pornire și apoi la fiecare patru ore. Update-ul este descărcat în fundal și instalat la repornire sau la închiderea aplicației.

Pentru distribuție în afara PC-urilor controlate, installerul trebuie semnat cu un certificat Windows pentru a evita avertismentele SmartScreen.

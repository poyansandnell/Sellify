# EAS Release Guide – Sellify (iOS via App Store, ingen Xcode)

Hela flödet körs i terminalen på din dator via EAS Build och EAS Submit.
Xcode behövs inte (används bara som felsökningsverktyg om en build misslyckas
med ett native-fel).

## Förutsättningar

- Apple Developer-konto (99 USD/år) – https://developer.apple.com
- Expo-konto (gratis) – https://expo.dev
- Node.js installerat lokalt
- Detta repo utcheckat lokalt (via Replit → Git eller nedladdning)

## Steg för steg

```bash
# 1. Gå till mobilappens mapp (exakt sökväg i detta repo):
cd artifacts/sellify-mobile

# 2. Installera beroenden (projektet använder pnpm):
pnpm install

# 3. Installera EAS CLI globalt:
npm install -g eas-cli

# 4. Logga in på ditt Expo-konto:
eas login

# 5. Koppla projektet till ditt Expo-konto (skapar extra.eas.projectId i app.json):
eas init
#    - Svara "Yes" på att skapa ett nytt projekt.
#    - Behåll sluggen "sellify-mobile".

# 6. Bygg för App Store:
eas build --platform ios --profile production
```

Under första `eas build` frågar EAS om Apple-uppgifter:

- **"Do you want to log in to your Apple account?"** → Yes, logga in med ditt
  Apple ID.
- **Apple Developer Team:** välj ditt team i listan (finns bara ett väljs det
  automatiskt).
- **Certifikat/provisioning:** välj alltid standardalternativet att **låta EAS
  skapa och hantera** distribution certificate och provisioning profile åt dig.
  Du ska inte skapa något manuellt i Apple Developer-portalen.
- Bundle id `se.sellify.app` registreras automatiskt.

Bygget tar ca 10–20 min i EAS moln. Följ länken som skrivs ut för status.

```bash
# 7. Skicka builden till App Store Connect:
eas submit --platform ios --latest
```

- Välj samma Apple-konto/team. EAS laddar upp builden till App Store Connect.
- Efter 5–30 min dyker builden upp i App Store Connect under
  **Din app → TestFlight → iOS Builds** (Apple kör automatisk processing).

## I App Store Connect (engångsjobb)

1. Gå till https://appstoreconnect.apple.com → **My Apps** → appen skapas
   automatiskt av `eas submit` (annars: **+ → New App**, bundle id
   `se.sellify.app`).
2. **Språk:** sätt primärt språk till English (U.S.) och lägg till Swedish
   under *App Information → Localizable Information*.
3. **Bilder:** ladda upp från lanseringspaketet
   (`attached_assets/store/sellify-lanseringspaket.zip`):
   - Engelska lokaliseringen: `iphone-01-en.png` … `iphone-03-en.png` under
     *iPhone 6.5" Display*, `ipad-01-en.png` … under *iPad 13" Display*.
   - Svenska lokaliseringen: motsvarande `-sv.png`-filer.
4. **Texter:** kopiera från `APP_STORE_CONNECT.md` (namn, undertitel,
   beskrivning, keywords per språk).
5. **Policylänkar:**
   - *App Privacy → Privacy Policy URL:*
     `https://attached-assets-poyansandnell.replit.app/privacy`
   - Användarvillkor: klistra in
     `https://attached-assets-poyansandnell.replit.app/terms` i beskrivningen
     eller under *App Information → License Agreement* (standard-EULA går också
     bra).
6. **App Privacy:** fyll i enligt `APP_PRIVACY_GUIDE.md`.
7. **Build:** under fliken *App Store → iOS App*, välj builden du skickade upp.
8. **App Review Notes + testkonto:** kopiera från `APP_STORE_CONNECT.md` och
   fyll i ett riktigt testkonto (skapa ett i appen först).
9. Klicka **Add for Review → Submit to App Review**.

## Miljövariabler i EAS

Endast en publik variabel behövs och den ligger redan i `eas.json`
(production-profilen):

| Variabel | Värde | Kommentar |
| --- | --- | --- |
| `EXPO_PUBLIC_DOMAIN` | `attached-assets-poyansandnell.replit.app` | Produktions-URL till API/webb. Publik, ingen hemlighet. |

Inga hemliga nycklar ska läggas i mobilappen. Alla hemligheter (Clerk secret,
OpenAI m.m.) ligger enbart på servern.

## Nästa release

Höj `version` i `app.json` (t.ex. `1.0.1`) – build number ökas automatiskt av
EAS (`autoIncrement: true`). Kör sedan steg 6–7 igen.

## Android (senare)

Samma flöde: `eas build --platform android --profile production` och
`eas submit --platform android` (kräver Google Play Console-konto, 25 USD
engångsavgift).

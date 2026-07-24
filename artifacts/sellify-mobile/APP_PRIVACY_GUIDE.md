# App Privacy – guide för App Store Connect

Så fyller du i avsnittet **App Privacy** i App Store Connect för Sellify.
Baserat på appens faktiska kod och tjänster (Clerk-inloggning, egen API-server,
Replit object storage för bilder, OpenAI via server för AI-förslag och
transkribering, Expo push-notiser). **Ingen data används för tracking eller
annonsering. Svara "No" på frågan om tracking (ATT).**

## Datatyper – vad du ska ange

| Datatyp | Samlas in? | Varför | Kopplad till identitet? | Tracking? | Val i App Store Connect |
| --- | --- | --- | --- | --- | --- |
| Namn | Ja | Visas som profilnamn på annonser | Ja | Nej | App Functionality |
| E-postadress | Ja | Kontoinloggning (Clerk) | Ja | Nej | App Functionality |
| Telefonnummer | Nej | – | – | – | Samlas inte in |
| Fysisk adress | Nej | – | – | – | Samlas inte in |
| Ungefärlig plats | Ja | Stad förifylls i annonser (endast stadsnamn sparas) | Ja | Nej | App Functionality |
| Exakt plats | Nej | Enhetens position används endast lokalt för att slå upp staden; koordinater skickas/lagras aldrig | – | – | Samlas inte in |
| Foton eller videor | Ja | Produktbilder i annonser (användaren väljer själv) | Ja | Nej | App Functionality |
| Ljuddata | Nej* | Röstanteckningar transkriberas på servern och ljudet sparas inte. *Om du vill vara extra transparent: ange "Audio Data – App Functionality – Not linked". Annars kan det utelämnas eftersom inget lagras. | – | – | Se kommentar |
| Användargenererat innehåll (annat) | Ja | Annonstitlar, beskrivningar | Ja | Nej | App Functionality |
| Meddelanden | Ja | Chatt mellan köpare och säljare | Ja | Nej | App Functionality |
| Sökhistorik | Nej | Sökningar sparas inte per användare | – | – | Samlas inte in |
| Enhets-ID | Ja | Push-token för notiser (Expo push token) | Ja | Nej | App Functionality |
| Produktinteraktion | Nej | Ingen analys-/statistik-SDK i appen | – | – | Samlas inte in |
| Diagnostik (kraschdata) | Nej | Ingen kraschrapporterings-SDK | – | – | Samlas inte in |
| Köp/betalningar | Nej | Inga betalningar i appen | – | – | Samlas inte in |
| Ekonomisk info | Nej | Priset i en annons är annonsinnehåll, inte användarens ekonomiska data | – | – | Samlas inte in |
| Webbhistorik | Nej | – | – | – | Samlas inte in |
| Kontakter | Nej | – | – | – | Samlas inte in |

## Sammanfattning av val

1. **"Do you or your third-party partners collect data from this app?"** → **Yes**
2. Bocka i: Name, Email Address, Coarse Location, Photos, User Content
   (Other User Content + Messages), Device ID.
3. För varje datatyp:
   - Usage: **App Functionality**
   - Linked to the user's identity: **Yes** (allt är knutet till kontot)
   - Used for tracking: **No**
4. ATT/Tracking-frågan: **No** – appen spårar inte användare över andra företags
   appar/webbplatser och innehåller ingen annons-SDK.

## Tredjepartstjänster (för din egen dokumentation)

| Tjänst | Roll | Data som passerar |
| --- | --- | --- |
| Clerk | Inloggning (e-post/lösenord, Google, Apple) | Namn, e-post, profilbild |
| Egen API-server (Replit) | All appdata | Annonser, meddelanden, favoriter, push-tokens |
| Replit App Storage | Bildlagring | Produktbilder |
| OpenAI (via servern) | AI-annonsförslag + transkribering | Produktbilder, annonstext, röstinspelningar (transkriberas, sparas ej) |
| Expo Push / APNs | Notiser | Push-token, notistext (t.ex. "Nytt meddelande") |

Ingen av tjänsterna används för annonsering eller tracking.

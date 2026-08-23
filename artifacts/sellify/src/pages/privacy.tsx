import { useI18n } from '@/lib/i18n';
import { Link } from 'wouter';

/**
 * Privacy policy (App Store / Google Play requirement).
 * Language follows the site language (sv/en) with a quick toggle.
 */
export default function Privacy() {
  const { language, setLanguage } = useI18n();
  const sv = language === 'sv';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {sv ? 'Integritetspolicy' : 'Privacy Policy'}
        </h1>
        <button
          className="text-sm font-medium text-muted-foreground underline transition-colors hover:text-foreground"
          onClick={() => setLanguage(sv ? 'en' : 'sv')}
        >
          {sv ? 'Read in English' : 'Läs på svenska'}
        </button>
      </div>
      <p className="mb-8 text-sm text-muted-foreground">
        {sv ? 'Senast uppdaterad: 23 augusti 2026' : 'Last updated: August 23, 2026'}
      </p>

      {sv ? (
        <div className="space-y-6 leading-relaxed">
          <Section title="1. Vilka vi är">
            Sellify är en marknadsplats för begagnade varor där privatpersoner kan lägga upp annonser, kontakta varandra och göra affärer. Denna policy beskriver hur vi behandlar dina personuppgifter när du använder Sellify på webben eller i mobilappen.
          </Section>
          <Section title="2. Uppgifter vi samlar in">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Kontouppgifter</strong> – namn, e-postadress och profilbild via vår inloggningsleverantör (Clerk).
              </li>
              <li>
                <strong>Annonsinnehåll</strong> – bilder, titlar, beskrivningar, pris och den stad du anger i annonsen.
              </li>
              <li>
                <strong>Meddelanden</strong> – konversationer mellan köpare och säljare lagras för att tjänsten ska fungera.
              </li>
              <li>
                <strong>Moderering och säkerhetsdata</strong> – register över anmälningar (rapporter), blockeringar mellan användare och loggar från vår automatiserade innehållsgranskning på servern lagras för att upprätthålla trygghet och efterleva våra säkerhetskrav (UGC).
              </li>
              <li>
                <strong>Plats (frivilligt)</strong> – om du ger tillåtelse används telefonens plats endast för att föreslå rätt stad i dina annonser. Din exakta position lagras aldrig.
              </li>
              <li>
                <strong>Röstanteckningar (frivilligt)</strong> – om du använder mikrofonen transkriberas ljudet för att fylla i annonsen. Ljudfilen sparas inte efter transkriberingen.
              </li>
              <li>
                <strong>Pushnotiser (frivilligt)</strong> – en enhetstoken sparas om du godkänner notiser, så att vi kan meddela dig om nya meddelanden.
              </li>
            </ul>
          </Section>
          <Section title="3. Hur vi använder uppgifterna">
            Vi använder uppgifterna för att driva tjänsten: visa annonser, förmedla kontakt mellan köpare och säljare, skicka notiser om nya meddelanden samt förbättra annonser med AI (bilder och text du skickar in analyseras för att föreslå titel, beskrivning och pris).
            Din modereringsdata och rapporteringshistorik används exklusivt för vår automatiserade serverbaserade säkerhetskontroll och manuella granskning, i syfte att identifiera och ta bort olämpligt beteende. Vi säljer aldrig dina personuppgifter och visar ingen reklam baserad på dem.
          </Section>
          <Section title="4. Delning med tredje part">
            Uppgifter delas endast med de leverantörer som krävs för att driva tjänsten: inloggning (Clerk), lagring av bilder, AI-tjänst för annonsförslag, transkribering och säkerhetsgranskning, samt pushnotiser (Expo/Apple/Google). Dessa behandlar uppgifterna för vår räkning.
          </Section>
          <Section title="5. Lagring och radering">
            Uppgifterna sparas så länge du har ett konto. Du kan när som helst ta bort dina annonser i appen. Vill du radera hela ditt konto och tillhörande uppgifter, kontakta oss så raderar vi dem utan onödigt dröjsmål. Data kopplad till allvarliga regelbrott kan behållas under en begränsad tid av säkerhets- och lagliga skäl.
          </Section>
          <Section title="6. Dina rättigheter (GDPR)">
            Du har rätt att begära tillgång till, rättelse av eller radering av dina personuppgifter, samt rätt till dataportabilitet och att invända mot viss behandling. Du kan också klaga hos Integritetsskyddsmyndigheten (IMY).
          </Section>
          <Section title="7. Barn">
            Sellify riktar sig inte till barn under 13 år och vi samlar inte medvetet in uppgifter om barn.
          </Section>
          <Section title="8. Kontakt och mer information">
            Frågor om denna policy eller hur vi behandlar din data? Kontakta oss via ditt konto i appen, eller skicka ett e-postmeddelande till{' '}
            <a href="mailto:info@catchme.se" className="font-medium text-primary hover:underline">info@catchme.se</a>.
            <div className="mt-4 flex gap-4">
              <Link href="/terms" className="font-medium text-primary hover:underline">
                Användarvillkor
              </Link>
              <Link href="/support" className="font-medium text-primary hover:underline">
                Support & Hjälp
              </Link>
            </div>
          </Section>
        </div>
      ) : (
        <div className="space-y-6 leading-relaxed">
          <Section title="1. Who we are">
            Sellify is a second-hand marketplace where private individuals can post listings, contact each other and make deals. This policy describes how we process your personal data when you use Sellify on the web or in the mobile app.
          </Section>
          <Section title="2. Data we collect">
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Account data</strong> – name, email address and profile picture via our sign-in provider (Clerk).
              </li>
              <li>
                <strong>Listing content</strong> – images, titles, descriptions, price and the city you enter in a listing.
              </li>
              <li>
                <strong>Messages</strong> – conversations between buyers and sellers are stored so the service can function.
              </li>
              <li>
                <strong>Moderation and safety data</strong> – records of reports, blocks between users, and logs from our automated server-side content screening are stored to maintain safety and comply with our UGC moderation requirements.
              </li>
              <li>
                <strong>Location (optional)</strong> – with your permission, your device location is used only to suggest the right city for your listings. Your exact position is never stored.
              </li>
              <li>
                <strong>Voice notes (optional)</strong> – if you use the microphone, the audio is transcribed to help fill in your listing. The audio file is not kept after transcription.
              </li>
              <li>
                <strong>Push notifications (optional)</strong> – a device token is stored if you allow notifications, so we can alert you about new messages.
              </li>
            </ul>
          </Section>
          <Section title="3. How we use the data">
            We use the data to run the service: showing listings, connecting buyers and sellers, sending notifications about new messages, and improving listings with AI (images and text you submit are analyzed to suggest a title, description and price).
            Your moderation data and report history are strictly used for our automated server-side safety checks and manual reviews, to identify and remove inappropriate behavior. We never sell your personal data and show no ads based on it.
          </Section>
          <Section title="4. Sharing with third parties">
            Data is only shared with the providers required to run the service: sign-in (Clerk), image storage, the AI service used for listing suggestions, transcription, and safety screening, as well as push notifications (Expo/Apple/Google). They process the data on our behalf.
          </Section>
          <Section title="5. Retention and deletion">
            Data is kept for as long as you have an account. You can delete your listings in the app at any time. To delete your entire account and associated data, contact us and we will erase it without undue delay. Data related to severe terms violations may be retained for a limited time for safety and legal reasons.
          </Section>
          <Section title="6. Your rights (GDPR)">
            You have the right to request access to, correction of or deletion of your personal data, as well as data portability and the right to object to certain processing. You may also lodge a complaint with your local data protection authority.
          </Section>
          <Section title="7. Children">
            Sellify is not directed at children under 13 and we do not knowingly collect data about children.
          </Section>
          <Section title="8. Contact and further information">
            Questions about this policy or how we process your data? Contact us via your account in the app, or send an email to{' '}
            <a href="mailto:info@catchme.se" className="font-medium text-primary hover:underline">info@catchme.se</a>.
            <div className="mt-4 flex gap-4">
              <Link href="/terms" className="font-medium text-primary hover:underline">
                Terms of Service
              </Link>
              <Link href="/support" className="font-medium text-primary hover:underline">
                Support & Help
              </Link>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <div className="text-muted-foreground">{children}</div>
    </section>
  );
}

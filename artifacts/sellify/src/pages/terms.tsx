import { useI18n } from '@/lib/i18n';
import { Link } from 'wouter';

/** Terms of service (sv/en) — referenced from the App Store listing. */
export default function Terms() {
  const { language, setLanguage } = useI18n();
  const sv = language === 'sv';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {sv ? 'Användarvillkor' : 'Terms of Service'}
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
          <Section title="1. Tjänsten & Godkännande av villkor">
            Genom att skapa ett konto eller använda Sellify godkänner du aktivt dessa villkor. Sellify är en annonsplattform där privatpersoner kan köpa och sälja begagnade varor. Sellify är inte part i affärerna mellan köpare och säljare och hanterar inga betalningar eller leveranser.
          </Section>
          <Section title="2. Konto">
            Du måste vara minst 13 år för att skapa ett konto och ansvarar själv för att uppgifterna du anger är korrekta och att ditt konto inte missbrukas.
          </Section>
          <Section title="3. Annonser, innehåll och nolltolerans">
            Du ansvarar för innehållet i dina annonser. Vi har strikt <strong>nolltolerans mot stötande, olagligt, hotfullt, trakasserande, kränkande eller på annat sätt olämpligt innehåll och beteende</strong>.
            Det är förbjudet att annonsera olagliga, stulna eller förfalskade varor, vilseledande innehåll eller sådant som gör intrång i annans rätt. Sellify förbehåller sig rätten att omedelbart, och utan förvarning, ta bort innehåll och stänga av konton som bryter mot dessa villkor.
          </Section>
          <Section title="4. Rapportering, blockering och hanteringstid (UGC)">
            Du kan när som helst blockera en annan användare eller rapportera olämpligt innehåll (UGC) och misstänkt beteende direkt i appen. Vi ser allvarligt på alla anmälningar.
            <strong>Rapporter gällande användargenererat innehåll (UGC) granskas och hanteras av oss inom 24 timmar</strong>, varvid olämpligt innehåll avlägsnas och skyldiga konton spärras.
          </Section>
          <Section title="5. AI-genererade förslag">
            Titlar, beskrivningar och prisförslag som skapas med vår AI-funktion är just förslag. Du ansvarar för att granska och godkänna innehållet innan du publicerar en annons.
          </Section>
          <Section title="6. Ansvarsbegränsning">
            Tjänsten tillhandahålls i befintligt skick. Sellify ansvarar inte för varornas skick, äkthet eller för att en affär genomförs, och inte heller för indirekta skador i den utsträckning lagen tillåter.
          </Section>
          <Section title="7. Ändringar">
            Vi kan uppdatera dessa villkor. Väsentliga ändringar meddelas i appen eller på webbplatsen. Fortsatt användning efter en ändring innebär att du godkänner de nya villkoren.
          </Section>
          <Section title="8. Tillämplig lag">
            Svensk lag gäller för dessa villkor. Tvister prövas av svensk allmän domstol.
          </Section>
          <Section title="9. Kontakt och mer information">
            Om du har frågor om våra användarvillkor, upplever problem eller vill rapportera något, kontakta oss gärna via e-post på{' '}
            <a href="mailto:info@catchme.se" className="font-medium text-primary hover:underline">info@catchme.se</a>.
            <div className="mt-4 flex gap-4">
              <Link href="/privacy" className="font-medium text-primary hover:underline">
                Integritetspolicy
              </Link>
              <Link href="/support" className="font-medium text-primary hover:underline">
                Support & Hjälp
              </Link>
            </div>
          </Section>
        </div>
      ) : (
        <div className="space-y-6 leading-relaxed">
          <Section title="1. The service & Active acceptance">
            By creating an account or using Sellify, you actively accept these terms. Sellify is a listing platform where private individuals can buy and sell second-hand goods. Sellify is not a party to transactions between buyers and sellers and does not handle payments or shipping.
          </Section>
          <Section title="2. Account">
            You must be at least 13 years old to create an account and you are responsible for keeping your information accurate and your account secure.
          </Section>
          <Section title="3. Listings, content and zero tolerance">
            You are responsible for the content of your listings. We maintain a strict <strong>zero tolerance policy for objectionable, illegal, threatening, harassing, abusive or otherwise inappropriate content and behavior</strong>.
            Advertising illegal, stolen or counterfeit goods, misleading content or content that infringes the rights of others is prohibited. Sellify reserves the right to immediately, and without notice, remove content and suspend accounts that violate these terms.
          </Section>
          <Section title="4. Reporting, blocking and response time (UGC)">
            You can block another user or report inappropriate User Generated Content (UGC) and suspicious behavior directly within the app at any time. We take all reports seriously.
            <strong>Reports regarding UGC are reviewed and acted upon by our team within 24 hours</strong>, resulting in the removal of offending content and suspension of responsible accounts.
          </Section>
          <Section title="5. AI-generated suggestions">
            Titles, descriptions and price suggestions created with AI are just that — suggestions. You are responsible for reviewing and approving the content before publishing a listing.
          </Section>
          <Section title="6. Limitation of liability">
            The service is provided as is. Sellify is not responsible for the condition or authenticity of goods, for transactions being completed, or for indirect damages, to the extent permitted by law.
          </Section>
          <Section title="7. Changes">
            We may update these terms. Material changes will be announced in the app or on the website. Continued use after a change means you accept the new terms.
          </Section>
          <Section title="8. Governing law">
            These terms are governed by Swedish law. Disputes are settled by Swedish courts.
          </Section>
          <Section title="9. Contact and further information">
            If you have questions about these terms, experience issues, or need to report something, please contact us by email at{' '}
            <a href="mailto:info@catchme.se" className="font-medium text-primary hover:underline">info@catchme.se</a>.
            <div className="mt-4 flex gap-4">
              <Link href="/privacy" className="font-medium text-primary hover:underline">
                Privacy Policy
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

import { useI18n } from '@/lib/i18n';

/** Terms of service (sv/en) — referenced from the App Store listing. */
export default function Terms() {
  const { language, setLanguage } = useI18n();
  const sv = language === 'sv';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {sv ? 'Användarvillkor' : 'Terms of Service'}
        </h1>
        <button
          className="text-sm text-muted-foreground underline"
          onClick={() => setLanguage(sv ? 'en' : 'sv')}
        >
          {sv ? 'Read in English' : 'Läs på svenska'}
        </button>
      </div>
      <p className="mb-8 text-sm text-muted-foreground">
        {sv ? 'Senast uppdaterad: 24 juli 2026' : 'Last updated: July 24, 2026'}
      </p>

      {sv ? (
        <div className="space-y-6 leading-relaxed">
          <Section title="1. Tjänsten">
            Sellify är en annonsplattform där privatpersoner kan köpa och sälja
            begagnade varor. Sellify är inte part i affärerna mellan köpare och
            säljare och hanterar inga betalningar eller leveranser.
          </Section>
          <Section title="2. Konto">
            Du måste vara minst 13 år för att skapa ett konto och ansvarar
            själv för att uppgifterna du anger är korrekta och att ditt konto
            inte missbrukas.
          </Section>
          <Section title="3. Annonser och innehåll">
            Du ansvarar för innehållet i dina annonser. Det är förbjudet att
            annonsera olagliga, stulna eller förfalskade varor, vilseledande
            innehåll eller sådant som gör intrång i annans rätt. Vi kan ta bort
            annonser och stänga av konton som bryter mot villkoren.
          </Section>
          <Section title="4. AI-genererade förslag">
            Titlar, beskrivningar och prisförslag som skapas med AI är just
            förslag. Du ansvarar för att granska och godkänna innehållet innan
            du publicerar en annons.
          </Section>
          <Section title="5. Ansvarsbegränsning">
            Tjänsten tillhandahålls i befintligt skick. Sellify ansvarar inte
            för varornas skick, äkthet eller för att en affär genomförs, och
            inte heller för indirekta skador i den utsträckning lagen tillåter.
          </Section>
          <Section title="6. Ändringar">
            Vi kan uppdatera dessa villkor. Väsentliga ändringar meddelas i
            appen eller på webbplatsen. Fortsatt användning efter en ändring
            innebär att du godkänner de nya villkoren.
          </Section>
          <Section title="7. Tillämplig lag">
            Svensk lag gäller för dessa villkor. Tvister prövas av svensk
            allmän domstol.
          </Section>
        </div>
      ) : (
        <div className="space-y-6 leading-relaxed">
          <Section title="1. The service">
            Sellify is a listing platform where private individuals can buy
            and sell second-hand goods. Sellify is not a party to transactions
            between buyers and sellers and does not handle payments or
            shipping.
          </Section>
          <Section title="2. Account">
            You must be at least 13 years old to create an account and you are
            responsible for keeping your information accurate and your account
            secure.
          </Section>
          <Section title="3. Listings and content">
            You are responsible for the content of your listings. Advertising
            illegal, stolen or counterfeit goods, misleading content or
            content that infringes the rights of others is prohibited. We may
            remove listings and suspend accounts that violate these terms.
          </Section>
          <Section title="4. AI-generated suggestions">
            Titles, descriptions and price suggestions created with AI are
            just that — suggestions. You are responsible for reviewing and
            approving the content before publishing a listing.
          </Section>
          <Section title="5. Limitation of liability">
            The service is provided as is. Sellify is not responsible for the
            condition or authenticity of goods, for transactions being
            completed, or for indirect damages, to the extent permitted by
            law.
          </Section>
          <Section title="6. Changes">
            We may update these terms. Material changes will be announced in
            the app or on the website. Continued use after a change means you
            accept the new terms.
          </Section>
          <Section title="7. Governing law">
            These terms are governed by Swedish law. Disputes are settled by
            Swedish courts.
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

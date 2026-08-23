import { useI18n } from '@/lib/i18n';
import { Link } from 'wouter';
import { ShieldAlert, LifeBuoy, Flag, UserX, UserCog, Mail } from 'lucide-react';

export default function Support() {
  const { language, setLanguage } = useI18n();
  const sv = language === 'sv';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between border-b pb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {sv ? 'Support & Hjälp' : 'Support & Help'}
        </h1>
        <button
          className="text-sm font-medium text-muted-foreground underline transition-colors hover:text-foreground"
          onClick={() => setLanguage(sv ? 'en' : 'sv')}
        >
          {sv ? 'Read in English' : 'Läs på svenska'}
        </button>
      </div>

      {sv ? (
        <div className="space-y-10">
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold">
              <LifeBuoy className="h-6 w-6 text-primary" />
              Sellify AI Support
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Vår smarta plattform är designad för att göra köp och sälj så enkelt och tryggt som möjligt.
              Om du stöter på problem, behöver vägledning för hur appen fungerar eller har allmänna frågor
              kan du hitta mycket information direkt i appen.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-muted/50 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <Mail className="h-5 w-5 text-primary" />
              Behöver du mer hjälp?
            </h2>
            <p className="mb-4 text-muted-foreground">
              Om du inte hittar svar på dina frågor i appen, eller om du behöver kontakta oss gällande
              specifika ärenden eller feedback, är du alltid välkommen att mejla oss.
            </p>
            <a
              href="mailto:info@catchme.se"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Kontakta info@catchme.se
            </a>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              Trygghet och Användargenererat Innehåll (UGC)
            </h2>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              Vi tillämpar en mycket strikt <strong>nolltolerans mot allt stötande, kränkande, hatiskt
              och olagligt innehåll</strong>. För att säkerställa att Sellify förblir en trygg marknadsplats
              har vi inbyggda verktyg för att anmäla överträdelser och blockera oseriösa aktörer.
              Varje anmälan tas på största allvar.
            </p>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Flag className="h-5 w-5 text-muted-foreground" />
                  Rapportera Innehåll
                </div>
                <p className="text-sm text-muted-foreground">
                  Hittar du en annons eller ett meddelande som bryter mot våra regler?
                  Använd knappen "Rapportera" som finns direkt på annonssidan eller i
                  meddelandevyn för att omedelbart larma vårt team.
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <UserX className="h-5 w-5 text-muted-foreground" />
                  Blockera Användare
                </div>
                <p className="text-sm text-muted-foreground">
                  Upplever du obehag från en specifik användare kan du blockera personen
                  via dennes profil. De kommer inte längre kunna kontakta dig eller se dina annonser.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-foreground">
              <span className="mb-1 block font-semibold">Vårt löfte inom 24 timmar</span>
              Alla UGC-rapporter granskas och hanteras av vår säkerhetspersonal inom högst 24 timmar.
              Användare och innehåll som strider mot våra villkor tas bort omedelbart.
            </div>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold">
              <UserCog className="h-6 w-6 text-secondary" />
              Konto & Inloggning
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Problem med att logga in? Kontrollera att du använder samma inloggningsmetod (Google, Apple, etc.)
              som när du skapade kontot. Om du önskar radera ditt konto eller ändra profildata, kan detta
              göras under dina profilinställningar inuti appen. För mer avancerade kontofrågor, maila vår support.
            </p>
          </section>

          <section className="flex flex-col items-start justify-between gap-6 border-t pt-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="mb-1 font-medium text-foreground">Läs mer om våra riktlinjer</h3>
              <p className="text-sm text-muted-foreground">Fördjupa dig i våra avtal och hantering av data.</p>
            </div>
            <div className="flex gap-4">
              <Link href="/terms" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Användarvillkor
              </Link>
              <Link href="/privacy" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Integritetspolicy
              </Link>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold">
              <LifeBuoy className="h-6 w-6 text-primary" />
              Sellify AI Support
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Our smart platform is designed to make buying and selling as simple and safe as possible.
              If you run into issues, need guidance on how the app works, or have general questions,
              you can find most answers right inside the app.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-muted/50 p-6">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
              <Mail className="h-5 w-5 text-primary" />
              Need more help?
            </h2>
            <p className="mb-4 text-muted-foreground">
              If you can't find answers to your questions in the app, or if you need to contact us regarding
              specific inquiries or feedback, you are always welcome to email us.
            </p>
            <a
              href="mailto:info@catchme.se"
              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Contact info@catchme.se
            </a>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              Safety & User Generated Content (UGC)
            </h2>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              We apply a strict <strong>zero tolerance policy towards all offensive, harassing, hateful,
              and illegal content</strong>. To ensure Sellify remains a safe marketplace, we have built-in
              tools to report violations and block bad actors. Every report is taken very seriously.
            </p>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Flag className="h-5 w-5 text-muted-foreground" />
                  Report Content
                </div>
                <p className="text-sm text-muted-foreground">
                  Found a listing or message that breaks our rules? Use the "Report" button
                  located directly on the listing page or in the conversation view to alert our team instantly.
                </p>
              </div>

              <div className="flex flex-col gap-2 rounded-xl border p-5 shadow-sm">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <UserX className="h-5 w-5 text-muted-foreground" />
                  Block Users
                </div>
                <p className="text-sm text-muted-foreground">
                  If you experience discomfort from a specific user, you can block them
                  via their profile. They will no longer be able to contact you or see your listings.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-foreground">
              <span className="mb-1 block font-semibold">Our 24-hour promise</span>
              All UGC reports are reviewed and acted upon by our safety team within 24 hours at the latest.
              Users and content that violate our terms are removed immediately.
            </div>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold">
              <UserCog className="h-6 w-6 text-secondary" />
              Account & Login
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Having trouble logging in? Make sure you are using the same login method (Google, Apple, etc.)
              that you used to create the account. If you wish to delete your account or change profile data,
              this can be done in your profile settings within the app. For advanced account issues, email our support.
            </p>
          </section>

          <section className="flex flex-col items-start justify-between gap-6 border-t pt-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="mb-1 font-medium text-foreground">Read more about our guidelines</h3>
              <p className="text-sm text-muted-foreground">Dive into our agreements and data handling.</p>
            </div>
            <div className="flex gap-4">
              <Link href="/terms" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Privacy Policy
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

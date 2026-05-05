import Link from 'next/link';

export const metadata = { title: 'Impressum — kanbanly' };

export default function ImpressumPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-fg mb-8">
          Impressum
        </h1>

        <div className="rounded-md bg-surface border border-line p-6 space-y-6 text-sm text-fg-soft">
          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              Angaben gemäß § 5 TMG
            </h2>
            <p className="leading-relaxed">
              Felix Franzen
              <br />
              Am Süllberg 6
              <br />
              29633 Munster
              <br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              Kontakt
            </h2>
            <p className="leading-relaxed">
              E-Mail: felixfranzen2026@gmail.com
              <br />
              Telefon: auf Anfrage
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV
            </h2>
            <p className="leading-relaxed">
              Felix Franzen
              <br />
              Am Süllberg 6
              <br />
              29633 Munster
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              Haftung für Inhalte
            </h2>
            <p className="leading-relaxed">
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene
              Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
              verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
              Diensteanbieter jedoch nicht verpflichtet, übermittelte oder
              gespeicherte fremde Informationen zu überwachen oder nach
              Umständen zu forschen, die auf eine rechtswidrige Tätigkeit
              hinweisen.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              Haftung für Links
            </h2>
            <p className="leading-relaxed">
              Unser Angebot enthält Links zu externen Webseiten Dritter, auf
              deren Inhalte wir keinen Einfluss haben. Deshalb können wir für
              diese fremden Inhalte auch keine Gewähr übernehmen. Für die
              Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter
              oder Betreiber der Seiten verantwortlich.
            </p>
          </section>

        </div>

        <div className="mt-6">
          <Link
            href="/"
            className="text-sm text-muted hover:text-fg"
          >
            ← Zurück
          </Link>
        </div>
      </div>
    </div>
  );
}

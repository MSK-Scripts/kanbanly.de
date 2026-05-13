import Link from 'next/link';

export const metadata = { title: 'Datenschutz — kanbanly' };

export default function DatenschutzPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-fg mb-8">
          Datenschutzerklärung
        </h1>

        <div className="rounded-md bg-surface border border-line p-6 space-y-6 text-sm text-fg-soft leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              1. Verantwortlicher
            </h2>
            <p>
              Verantwortlich für die Verarbeitung personenbezogener Daten im
              Sinne von Art. 4 Nr. 7 DSGVO ist:
            </p>
            <p className="mt-2">
              Felix Franzen
              <br />
              Am Süllberg 6
              <br />
              29633 Munster
              <br />
              Deutschland
              <br />
              E-Mail: felixfranzen2026@gmail.com
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              2. Welche Daten wir verarbeiten
            </h2>
            <p>
              Wir verarbeiten nur die Daten, die wir zum Betrieb der App
              brauchen:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <strong className="text-fg-soft">Kontodaten:</strong> deine
                E-Mail-Adresse und ein gehashtes Passwort.
              </li>
              <li>
                <strong className="text-fg-soft">App-Inhalte:</strong> Boards,
                Listen, Karten, Checklisten und deren Reihenfolge, die du
                anlegst.
              </li>
              <li>
                <strong className="text-fg-soft">
                  Einladungen und Mitgliedschaften:
                </strong>{' '}
                E-Mail-Adressen eingeladener Personen und deren Rollen
                (Viewer, Editor, Admin) innerhalb von Workspaces und Boards.
              </li>
              <li>
                <strong className="text-fg-soft">Session-Cookies:</strong>{' '}
                technisch notwendige Cookies, um deine Anmeldung aufrecht zu
                erhalten.
              </li>
              <li>
                <strong className="text-fg-soft">Server-Logs:</strong> IP-Adresse,
                Zeitstempel, angefragte URL, User-Agent — werden maximal 14
                Tage zur Abwehr von Angriffen gespeichert und danach
                automatisch gelöscht.
              </li>
            </ul>
            <p className="mt-2">
              Wir setzen <strong>keine</strong> Analyse-, Tracking- oder
              Werbe-Tools ein. Keine Google Analytics, kein Meta-Pixel, keine
              Drittanbieter-Cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              3. Zwecke und Rechtsgrundlagen
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong className="text-fg-soft">
                  Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):
                </strong>{' '}
                Bereitstellung der Kanban-Funktionen, Account-Verwaltung,
                Einladungs-System.
              </li>
              <li>
                <strong className="text-fg-soft">
                  Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO):
                </strong>{' '}
                sicherer und stabiler Betrieb der Plattform (Server-Logs,
                Abwehr von Missbrauch).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              4. Auftragsverarbeiter
            </h2>
            <p>
              Wir nutzen technische Dienstleister, mit denen jeweils ein
              Auftragsverarbeitungsvertrag (Art. 28 DSGVO) besteht:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <strong className="text-fg-soft">Supabase Inc.</strong> —
                Authentifizierung und Datenbank. Serverregion Frankfurt
                (Deutschland). Daten verlassen die EU nicht.
              </li>
              <li>
                <strong className="text-fg-soft">Avoro</strong> — Hosting
                unseres Web-Servers in Deutschland.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              5. Drittlandsübermittlung
            </h2>
            <p>
              Es findet keine Datenübermittlung in Länder außerhalb der EU /
              des EWR statt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              6. Speicherdauer
            </h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Kontodaten und App-Inhalte: bis du dein Konto löschst.
              </li>
              <li>
                Einladungen: 14 Tage nach Versand bzw. sofort nach Annahme.
              </li>
              <li>Server-Logs: maximal 14 Tage.</li>
              <li>
                Session-Cookies: bis zum Logout bzw. bis zum Ablauf der
                Session.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              7. Deine Rechte
            </h2>
            <p>Du hast jederzeit das Recht auf:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Auskunft über deine gespeicherten Daten (Art. 15 DSGVO)</li>
              <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
              <li>Löschung deiner Daten (Art. 17 DSGVO)</li>
              <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
              <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
              <li>
                Widerspruch gegen Verarbeitungen auf Grundlage berechtigter
                Interessen (Art. 21 DSGVO)
              </li>
            </ul>
            <p className="mt-2">
              Zur Ausübung dieser Rechte reicht eine formlose E-Mail an{' '}
              <a
                href="mailto:felixfranzen2026@gmail.com"
                className="text-accent-soft hover:text-accent-hover"
              >
                felixfranzen2026@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              8. Beschwerderecht bei der Aufsichtsbehörde
            </h2>
            <p>
              Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde
              zu beschweren. Zuständig ist in Niedersachsen die
              Landesbeauftragte für den Datenschutz (
              <a
                href="https://lfd.niedersachsen.de"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-soft hover:text-accent-hover"
              >
                lfd.niedersachsen.de
              </a>
              ).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              9. Administrativer Zugriff
            </h2>
            <p>
              Der Betreiber kann im Rahmen der technischen Administration
              (Fehleranalyse, Missbrauchsbekämpfung, Support-Anfragen) mit
              erhöhten Rechten lesend auf Board-Inhalte, Karten, Kommentare und
              Aktivitätsprotokolle zugreifen. Dieser Zugriff erfolgt
              ausschließlich bei einem konkreten betrieblichen Anlass und wird
              nicht in den Aktivitäten des jeweiligen Boards sichtbar. Der
              Administrator nimmt dabei keine Änderungen an Inhalten vor und ist
              für andere Mitglieder nicht als „anwesend&quot; erkennbar. Rechtliche
              Grundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) am
              sicheren und stabilen Betrieb des Dienstes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              10. Automatisierte Entscheidungsfindung
            </h2>
            <p>
              Es findet keine automatisierte Entscheidungsfindung einschließlich
              Profiling im Sinne von Art. 22 DSGVO statt.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-fg mb-2">
              11. Änderungen dieser Erklärung
            </h2>
            <p>
              Wir passen diese Datenschutzerklärung an, wenn sich Funktionen
              oder gesetzliche Anforderungen ändern. Die jeweils aktuelle
              Fassung findest du stets auf dieser Seite.
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

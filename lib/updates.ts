export type Update = {
  date: string;
  title: string;
  description: string;
};

export const updates: Update[] = [
  {
    date: '2026-05-14',
    title: 'Phase 2: Verifizierung, Anti-Raid, Giveaways',
    description:
      'Drei neue Module. Verifizierung: Button-Panel das die Verified-Rolle vergibt — schützt vor Selfbots. Anti-Raid: erkennt Burst-Joins und reagiert mit Alert/Kick/Lockdown. Giveaways: /giveaway start mit Button-Teilnahme, automatischem Ende und Reroll — vollständig im Dashboard verwaltbar.',
  },
  {
    date: '2026-05-14',
    title: 'Reaction-Rollen: Buttons + Dropdown + Plain/Embed-Toggle',
    description:
      'Reaction-Roles können jetzt in drei Modi laufen: klassische Reaktionen, Buttons (bis 25), Dropdown-Menü. Modus pro Nachricht umschaltbar. Klicks auf Buttons/Dropdown werden im Log-Channel mitgeloggt. Welcome, DM, Booster, Sticky bekommen einen Toggle „als Embed senden" mit Farb-Picker.',
  },
  {
    date: '2026-05-14',
    title: 'Reaction-Rollen: Web-UI',
    description:
      'Reaction-Roles komplett über das Dashboard verwalten — Embed-Nachricht posten, Emoji↔Rolle-Zuordnungen hinzufügen/entfernen, alles mit Live-Discord-Aktionen. Slash-Command bleibt parallel verfügbar.',
  },
  {
    date: '2026-05-14',
    title: 'Discord-Bot: Phase 1 — 7 neue Module',
    description:
      'Booster-Message, DM-bei-Join (im Welcome-Tab), Sticky-Messages, Channel-Modes (Bilder-/Text-Only), Embed-Creator mit Live-Preview, sowie zwei neue Slash-Commands /slowmode und /roleall.',
  },
  {
    date: '2026-05-14',
    title: 'Bot-Landing-Page /bot',
    description:
      'Öffentliche Landing-Page für den Bot — Modul-Marketplace mit 13 Cards, Slash-Command-Liste, Bot-Invite-CTA. Ohne Login erreichbar.',
  },
  {
    date: '2026-05-14',
    title: 'Discord-Bot: Ticket-System',
    description:
      '/ticket panel create postet einen Button — User klicken und bekommen einen privaten Channel mit Staff. /ticket close oder Schließen-Button beendet das Ticket (Channel wird gelöscht).',
  },
  {
    date: '2026-05-14',
    title: 'Discord-Bot: Server-Stats Channels',
    description:
      'Voice-/Category-Channels mit Live-Counter — z.B. „👥 Members: 1.234". /serverstats add legt einen an, der Bot updated alle 10 Min. Variablen: {members}, {boosts}, {name}.',
  },
  {
    date: '2026-05-14',
    title: 'Discord-Bot: /remind',
    description:
      'Erinnerungen mit flexibler Zeitangabe (30m, 2h, 1d, oder kombiniert „1d 2h"). Bot postet im Original-Channel oder per DM. /remind list zeigt offene, /remind cancel löscht.',
  },
  {
    date: '2026-05-13',
    title: 'Discord-Bot: AutoMod',
    description:
      'Pro Server: Link-Filter mit Whitelist, Caps-Filter, Mention-Spam-Limit, verbotene Wörter. Matching ist case-insensitive auf Wort-Grenzen. Moderatoren werden nie gefiltert.',
  },
  {
    date: '2026-05-13',
    title: 'Discord-Bot: Custom Commands',
    description:
      'Eigene Prefix-Befehle pro Server. User schreibt z. B. `!rules` und der Bot antwortet mit dem hinterlegten Text. Prefix ist konfigurierbar.',
  },
  {
    date: '2026-05-13',
    title: 'Discord-Bot: /tag und /poll',
    description:
      '/tag — schnelle FAQ-Antworten mit Nutzungs-Counter. /poll — native Discord-Umfragen mit 2-10 Optionen, Multi-Select möglich, Laufzeit 1-768h.',
  },
  {
    date: '2026-05-12',
    title: 'Discord-Bot: XP-System & Levels',
    description:
      'Server-Mitglieder sammeln XP fürs Chatten (15-25 pro Message, 60s Cooldown). /rank zeigt Level und Progressbar, /leaderboard die Top 10. Im Dashboard: Level-Rewards (Rolle ab Level X) konfigurieren.',
  },
  {
    date: '2026-05-12',
    title: 'Discord-Bot: Logging',
    description:
      'Pro Server: Joins, Leaves, gelöschte/bearbeitete Nachrichten und Rollen-Änderungen in einen Log-Channel. Im Dashboard pro Event-Typ einzeln an/aus.',
  },
  {
    date: '2026-05-12',
    title: 'Discord-Bot: Moderation-Suite',
    description:
      '/warn (mit Historie), /kick, /ban, /timeout, /clear. Warnungen werden in der DB gespeichert, /warn list zeigt die ganze Historie pro User.',
  },
  {
    date: '2026-05-12',
    title: 'Discord-Bot: Auto-Roles',
    description:
      'Im Dashboard mehrere Rollen wählen, die jedem neuen Mitglied automatisch beim Server-Join vergeben werden.',
  },
  {
    date: '2026-05-05',
    title: 'Karten abonnieren + Aktivitäts-Feed',
    description:
      'Im Card-Modal unten links „🔔 Abonnieren" — du kriegst Updates zur Karte, auch ohne Assignee zu sein. Die Glocke oben zeigt jetzt einen Aktivitäts-Feed: Kommentare, Umbenennungen, Verschiebungen, Fälligkeiten, Archivierungen. Live ohne Reload.',
  },
  {
    date: '2026-05-05',
    title: 'Verknüpfte Karten',
    description:
      'Karten miteinander verknüpfen — z. B. Bug ↔ Feature, Brainstorming ↔ Umsetzung. Im Card-Modal über „+ Verknüpfen" suchen und auswählen. Klick auf eine Verknüpfung springt direkt zur Ziel-Karte.',
  },
  {
    date: '2026-05-05',
    title: 'Tabellen-Ansicht pro Board',
    description:
      'Neuer Tab „Tabelle": alle aktiven Karten als sortierbare Liste mit Titel, Spalte, Fälligkeit, Tasks, Labels, Zugewiesene. Sortierung per ?sort=list|due|title.',
  },
  {
    date: '2026-05-05',
    title: 'KI in Karten — Beschreibung verbessern, Subtasks vorschlagen',
    description:
      '✨ im Card-Modal: „Mit KI verbessern" formuliert die Beschreibung um, „Subtasks vorschlagen" generiert 3-6 abhakbare Aufgaben. Powered by Gemini, auf Deutsch.',
  },
  {
    date: '2026-05-05',
    title: 'Eigene Felder pro Board',
    description:
      'Strukturierte Zusatzdaten: Priorität, Story-Points, Kostenstelle — was du brauchst. Im neuen „Felder"-Tab definieren (Text, Zahl, Datum, Auswahl), Werte direkt im Card-Modal eingeben.',
  },
  {
    date: '2026-05-05',
    title: 'Automation: Wenn-Dann-Regeln (Beta)',
    description:
      'Neuer „Automation"-Tab pro Board. Beispiel-Regel: „Wenn Karte in Erledigt landet → archivieren". Aktuelle Actions: Archivieren, Fälligkeit entfernen, Label hinzufügen/entfernen, Zuweisungen leeren.',
  },
  {
    date: '2026-05-05',
    title: 'WIP-Limits pro Spalte',
    description:
      'Klassisches Kanban: jede Spalte kann ein Maximum an Karten haben. Im Spalten-Menü „WIP-Limit setzen". Bei Erreichen wird der Counter amber, bei Überschreitung rosa.',
  },
  {
    date: '2026-05-05',
    title: 'Karten archivieren statt löschen',
    description:
      'Karten verschwinden nicht mehr endgültig — sie wandern ins Archiv (neuer Tab pro Board) und können von dort wiederhergestellt oder erst dann endgültig gelöscht werden.',
  },
  {
    date: '2026-05-05',
    title: 'Drag-to-Pan im Board',
    description:
      'Klick und zieh in den leeren Raum zwischen Spalten — das ganze Board scrollt horizontal mit. Wie in Trello.',
  },
  {
    date: '2026-05-05',
    title: 'Klassischeres Dashboard mit Sidebar',
    description:
      'Linke Spalte zeigt Workspaces und Schnellzugriffe (Meine Karten, Diese Woche, Stats, Vorlagen). Rechts die Boards kompakter — eine Zeile pro Board statt großer Kachel.',
  },
  {
    date: '2026-04-19',
    title: 'Discord-Webhooks pro Board',
    description:
      'Board-Menü → „Discord-Webhook" → URL einfügen. Neue Karten und Verschiebungen landen automatisch in deinem Discord-Channel. Test-Button direkt drin.',
  },
  {
    date: '2026-04-19',
    title: 'Board-Layout: 2 Spalten für mehr Übersicht',
    description:
      'Öffnet eine Karte, siehst du links Name, Labels, Beschreibung und Checkliste — rechts direkt Kommentare und Aktivität. Kein ewiges Scrollen mehr.',
  },
  {
    date: '2026-04-19',
    title: 'Board mit KI erstellen (Beta)',
    description:
      'Beim Erstellen eines Boards: „✨ Teste die KI" klicken, Projekt beschreiben — Kanbanly generiert Listen, Labels und Beispielkarten. Powered by Gemini.',
  },
  {
    date: '2026-04-19',
    title: 'Login mit GitHub und Discord',
    description:
      'Auf den Login- und Register-Seiten kannst du jetzt mit deinem GitHub- oder Discord-Account starten. Benutzername wird aus deinem Profil vorgeschlagen und kann einmalig angepasst werden.',
  },
  {
    date: '2026-04-19',
    title: 'Recovery-Codes statt E-Mail-Bestätigung',
    description:
      'Kein Bestätigungslink mehr beim Signup. Stattdessen kriegst du 8 Recovery-Codes zum Speichern — einer davon setzt dein Passwort zurück, falls du es vergisst. Keine Wartezeiten, kein Rate-Limit.',
  },
  {
    date: '2026-04-18',
    title: 'Einladungs-Inbox + Gast-Boards auf Dashboard',
    description:
      'Neue Glocke oben rechts zeigt ausstehende Einladungen mit Annehmen-Button. Auf dem Dashboard erscheint eine „Als Gast"-Sektion für Boards fremder Workspaces. Im Board-Menü „Mitglieder" gibt es zusätzlich „Ausstehende Einladungen".',
  },
  {
    date: '2026-04-18',
    title: 'Live-Präsenz + Cursor im Card-Modal',
    description:
      'Oben im Board siehst du, wer gerade anwesend ist. Öffnen mehrere das gleiche Card-Modal, wandern ihre Cursor live sichtbar durchs Fenster.',
  },
  {
    date: '2026-04-18',
    title: 'Swimlanes',
    description:
      'Gruppier dein Board horizontal nach Zugewiesene oder Labels. Toggle oben rechts neben dem Filter.',
  },
  {
    date: '2026-04-18',
    title: 'Multi-Select auf Karten',
    description:
      'Shift+Klick (oder ⌘/Strg) wählt mehrere Karten. Bulk-verschieben, -löschen, -labeln über die Action-Bar unten.',
  },
  {
    date: '2026-04-18',
    title: 'Karte duplizieren + Inline-Edit',
    description:
      'Hover eine Karte → Drei-Punkt-Menü → Duplizieren (inkl. Tasks, Labels, Zugewiesene). Klick auf den Titel öffnet Inline-Rename.',
  },
  {
    date: '2026-04-18',
    title: '/stats und /woche',
    description:
      'Vanity-Metrics (Karten, Kommentare, Aktivitäten) und Montags-Wrap-up (Überfällig, Diese Woche fällig, Neu von dir) in der Nav erreichbar.',
  },
  {
    date: '2026-04-18',
    title: 'Global-Search mit ⌘K',
    description:
      'Drück ⌘K (oder Strg+K) irgendwo in der App — Boards, Karten, Workspaces und Quick-Actions in einer Palette. Mit „?" siehst du alle Shortcuts.',
  },
  {
    date: '2026-04-18',
    title: 'Board-Templates + Community',
    description:
      'Starte Boards aus kuratierten Templates (Sprint, Content-Kalender, GTD). Speichere eigene als Template — privat oder öffentlich für die Community.',
  },
  {
    date: '2026-04-18',
    title: 'Light- und Dark-Mode',
    description:
      'Theme-Toggle im Header. Wird persistiert und respektiert deine System-Einstellung.',
  },
  {
    date: '2026-04-18',
    title: 'E-Mail-Bestätigung als Zwei-Schritt',
    description:
      'Der Bestätigungslink führt jetzt zu einer Seite mit „Jetzt bestätigen"-Button — so können Mail-Scanner den Token nicht mehr vorab verbrauchen.',
  },
  {
    date: '2026-04-18',
    title: 'Spielbare Demo auf der Startseite',
    description:
      'Die Landing zeigt jetzt ein echtes, anfassbares Kanban-Board. Karten ziehen, Tasks abhaken — ganz ohne Anmeldung.',
  },
  {
    date: '2026-04-18',
    title: 'Mitglieder verwalten',
    description:
      'Board-Admins können Rollen ändern und Gäste entfernen — direkt im neuen „Mitglieder"-Dialog, inklusive Einladen.',
  },
  {
    date: '2026-04-18',
    title: 'Meine Karten',
    description:
      'Neue Ansicht oben in der Nav: alle dir zugewiesenen Karten workspace-übergreifend, gruppiert nach Fälligkeit.',
  },
  {
    date: '2026-04-18',
    title: 'Kalender pro Board',
    description:
      'Umschalter zwischen Board und Kalender. Karten mit „Fällig am" chronologisch in Überfällig / Heute / Diese Woche / Später.',
  },
  {
    date: '2026-04-18',
    title: 'Karten-Kommentare mit @mentions',
    description:
      'Diskussion pro Karte — Markdown, live synchronisiert, @username wird hervorgehoben, eigene Erwähnung in Emerald.',
  },
  {
    date: '2026-04-18',
    title: 'Board-Filter',
    description:
      'Karten nach Labels, Zuweisungen und Fälligkeit filtern. Aktive Filter als Chips, „Nur mir"-Shortcut.',
  },
  {
    date: '2026-04-18',
    title: 'Lesbare URLs',
    description:
      'Boards und Workspaces haben Slugs: /boards/mein-projekt statt UUID. Alte UUID-Links funktionieren weiter.',
  },
  {
    date: '2026-04-18',
    title: 'Default-Spalten + Tab-Titel',
    description:
      'Neue Boards starten mit „To do / In Arbeit / Erledigt". Browser-Tab zeigt den Board-Namen.',
  },
  {
    date: '2026-04-17',
    title: 'Markdown-Beschreibungen',
    description:
      'Beschreibungen unterstützen Markdown — Überschriften, Listen, Code, Tabellen, Checkboxen, Blockquotes.',
  },
  {
    date: '2026-04-17',
    title: 'Aktivitätslog pro Karte',
    description:
      'Jede Änderung an einer Karte wird mit Urheber und Zeit festgehalten — erstellt, verschoben, zugewiesen, Label, Tasks, Fälligkeit.',
  },
  {
    date: '2026-04-17',
    title: 'Realtime-Sync',
    description:
      'Mehrere Sessions am selben Board bleiben live synchron. Fremd geänderte Karten pulsen kurz in Emerald.',
  },
  {
    date: '2026-04-17',
    title: 'Labels & Fälligkeitsdaten',
    description:
      'Karten bekommen farbige Labels und ein Fällig-am — inkl. Tönen für überfällig, heute und bald.',
  },
  {
    date: '2026-04-17',
    title: 'Löschen mit Bestätigung',
    description:
      'Workspaces, Boards, Spalten, Karten und Labels per „⋯"-Menü löschen — mit sauberem Bestätigungsdialog.',
  },
  {
    date: '2026-04-17',
    title: 'Karten-Detail & Zuweisungen',
    description:
      'Vollbild-Modal mit Titel, Beschreibung, Checkliste und Zuweisung an Board-Mitglieder.',
  },
  {
    date: '2026-04-17',
    title: 'Einladungen per Link',
    description:
      'Board-Mitglieder können andere per Einladungs-Link hinzufügen — Rollen Viewer, Editor, Admin.',
  },
  {
    date: '2026-04-17',
    title: 'Workspaces & Boards',
    description:
      'Workspaces enthalten Boards. Das Dashboard listet alle auf.',
  },
  {
    date: '2026-04-16',
    title: 'Login-System',
    description: 'Konto mit E-Mail + Passwort, Bestätigung per E-Mail.',
  },
  {
    date: '2026-04-16',
    title: 'Kanban-Board online',
    description:
      'Drag & Drop zwischen Spalten, Checklisten mit Fortschrittsbalken.',
  },
];

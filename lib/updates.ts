export type Update = {
  date: string;
  title: string;
  description: string;
};

export const updates: Update[] = [
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

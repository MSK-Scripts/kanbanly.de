export type Update = {
  date: string;
  title: string;
  description: string;
};

export const updates: Update[] = [
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

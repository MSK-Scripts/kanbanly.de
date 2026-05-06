const EXACT: Record<string, string> = {
  'User already registered':
    'Diese E-Mail ist schon registriert. Versuch dich anzumelden.',
  'Invalid login credentials':
    'E-Mail oder Passwort stimmen nicht.',
  'Email not confirmed':
    'Bitte bestätige zuerst deine E-Mail mit dem Code, den wir dir geschickt haben.',
  'Password should be at least 6 characters':
    'Das Passwort muss mindestens 6 Zeichen lang sein.',
  'Password should be at least 6 characters.':
    'Das Passwort muss mindestens 6 Zeichen lang sein.',
  'Signup requires a valid password':
    'Bitte gib ein Passwort ein.',
  'Unable to validate email address: invalid format':
    'Diese E-Mail-Adresse ist nicht gültig.',
  'Email rate limit exceeded':
    'Zu viele Versuche in kurzer Zeit. Warte ein paar Minuten und probier es erneut.',
  'Signups not allowed for this instance':
    'Registrierung ist aktuell deaktiviert.',
  'Anonymous sign-ins are disabled':
    'Anonyme Anmeldung ist deaktiviert.',
  'Database error saving new user':
    'Das Konto konnte nicht angelegt werden. Bitte nochmal versuchen.',
  'Token has expired or is invalid':
    'Der Code ist falsch oder abgelaufen. Fordere einen neuen an.',
  'Email link is invalid or has expired':
    'Der Code ist abgelaufen. Fordere einen neuen an.',
  'Invalid OTP':
    'Dieser Code stimmt nicht. Prüf die Eingabe oder fordere einen neuen an.',
  'OTP expired': 'Der Code ist abgelaufen. Fordere einen neuen an.',
};

const CONTAINS: Array<{ needle: string; message: string }> = [
  {
    needle: 'duplicate key value violates unique constraint',
    message: 'Dieser Wert ist schon vergeben.',
  },
  {
    needle: 'profiles_username_format',
    message:
      'Benutzername: 3–20 Zeichen, nur Buchstaben, Ziffern, _ und -.',
  },
  {
    needle: 'For security purposes, you can only request this after',
    message:
      'Aus Sicherheitsgründen kurz gesperrt. Warte ein paar Sekunden und probier es nochmal.',
  },
  {
    needle: 'rate limit',
    message:
      'Zu viele Versuche. Warte ein paar Minuten und probier es nochmal.',
  },
  {
    needle: 'network',
    message: 'Netzwerk-Problem. Prüf deine Verbindung und versuch es erneut.',
  },
];

export function translateAuthError(raw: string | null | undefined): string {
  if (!raw) return 'Unbekannter Fehler. Bitte nochmal versuchen.';
  const trimmed = raw.trim();
  if (EXACT[trimmed]) return EXACT[trimmed];
  for (const { needle, message } of CONTAINS) {
    if (trimmed.toLowerCase().includes(needle.toLowerCase())) return message;
  }
  return trimmed;
}

export const USERNAME_RE = /^[a-zA-ZäöüÄÖÜß0-9_ -]{3,20}$/;

export function validateUsername(username: string): string | null {
  if (!username) return 'Bitte wähle einen Benutzernamen.';
  if (username.length < 3)
    return 'Der Benutzername muss mindestens 3 Zeichen lang sein.';
  if (username.length > 20)
    return 'Der Benutzername darf maximal 20 Zeichen lang sein.';
  if (username.startsWith(' ') || username.endsWith(' '))
    return 'Der Benutzername darf nicht mit einem Leerzeichen beginnen oder enden.';
  if (/ {2}/.test(username))
    return 'Der Benutzername darf keine doppelten Leerzeichen enthalten.';
  if (!USERNAME_RE.test(username))
    return 'Benutzername: nur Buchstaben (auch ä/ö/ü/ß), Ziffern, Leerzeichen, _ und - sind erlaubt.';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email) return 'Bitte gib deine E-Mail-Adresse ein.';
  if (email.length > 254) return 'Die E-Mail-Adresse ist zu lang.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return 'Das sieht nicht wie eine gültige E-Mail-Adresse aus.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Bitte gib ein Passwort ein.';
  if (password.length < 8)
    return 'Das Passwort muss mindestens 8 Zeichen lang sein.';
  if (password.length > 72)
    return 'Das Passwort darf maximal 72 Zeichen lang sein.';
  return null;
}

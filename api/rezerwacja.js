const { createHash } = require('node:crypto');

const objects = new Set(['Garaż', 'Dom / mieszkanie', 'Lokal usługowy', 'Hala / magazyn', 'Parking', 'Inny obiekt']);
const systems = new Set(['Epoksydowa standard', 'Antypoślizgowa', 'Dekoracyjna Flake', 'Poliuretanowa', 'Przemysłowa']);
const attempts = new Map();
const errorText = 'Nie udało się potwierdzić wysyłki. Spróbuj ponownie lub zadzwoń: 730 339 666.';

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function text(value, max, required = true) {
  if (typeof value !== 'string') return required ? null : '';
  const result = value.trim();
  if (result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) return null;
  return required && !result ? null : result;
}
function validate(body) {
  const client = text(body.client, 120), phone = text(body.phone, 30), city = text(body.city, 120);
  const email = text(body.email, 254, false), notes = text(body.notes, 2000, false);
  const date = text(body.date, 10), area = Number(body.area), system = text(body.system, 60);
  const requestId = text(body.requestId, 36);
  if (!client || client.length < 2 || !city || city.length < 2 || !phone || !/^[+\d\s().-]+$/.test(phone) || !/^\d{9,15}$/.test(phone.replace(/\D/g, ''))) return null;
  if (email === null || (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) || notes === null) return null;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(date + 'T12:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < today() || parsed.getTime() > Date.now() + 2 * 366 * 86400000) return null;
  if (!['string', 'number'].includes(typeof body.area) || !Number.isFinite(area) || area < 1 || area > 100000) return null;
  if (!objects.has(body.object) || !systems.has(system) || !requestId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId)) return null;
  return { client, phone, city, email, notes, date, area, system, object: body.object, requestId };
}
function allowedOrigin(origin) {
  const allowed = new Set(['https://duravero.pl', 'https://www.duravero.pl', 'https://duravero.vercel.app']);
  for (const name of ['VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
    if (process.env[name]) allowed.add('https://' + process.env[name]);
  }
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) allowed.add('http://localhost:3000');
  return allowed.has(origin);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const reply = (status, body) => res.status(status).json(body);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(405, { ok: false, message: 'Użyj formularza na stronie DURAVERO.' });
  }
  if (!allowedOrigin(req.headers.origin)) return reply(403, { ok: false, message: 'Wyślij zgłoszenie z naszej strony.' });
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return reply(415, { ok: false, message: 'Nieprawidłowy format zgłoszenia.' });
  let body;
  try {
    if (Number(req.headers['content-length']) > 12000) return reply(413, { ok: false, message: 'Zgłoszenie jest za długie.' });
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('body');
    if (Buffer.byteLength(JSON.stringify(body)) > 12000) return reply(413, { ok: false, message: 'Zgłoszenie jest za długie.' });
  } catch {
    return reply(400, { ok: false, message: 'Nieprawidłowe zgłoszenie.' });
  }
  if (body.website) return reply(400, { ok: false, message: 'Nieprawidłowe zgłoszenie.' });
  const data = validate(body);
  if (!data) return reply(400, { ok: false, message: 'Sprawdź dane: datę, imię, telefon, miejscowość i powierzchnię.' });
  if (!process.env.RESEND_API_KEY) return reply(503, { ok: false, message: 'Formularz jest chwilowo niedostępny. Zadzwoń: 730 339 666.' });

  // Best-effort, per-instance abuse limit. Enable a Vercel Firewall rate rule
  // for /api/rezerwacja for a distributed production limit.
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const ipHash = createHash('sha256').update(ip).digest('hex');
  const entry = attempts.get(ipHash) || { count: 0, until: now + 600000 };
  if (entry.count >= 5 || attempts.size >= 10000) {
    res.setHeader('Retry-After', '600');
    return reply(429, { ok: false, message: 'Zbyt wiele prób. Spróbuj za 10 minut lub zadzwoń: 730 339 666.' });
  }
  entry.count++;
  attempts.set(ipHash, entry);

  const idempotencyKey = 'duravero-' + createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const message = {
    from: process.env.RESEND_FROM || 'DURAVERO <kontakt@updates.duravero.pl>',
    to: ['kontakt@duravero.pl'],
    subject: 'DURAVERO — nowe zgłoszenie terminu ' + data.date,
    text: [
      'NOWE ZGŁOSZENIE — DO POTWIERDZENIA',
      'To zapytanie o dostępność, nie potwierdzona rezerwacja.',
      '',
      'Preferowany termin: ' + data.date,
      'Klient / firma: ' + data.client,
      'Telefon: ' + data.phone,
      'E-mail: ' + (data.email || 'Nie podano'),
      'Miejscowość: ' + data.city,
      'Powierzchnia: ' + data.area + ' m²',
      'Rodzaj obiektu: ' + data.object,
      'Rodzaj posadzki: ' + data.system,
      'Uwagi: ' + (data.notes || 'Brak'),
      '',
      'Skontaktuj się z klientem, ustal zakres i potwierdź termin.',
      'Numer zgłoszenia: ' + data.requestId
    ].join('\n')
  };
  if (data.email) message.reply_to = data.email;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(12000)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.id) {
      // Never log customer data, provider error bodies or API credentials.
      console.error('booking_email_failed', response.status);
      return reply(502, { ok: false, message: errorText });
    }
    return reply(200, { ok: true, requestId: data.requestId, message: 'Zgłoszenie przyjęte do wysyłki. Skontaktujemy się, aby potwierdzić termin.' });
  } catch {
    console.error('booking_email_unconfirmed');
    return reply(502, { ok: false, message: errorText });
  }
};

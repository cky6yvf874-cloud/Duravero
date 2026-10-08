# DURAVERO

Istniejąca strona HTML, kalkulator i formularz zgłoszenia terminu.
Wygląd głównej grafiki i dotychczasowe stawki kalkulatora są zachowane.

## Wdrożenie w obecnym projekcie Vercel

1. Zapisz zawartość tego repozytorium na gałęzi `main` w `cky6yvf874-cloud/Duravero`.
2. Korzystaj z istniejącego projektu Vercel połączonego z tym repozytorium.
   Framework Preset: **Other**, Root Directory: katalog główny, bez własnego
   Build Command i Output Directory. Funkcja jest w `api/rezerwacja.js`.
3. W zmiennych środowiskowych **Production** musi być `RESEND_API_KEY`.
   Klucz pozostaje wyłącznie w Vercel; nie umieszczaj go w GitHubie ani HTML.
4. Domyślny nadawca to `DURAVERO <kontakt@updates.duravero.pl>`.
   **Przed publikacją sprawdź**, że `updates.duravero.pl` jest domeną
   **Verified** w Resend i że klucz pozwala z niej wysyłać.
   Jeśli zweryfikowana jest inna domena, ustaw `RESEND_FROM` z adresem
   w tej dokładnej domenie. Nie dodawaj w ciemno nowych rekordów DNS.
5. Odbiorca jest stały: `kontakt@duravero.pl`. Wysłanie przez Resend
   nie tworzy tej skrzynki. Sprawdź logowanie i odbiór poczty na home.pl
   oraz rekordy MX wskazane przez dostawcę skrzynki.
6. Zapis na `main` powinien uruchomić nowe wdrożenie. Po zmianie zmiennych
   wykonaj Redeploy. Sprawdź status Ready i przypisanie obu domen.
7. W Vercel Firewall włącz limit żądań dla `/api/rezerwacja`, gdy plan
   umożliwia takie reguły. Ogranicznik w kodzie działa per instancja,
   więc nie jest globalną ochroną przed rozproszonym spamem.

## Sprawdzenie po wdrożeniu

- Sprawdź HTTPS dla `duravero.pl` i `www.duravero.pl`. Ustaw przekierowanie
  `www` na `duravero.pl`, aby zgadzało się z adresem canonical i sitemap.
- Wyślij **jedno** jawnie oznaczone zgłoszenie testowe ze swoimi danymi.
- Sprawdź sukces na stronie, wiadomość w skrzynce (także Spam) i status
  wiadomości w Resend. HTTP 200 potwierdza przyjęcie przez dostawcę do
  wysyłki, nie doręczenie. Dopiero odbiór wiadomości kończy weryfikację.
- Formularz po błędzie zachowuje dane. Ponowienie tych samych danych używa
  tego samego klucza idempotencji; Resend deduplikuje przez 24 godziny.
- Zgłoszenie zawsze jest **do potwierdzenia**. Właściciel kontaktuje się
  z klientem i potwierdza termin; brak automatycznej blokady kalendarza.
- Nie ma bazy zgłoszeń: trwałym zapisem jest dostarczona wiadomość w skrzynce.
  Przy awarii klient otrzymuje błąd i telefon kontaktowy.

## SEO i prywatność

- Poprawiony title, canonical, H1, lokalny opis, FAQ, sitemap i robots.
- Zasięg priorytetowy: Mława i okolice 60–80 km; Warszawa drugorzędnie.
- Nie ma fikcyjnych realizacji, opinii ani publicznego adresu właściciela.
- Informację o prywatności trzeba utrzymywać zgodnie z rzeczywistymi
  dostawcami i zasadami przechowywania danych administratora.
- Nie dodano nieznanego identyfikatora GA4 ani narzędzi reklamowych.
  W Search Console dodaj `https://duravero.pl/sitemap.xml` po wdrożeniu;
  narzędzia analityczne wymagają osobnej konfiguracji i ustaleń prywatności.

## Testy

`npm test` uruchamia testy backendu z atrapą Resend — bez prawdziwej wysyłki.
Nie wymagają bibliotek zewnętrznych ani prawdziwego klucza.

Dokumentacja dostawców:
- https://vercel.com/docs/functions/runtimes/node-js
- https://resend.com/docs/api-reference/emails/send-email

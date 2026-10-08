(function () {
  'use strict';
  var form = document.getElementById('bookingForm');
  if (!form) return;
  var button = document.getElementById('bookingSubmit');
  var status = document.getElementById('formMessage');
  var submitting = false;
  var sent = false;
  var requestId = null;
  var signature = null;
  var formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' });
  var dateField = document.getElementById('date');
  dateField.min = formatter.format(new Date());
  var maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 2 * 366);
  dateField.max = formatter.format(maxDate);
  button.disabled = false;

  function message(state, content) {
    status.dataset.state = state;
    status.textContent = content;
    status.focus();
  }
  form.addEventListener('input', function () {
    if (sent) {
      sent = false;
      button.disabled = false;
      button.textContent = 'WYŚLIJ ZGŁOSZENIE →';
      status.textContent = '';
    }
  });
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (submitting || sent || !form.reportValidity()) return;
    dateField.min = formatter.format(new Date());
    if (!form.reportValidity()) return;
    var data = Object.fromEntries(new FormData(form).entries());
    if (!/^\d{9,15}$/.test(data.phone.replace(/\D/g, '')) || !/^[+\d\s().-]+$/.test(data.phone)) {
      message('error', 'Wpisz poprawny numer telefonu (9–15 cyfr).');
      document.getElementById('phone').focus();
      return;
    }
    var currentSignature = JSON.stringify(data);
    if (signature !== currentSignature) {
      signature = currentSignature;
      requestId = crypto.randomUUID();
    }
    data.requestId = requestId;
    submitting = true;
    button.disabled = true;
    button.textContent = 'WYSYŁANIE…';
    status.textContent = 'Wysyłamy zgłoszenie…';
    var fields = Array.from(form.querySelectorAll('input, select, textarea'));
    fields.forEach(function (field) { field.disabled = true; });
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 18000);
    try {
      var response = await fetch('/api/rezerwacja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      var result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.message || 'Nie udało się potwierdzić wysyłki. Spróbuj ponownie lub zadzwoń: 730 339 666.');
      sent = true;
      message('success', result.message);
      button.textContent = 'ZGŁOSZENIE PRZYJĘTE ✓';
    } catch (error) {
      message('error', error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError
        ? 'Nie udało się potwierdzić wysyłki. Dane pozostały w formularzu. Spróbuj ponownie lub zadzwoń: 730 339 666.'
        : error.message);
      button.textContent = 'SPRÓBUJ WYSŁAĆ PONOWNIE →';
    } finally {
      clearTimeout(timeout);
      fields.forEach(function (field) { field.disabled = false; });
      submitting = false;
      button.disabled = sent;
    }
  });
})();

"use strict";
(() => {
  const formats = window.SkinForgeFormats;
  const selector = document.querySelector('#skin-server');
  for (const profile of formats.profiles) selector.add(new Option(profile.name, profile.id));
  function updateSelection() {
    const profile = formats.selected;
    selector.value = profile.id;
    window.skinforgeSelectedServer = profile;
    document.querySelector('#output-server-name').textContent = profile.name;
  }
  selector.addEventListener('change', () => {
    try { changeSkinServer(selector.value); }
    catch (error) {
      toast('Server not changed: ' + error.message, true);
      setValidity(false, 'Conversion blocked', 'Fix or load the pasted JSON before changing servers. ' + error.message);
    }
    updateSelection();
  });
  updateSelection();
  const dialog = document.querySelector('#server-request-dialog');
  const form = document.querySelector('#server-request-form');
  const fields = document.querySelector('#server-request-fields');
  const status = document.querySelector('#server-request-status');
  const sample = document.querySelector('#server-request-json');
  const fileInput = document.querySelector('#server-request-file');
  const submit = document.querySelector('#server-request-submit');
  let sending = false;
  function validateSample(text) {
    const cleaned = cleanPastedText(text);
    if (!cleaned || cleaned.length > 20000) throw Error('Provide example JSON up to 20,000 characters.');
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object') throw Error('Example JSON must be an object or array.');
    return cleaned;
  }
  document.querySelector('#server-request-button').addEventListener('click', () => dialog.showModal());
  document.querySelector('#server-request-open').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0]; fileInput.value = '';
    if (!file) return;
    try {
      if (file.size > 100000) throw Error('Choose a smaller JSON example (up to 20,000 characters).');
      const text = await file.text(); sample.value = validateSample(text); status.textContent = 'Example loaded. Review it before sending.';
    } catch (error) { status.textContent = error.message; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (sending) return;
    try {
      const name = document.querySelector('#server-request-name').value.trim();
      if (!name) throw Error('Enter the server name.');
      const data = new FormData();
      data.set('type', 'server-request'); data.set('serverName', name);
      data.set('message', document.querySelector('#server-request-notes').value.trim() || 'Please add support for this server.');
      data.set('skin', validateSample(sample.value));
      sending = true; fields.disabled = true; submit.textContent = 'Sending...'; status.textContent = 'Sending your request...';
      const response = await fetch('/api/report', { method: 'POST', body: data });
      const result = await response.json().catch(() => { throw Error('The server did not return a valid response. Your draft has been kept.'); });
      if (!response.ok) throw Error(result.message || 'Request could not be sent.');
      if (result.delivered !== true || !result.messageId) throw Error('Delivery was not confirmed. Please check before retrying.');
      form.reset(); status.textContent = 'Server request sent for review. Discord reference: ' + result.messageId;
    } catch (error) {
      status.textContent = error instanceof TypeError ? 'Delivery could not be confirmed. Your draft has been kept; please wait before retrying.' : error.message;
    } finally { sending = false; fields.disabled = false; submit.textContent = 'Send request'; }
  });
})();

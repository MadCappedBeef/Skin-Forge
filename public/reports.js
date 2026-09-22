"use strict";
(() => {
  const dialog = document.querySelector('#report-dialog');
  const form = document.querySelector('#report-form');
  const files = document.querySelector('#report-images');
  const include = document.querySelector('#report-include-skin');
  const status = document.querySelector('#report-status');
  const fields = document.querySelector('#report-fields');
  const submit = document.querySelector('#report-submit');
  let urls = [], sending = false;
  function refreshSkin() {
    document.querySelector('#report-skin-preview').hidden = !include.checked;
    document.querySelector('#report-skin-code').textContent = include.checked ? formatJSON() : '';
  }
  function validateImages() {
    if (files.files.length > 3) throw Error('Choose no more than three images.');
    for (const file of files.files) {
      if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) throw Error('Images must be PNG, JPEG, GIF or WebP.');
      if (!file.size || file.size > 2 * 1024 * 1024) throw Error('Each image must be between 1 byte and 2 MB.');
    }
  }
  function refreshImages() {
    document.querySelector('#report-file-count').textContent = files.files.length ? `${files.files.length} image${files.files.length === 1 ? '' : 's'} selected` : 'No images selected';
    urls.forEach(url => URL.revokeObjectURL(url)); urls = [];
    const list = document.querySelector('#report-image-list'); list.replaceChildren();
    document.querySelector('#report-clear-images').hidden = !files.files.length;
    try {
      validateImages(); status.textContent = '';
      for (const file of files.files) {
        const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption');
        image.src = URL.createObjectURL(file); urls.push(image.src); image.alt = file.name;
        caption.textContent = file.name; figure.append(image, caption); list.append(figure);
      }
    } catch (error) { status.textContent = error.message; }
  }
  document.querySelector('#report-button').addEventListener('click', () => { refreshSkin(); dialog.showModal(); });
  include.addEventListener('change', refreshSkin);
  window.addEventListener('skinforge:skin-change', () => { if (dialog.open) refreshSkin(); });
  files.addEventListener('change', refreshImages);
  document.querySelector('#report-choose-images').addEventListener('click', () => files.click());
  document.querySelector('#report-clear-images').addEventListener('click', () => { files.value = ''; refreshImages(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    try {
      validateImages();
      const message = document.querySelector('#report-message').value.trim();
      if (!message) throw Error('Please describe the issue before sending.');
      const data = new FormData(); data.append('message', message);
      data.append('species', document.querySelector('#viewer-species').selectedOptions[0]?.textContent || 'Not selected');
      for (const file of files.files) data.append('images', file);
      if (include.checked) data.append('skin', formatJSON());
      sending = true; fields.disabled = true; submit.textContent = 'Sending…'; status.textContent = 'Sending your report…';
      const response = await fetch('/api/report', { method: 'POST', body: data });
      const result = await response.json().catch(() => { throw Error('The report endpoint did not return a valid response. Please update the site and try again.'); });
      if (!response.ok) throw Error(result.message || 'Report could not be sent. Please try again later.');
      if (result.delivered !== true || !result.messageId) throw Error('Discord delivery was not confirmed. Your draft has been kept. Please update the site before retrying.');
      form.reset(); refreshImages(); refreshSkin(); status.textContent = result.message;
    } catch (error) {
      status.textContent = error instanceof TypeError ? 'Your browser could not confirm a response from SkinForge. Check your connection and the report channel before retrying. Your draft has been kept.' : error.message;
    } finally { sending = false; fields.disabled = false; submit.textContent = 'Send report'; }
  });
})();

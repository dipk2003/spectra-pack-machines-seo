(function () {
  const nonce = __NONCE__;
  const maxBytes = __MAX_BYTES__;
  if (typeof window.__spectraCrmExportCleanup === 'function') window.__spectraCrmExportCleanup();
  let port = null;
  let busy = false;
  const send = (data) => port && port.postMessage(JSON.stringify({ nonce, ...data }));
  function receive(event) {
    if (event.data !== nonce || event.ports.length !== 1) return;
    port = event.ports[0];
    window.removeEventListener('message', receive);
  }
  window.addEventListener('message', receive);
  function click(event) {
    const anchor = event.target instanceof Element ? event.target.closest('a[download]') : null;
    if (!anchor || !anchor.href.startsWith('blob:' + location.origin + '/')) return;
    // Fetch begins synchronously during click handling, before the site revokes the URL.
    if (!port) return;
    event.preventDefault();
    if (busy) return;
    busy = true;
    fetch(anchor.href).then(response => response.blob()).then(blob => {
      if (blob.size > maxBytes) throw new Error('too_large');
      const reader = new FileReader();
      reader.onload = () => {
        send({ type: 'export', name: anchor.download, mime: blob.type, data: reader.result });
        busy = false;
      };
      reader.onerror = () => { send({ type: 'error' }); busy = false; };
      reader.readAsDataURL(blob);
    }).catch(() => { send({ type: 'error' }); busy = false; });
  }
  document.addEventListener('click', click, true);
  window.__spectraCrmExportCleanup = () => {
    window.removeEventListener('message', receive);
    document.removeEventListener('click', click, true);
    if (port) port.close();
  };
})();

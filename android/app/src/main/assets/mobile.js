(function () {
  const nonce = __NONCE__;
  const initial = __STATE__;
  let port;
  const pending = new Map();
  function receive(event) {
    if (event.data !== nonce || event.ports.length !== 1) return;
    window.removeEventListener('message', receive);
    port = event.ports[0];
    window.SpectraCRM = {
      state: initial,
      request(input) {
        return new Promise((resolve, reject) => {
          if (!['open_external', 'location_start', 'location_stop'].includes(input.type)) return reject(new Error('Unsupported phone action.'));
          const id = crypto.randomUUID();
          const timer = setTimeout(() => { pending.delete(id); reject(new Error('Phone action timed out.')); }, input.type === 'location_start' ? 60000 : 8000);
          pending.set(id, { resolve, reject, timer });
          port.postMessage(JSON.stringify({ ...input, id, nonce }));
        });
      },
    };
    port.onmessage = function (message) {
      let value;
      try { value = JSON.parse(message.data); } catch { return; }
      if (value.nonce !== nonce) return;
      if (value.state) {
        Object.assign(window.SpectraCRM.state, value.state);
        window.dispatchEvent(new CustomEvent('spectra-native-state'));
      }
      if (value.type === 'location' && window.SpectraCRM.state.foreground) window.dispatchEvent(new CustomEvent('spectra-native-location', { detail: value.point }));
      if (value.id && pending.has(value.id)) {
        const request = pending.get(value.id); clearTimeout(request.timer); pending.delete(value.id);
        if (value.error) request.reject(new Error(value.error)); else request.resolve(value);
      }
    };
    window.dispatchEvent(new CustomEvent('spectra-native-ready'));
  }
  window.addEventListener('message', receive);
})();

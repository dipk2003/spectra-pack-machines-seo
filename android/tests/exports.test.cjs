const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

async function main() {
  const listeners = new Map(), sent = [];
  const window = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  const document = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  let revoked = false, fetchedBeforeRevoke = false;
  const port = { postMessage: data => sent.push(JSON.parse(data)), close() {} };
  class Element { closest() { return this; } }
  class FileReader {
    readAsDataURL(blob) { this.result = 'data:text/csv;base64,' + Buffer.from(blob.csv).toString('base64'); this.onload(); }
  }
  const script = fs.readFileSync('android/app/src/main/assets/exports.js', 'utf8')
    .replace('__NONCE__', JSON.stringify('test-channel')).replace('__MAX_BYTES__', '1000');
  const context = vm.createContext({ window, document, location: { origin: 'https://spectrapackmachines.com' }, Element, FileReader,
    fetch: async () => { fetchedBeforeRevoke = !revoked; return { blob: async () => ({ size: 12, type: 'text/csv', csv: 'name\nExample' }) }; },
  });
  vm.runInContext(script, context);
  listeners.get('message')({ data: 'wrong-token', ports: [port] });
  assert.equal(listeners.has('message'), true, 'Unexpected messages cannot attach a port');
  listeners.get('message')({ data: 'test-channel', ports: [port] });
  assert.equal(listeners.has('message'), false);
  const anchor = new Element(); anchor.href = 'blob:https://spectrapackmachines.com/export'; anchor.download = 'leads.csv';
  let prevented = false;
  listeners.get('click')({ target: anchor, preventDefault() { prevented = true; } });
  revoked = true; // Existing CRM revokes its URL immediately after anchor.click().
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prevented, true);
  assert.equal(fetchedBeforeRevoke, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].name, 'leads.csv');
  assert.equal(Buffer.from(sent[0].data.split(',')[1], 'base64').toString(), 'name\nExample');
  const foreign = new Element(); foreign.href = 'blob:https://evil.test/export';
  listeners.get('click')({ target: foreign, preventDefault() { throw Error('External blob was intercepted'); } });
  vm.runInContext(script, context); // Rebinding removes the previous listeners.
  assert.equal(listeners.size, 2);
  console.log('Android CSV export, URL revocation timing and channel isolation checks passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

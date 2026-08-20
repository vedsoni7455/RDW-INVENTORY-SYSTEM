const textEncoding = require('text-encoding');
const TextEncoder = textEncoding.TextEncoder;
const TextDecoder = textEncoding.TextDecoder;

try {
  console.log('[Polyfill] Imported TextDecoder:', TextDecoder ? 'Functional' : 'undefined');
  console.log('[Polyfill] Original global.TextDecoder:', global.TextDecoder ? 'Functional' : 'undefined');

  // Override global, globalThis, and self with Object.defineProperty
  const polyfills = [
    { target: global, name: 'TextEncoder', value: TextEncoder },
    { target: global, name: 'TextDecoder', value: TextDecoder },
    { target: globalThis, name: 'TextEncoder', value: TextEncoder },
    { target: globalThis, name: 'TextDecoder', value: TextDecoder },
  ];

  if (typeof self !== 'undefined') {
    polyfills.push({ target: self, name: 'TextEncoder', value: TextEncoder });
    polyfills.push({ target: self, name: 'TextDecoder', value: TextDecoder });
  }

  for (const item of polyfills) {
    try {
      // Attempt delete first to avoid non-configurable issues
      delete (item.target as any)[item.name];
    } catch (e) {}

    try {
      Object.defineProperty(item.target, item.name, {
        value: item.value,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch (e) {
      // Fallback to direct assignment
      (item.target as any)[item.name] = item.value;
    }
  }

  console.log('[Polyfill] Assigned global.TextDecoder:', global.TextDecoder ? 'Functional' : 'undefined');

  // Test it
  const dec = new global.TextDecoder('latin1');
  console.log('[Polyfill] Tested and successfully created latin1 TextDecoder');
} catch (error: any) {
  console.error('[Polyfill] Error setting polyfills:', error.message);
}

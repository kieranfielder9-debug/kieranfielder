const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function newId(prefix = 'n'): string {
  let out = '';
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(10);
    cryptoObj.getRandomValues(bytes);
    for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  } else {
    for (let i = 0; i < 10; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}_${out}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

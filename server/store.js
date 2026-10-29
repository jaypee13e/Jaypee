// Tiny JSON-file store. Swap for a real database later if you need one.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(process.env.DATA_DIR || path.join(here, 'data'));

// One promise chain per collection so concurrent requests never interleave read-modify-write.
const queues = new Map();
const serial = (name, fn) => {
  const next = (queues.get(name) || Promise.resolve()).then(fn, fn);
  queues.set(name, next.catch(() => {}));
  return next;
};

const file = (name) => path.join(DIR, name + '.json');

async function read(name) {
  try { return JSON.parse(await fs.readFile(file(name), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}

async function write(name, rows) {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = file(name) + '.' + process.pid + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(rows, null, 2));
  await fs.rename(tmp, file(name)); // atomic replace: a crash never leaves half a file
}

export const store = {
  list: (name) => serial(name, () => read(name)),

  add: (name, row) => serial(name, async () => {
    const rows = await read(name);
    const saved = { id: randomUUID(), createdAt: new Date().toISOString(), ...row };
    rows.push(saved);
    await write(name, rows);
    return saved;
  }),

  update: (name, id, patch) => serial(name, async () => {
    const rows = await read(name);
    const row = rows.find((r) => r.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    await write(name, rows);
    return row;
  }),

  remove: (name, id) => serial(name, async () => {
    const rows = await read(name);
    const next = rows.filter((r) => r.id !== id);
    if (next.length === rows.length) return false;
    await write(name, next);
    return true;
  }),
};

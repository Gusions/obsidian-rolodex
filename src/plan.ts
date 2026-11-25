/** Decides which contacts are new, and builds the note for each. Pure, no Obsidian imports. */
import type { Contact } from './vcf.ts';

export interface KeySource { uid?: string; name: string; phones: string[]; emails: string[] }

const digits = (s: string) => s.replace(/\D/g, '');
export const normName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Identity keys of a person. Two entries are "the same" when they share any key:
 *  - the vCard UID, when the phone exporter wrote one;
 *  - the same name together with the same phone number (last 9 digits) or the same e-mail.
 * Matching on any one key means a person who gained a new number is still recognised.
 */
export function keysOf(c: KeySource): string[] {
  const keys: string[] = [];
  if (c.uid && c.uid.trim()) keys.push('u:' + c.uid.trim().toLowerCase());
  const n = normName(c.name);
  const ids = [
    ...c.phones.map(digits).filter(d => d.length >= 6).map(d => 'p:' + d.slice(-9)),
    ...c.emails.map(e => 'e:' + e.trim().toLowerCase()).filter(e => e.length > 3),
  ];
  if (ids.length) for (const id of new Set(ids)) keys.push(`c:${n}|${id}`);
  else keys.push(`c:${n}|`);
  return keys;
}

export interface Plan {
  fresh: Contact[];
  /** already in the address book (or repeated inside the file) */
  existing: number;
}

/** `seen` holds the keys of everyone already imported. It is not modified. */
export function planImport(contacts: Contact[], seen: Set<string>): Plan {
  const local = new Set(seen);
  const fresh: Contact[] = [];
  let existing = 0;
  for (const c of contacts) {
    const ks = keysOf(c);
    if (ks.some(k => local.has(k))) { existing++; continue; }
    ks.forEach(k => local.add(k));
    fresh.push(c);
  }
  return { fresh, existing };
}

const BAD = /[\\/:*?"<>|#^[\]]/g;
export function fileName(name: string): string {
  const s = name.replace(BAD, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 120).trim();
  return s || 'Senza nome';
}

/** A free file name inside `taken` (lower-cased names without extension): "Name", "Name (Org)", "Name (2)"… */
export function uniqueName(c: Contact, taken: Set<string>): string {
  const base = fileName(c.name);
  const tries = [base];
  if (c.org && normName(c.org) !== normName(c.name)) tries.push(fileName(`${base} (${c.org})`));
  for (const t of tries) if (!taken.has(t.toLowerCase())) return t;
  for (let i = 2; ; i++) { const t = `${tries[tries.length - 1]} (${i})`; if (!taken.has(t.toLowerCase())) return t; }
}

const q = (s: string) => JSON.stringify(s);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function buildNote(c: Contact, today: string): string {
  const L = ['---', 'tipo: contatto', `nome: ${q(c.name)}`];
  const one = (k: string, v: string) => { if (v) L.push(`${k}: ${q(v)}`); };
  const many = (k: string, v: string[]) => { if (v.length) { L.push(`${k}:`); v.forEach(x => L.push(`  - ${q(x)}`)); } };
  one('soprannome', c.nickname);
  one('azienda', c.org);
  one('ruolo', c.title);
  many('telefono', c.phones);
  many('email', c.emails);
  many('indirizzo', c.addresses);
  if (c.birthday) L.push(isDate(c.birthday) ? `compleanno: ${c.birthday}` : `compleanno: ${q(c.birthday)}`);
  many('sito', c.urls);
  one('vcf_uid', c.uid);
  L.push(`importato: ${today}`, '---', '');
  if (c.note) L.push('## Note', '', c.note, '');
  return L.join('\n');
}

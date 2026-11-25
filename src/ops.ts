import { App, TFile, moment, normalizePath } from 'obsidian';
import type { Contact } from './vcf.ts';
import { buildNote, keysOf, uniqueName } from './plan.ts';

export const inFolder = (path: string, folder: string) => path.startsWith(folder.replace(/\/+$/, '') + '/');

const first = (v: any): string => (Array.isArray(v) ? v[0] : v) ?? '';
const list = (v: any): string[] => (Array.isArray(v) ? v : v ? [v] : []).map(String);

/** Everyone already in the address book: the keys remembered from past imports plus the notes currently in the folder. */
export function knownKeys(app: App, folder: string, remembered: string[]): Set<string> {
  const seen = new Set(remembered);
  for (const f of app.vault.getMarkdownFiles()) {
    if (!inFolder(f.path, folder)) continue;
    const fm = app.metadataCache.getFileCache(f)?.frontmatter;
    if (!fm) continue;
    keysOf({ uid: fm.vcf_uid ? String(fm.vcf_uid) : '', name: String(fm.nome || f.basename), phones: list(fm.telefono), emails: list(fm.email) }).forEach(k => seen.add(k));
  }
  return seen;
}

export interface ImportResult { created: number; failed: number; keys: string[] }

/** Creates one note per contact. Never edits or deletes anything that exists. */
export async function importContacts(app: App, folder: string, contacts: Contact[], onProgress: (i: number) => void): Promise<ImportResult> {
  folder = normalizePath(folder);
  if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder).catch(() => {});
  const taken = new Set<string>();
  for (const f of app.vault.getMarkdownFiles()) if (inFolder(f.path, folder)) taken.add(f.basename.toLowerCase());
  const today = moment().format('YYYY-MM-DD');
  const res: ImportResult = { created: 0, failed: 0, keys: [] };
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    const name = uniqueName(c, taken);
    try {
      await app.vault.create(`${folder}/${name}.md`, buildNote(c, today));
      taken.add(name.toLowerCase());
      res.created++;
      keysOf(c).forEach(k => res.keys.push(k));
    } catch { res.failed++; }
    if (i % 20 === 19) { onProgress(i + 1); await new Promise(r => setTimeout(r)); }
  }
  onProgress(contacts.length);
  return res;
}

export interface Row { file: TFile; name: string; org: string; phone: string; email: string }

export function readRows(app: App, folder: string): Row[] {
  const rows: Row[] = [];
  for (const f of app.vault.getMarkdownFiles()) {
    if (!inFolder(f.path, folder)) continue;
    const fm = app.metadataCache.getFileCache(f)?.frontmatter || {};
    rows.push({ file: f, name: String(fm.nome || f.basename), org: String(fm.azienda || ''), phone: String(first(fm.telefono)), email: String(first(fm.email)) });
  }
  return rows;
}

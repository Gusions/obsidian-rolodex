/** vCard (.vcf) parser: versions 2.1, 3.0 and 4.0. Pure, no Obsidian imports, so it can be tested from node. */

export interface Contact {
  uid: string;
  name: string;
  org: string;
  title: string;
  nickname: string;
  phones: string[];
  emails: string[];
  addresses: string[];
  birthday: string;
  urls: string[];
  note: string;
}

export interface ParseResult {
  contacts: Contact[];
  /** cards found in the file */
  total: number;
  /** cards with no usable name, phone or email */
  skipped: number;
}

interface Prop { name: string; params: Record<string, string[]>; value: string }

/** Split on `ch`, ignoring any inside double quotes. */
function splitOutside(s: string, ch: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (const c of s) {
    if (c === '"') inQ = !inQ;
    if (c === ch && !inQ) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Split on `ch` unless escaped with a backslash. */
function splitUnescaped(s: string, ch: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) { cur += s[i] + s[i + 1]; i++; continue; }
    if (s[i] === ch) { out.push(cur); cur = ''; } else cur += s[i];
  }
  out.push(cur);
  return out;
}

export function unescapeText(s: string): string {
  return s.replace(/\\([nN,;\\])/g, (_m, c) => (c === 'n' || c === 'N' ? '\n' : c));
}

function decodeQP(v: string, charset?: string): string {
  const bytes: number[] = [];
  const enc = new TextEncoder();
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(v.slice(i + 1, i + 3))) { bytes.push(parseInt(v.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(...enc.encode(v[i]));
  }
  const arr = new Uint8Array(bytes);
  try { return new TextDecoder(charset || 'utf-8').decode(arr); } catch { return new TextDecoder().decode(arr); }
}

/** Join folded lines (RFC 6350 and quoted-printable soft breaks). */
export function unfold(text: string): string[] {
  const raw = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const folded: string[] = [];
  for (const l of raw) {
    if (/^[ \t]/.test(l) && folded.length) folded[folded.length - 1] += l.slice(1);
    else folded.push(l);
  }
  const out: string[] = [];
  for (let i = 0; i < folded.length; i++) {
    let l = folded[i];
    const colon = l.indexOf(':');
    if (colon > 0 && /QUOTED-PRINTABLE/i.test(l.slice(0, colon))) {
      while (l.endsWith('=') && i + 1 < folded.length) { l = l.slice(0, -1) + folded[++i]; }
    }
    out.push(l);
  }
  return out;
}

function parseLine(line: string): Prop | null {
  let inQ = false, idx = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ':' && !inQ) { idx = i; break; }
  }
  if (idx < 1) return null;
  const parts = splitOutside(line.slice(0, idx), ';');
  let name = parts[0].trim().toUpperCase();
  const dot = name.lastIndexOf('.');
  if (dot >= 0) name = name.slice(dot + 1);
  const params: Record<string, string[]> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    const k = eq < 0 ? 'TYPE' : p.slice(0, eq).trim().toUpperCase();
    const v = eq < 0 ? p : p.slice(eq + 1);
    const vals = splitOutside(v, ',').map(x => x.replace(/^"|"$/g, '').trim());
    params[k] = (params[k] || []).concat(vals);
  }
  let value = line.slice(idx + 1);
  const encoding = (params.ENCODING || []).join(',').toUpperCase();
  if (/QUOTED-PRINTABLE|^QP/.test(encoding)) value = decodeQP(value, (params.CHARSET || [])[0]);
  return { name, params, value };
}

/** vCard dates → YYYY-MM-DD, or MM-DD when the year is unknown (Apple uses 1604 as "no year"). */
export function normBirthday(raw: string): string {
  const v = raw.trim().replace(/T.*$/, '');
  let m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (m) {
    const mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    return m[1] === '1604' || m[1] === '0000' ? `${m[2]}-${m[3]}` : `${m[1]}-${m[2]}-${m[3]}`;
  }
  m = v.match(/^--(\d{2})-?(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;
  return '';
}

function push(list: string[], v: string, dedupe: (s: string) => string) {
  v = v.trim();
  if (!v) return;
  const k = dedupe(v);
  if (!list.some(x => dedupe(x) === k)) list.push(v);
}

function buildContact(props: Prop[]): Contact | null {
  const c: Contact = { uid: '', name: '', org: '', title: '', nickname: '', phones: [], emails: [], addresses: [], birthday: '', urls: [], note: '' };
  let fn = '', given = '', family = '';
  const notes: string[] = [];
  for (const p of props) {
    switch (p.name) {
      case 'FN': fn = unescapeText(p.value).trim(); break;
      case 'N': {
        const a = splitUnescaped(p.value, ';').map(unescapeText);
        family = (a[0] || '').trim(); given = (a[1] || '').trim();
        break;
      }
      case 'NICKNAME': c.nickname = unescapeText(p.value).trim(); break;
      case 'ORG': c.org = splitUnescaped(p.value, ';').map(unescapeText).map(s => s.trim()).filter(Boolean).join(', '); break;
      case 'TITLE': c.title = unescapeText(p.value).trim(); break;
      case 'TEL': push(c.phones, unescapeText(p.value).replace(/^tel:/i, ''), s => s.replace(/\D/g, '') || s); break;
      case 'EMAIL': push(c.emails, unescapeText(p.value).replace(/^mailto:/i, ''), s => s.toLowerCase()); break;
      case 'ADR': {
        const a = splitUnescaped(p.value, ';').map(unescapeText).map(s => s.replace(/\n/g, ' ').trim());
        // pobox;ext;street;city;region;zip;country
        const cityLine = [a[5], a[3]].filter(Boolean).join(' ') + (a[4] ? ` (${a[4]})` : '');
        push(c.addresses, [a[0], a[1], a[2], cityLine.trim(), a[6]].filter(Boolean).join(', '), s => s.toLowerCase());
        break;
      }
      case 'BDAY': c.birthday = normBirthday(p.value); break;
      case 'URL': push(c.urls, unescapeText(p.value), s => s.toLowerCase().replace(/\/$/, '')); break;
      case 'NOTE': notes.push(unescapeText(p.value).trim()); break;
      case 'UID': c.uid = p.value.trim().replace(/^urn:uuid:/i, ''); break;
    }
  }
  c.note = notes.filter(Boolean).join('\n\n');
  c.name = fn || [given, family].filter(Boolean).join(' ') || c.org || c.emails[0] || c.phones[0] || '';
  c.name = c.name.replace(/\s+/g, ' ').trim();
  return c.name ? c : null;
}

export function parseVcf(text: string): ParseResult {
  const lines = unfold(text);
  const contacts: Contact[] = [];
  let total = 0, skipped = 0;
  let cur: Prop[] | null = null;
  for (const line of lines) {
    const u = line.trim().toUpperCase();
    if (u === 'BEGIN:VCARD') { cur = []; continue; }
    if (u === 'END:VCARD') {
      if (cur) { total++; const c = buildContact(cur); if (c) contacts.push(c); else skipped++; }
      cur = null; continue;
    }
    if (!cur || !line.trim()) continue;
    const p = parseLine(line);
    if (p) cur.push(p);
  }
  return { contacts, total, skipped };
}

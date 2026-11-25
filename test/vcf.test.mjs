// node --experimental-strip-types test/vcf.test.mjs
import assert from 'node:assert/strict';
import { parseVcf, normBirthday } from '../src/vcf.ts';
import { planImport, keysOf, buildNote, uniqueName, fileName } from '../src/plan.ts';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ok', name); };

const V3 = `BEGIN:VCARD
VERSION:3.0
N:Rossi;Mario;;;
FN:Mario Rossi
ORG:Acme S.r.l.;Vendite
TITLE:Direttore
TEL;type=CELL;type=VOICE:+39 333 123 4567
item1.TEL;type=WORK:+39 02 1234567
item1.X-ABLabel:ufficio
EMAIL;type=INTERNET;type=HOME:Mario@Example.com
ADR;type=HOME:;;Via Roma 1;Milano;MI;20100;Italia
BDAY:1985-03-14
URL:https://example.com/
NOTE:Conosciuto a una fiera\\nvolentieri\\, davvero
UID:abc-123
PHOTO;ENCODING=b;TYPE=JPEG:/9j/4AAQSkZJRgABAQAAAQABAAD
 /2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQE
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Azienda Senza Persone
ORG:Solo Azienda
END:VCARD
BEGIN:VCARD
VERSION:3.0
END:VCARD
`;

ok('vCard 3.0: fields, folding, escapes, groups', () => {
  const r = parseVcf(V3);
  assert.equal(r.total, 3); assert.equal(r.skipped, 1); assert.equal(r.contacts.length, 2);
  const c = r.contacts[0];
  assert.equal(c.name, 'Mario Rossi'); assert.equal(c.org, 'Acme S.r.l., Vendite'); assert.equal(c.title, 'Direttore');
  assert.deepEqual(c.phones, ['+39 333 123 4567', '+39 02 1234567']);
  assert.deepEqual(c.emails, ['Mario@Example.com']);
  assert.deepEqual(c.addresses, ['Via Roma 1, 20100 Milano (MI), Italia']);
  assert.equal(c.birthday, '1985-03-14');
  assert.equal(c.note, 'Conosciuto a una fiera\nvolentieri, davvero');
  assert.equal(c.uid, 'abc-123');
});

ok('vCard 2.1: quoted-printable UTF-8 with soft line breaks, bare TYPE params', () => {
  const r = parseVcf(`BEGIN:VCARD\r\nVERSION:2.1\r\nN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Bianchi;Ren=C3=A9e;;;\r\nFN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Ren=C3=A9e =\r\nBianchi\r\nTEL;CELL;VOICE:340 111 2222\r\nEND:VCARD\r\n`);
  assert.equal(r.contacts[0].name, 'Renée Bianchi');
  assert.deepEqual(r.contacts[0].phones, ['340 111 2222']);
});

ok('vCard 4.0: tel: and mailto: prefixes, UTF-8 BOM, no FN falls back to N', () => {
  const r = parseVcf(`﻿BEGIN:VCARD\nVERSION:4.0\nN:Verdi;Anna;;;\nTEL;VALUE=uri:tel:+39-345-000-1111\nEMAIL:mailto:anna@x.it\nBDAY:--0214\nEND:VCARD`);
  const c = r.contacts[0];
  assert.equal(c.name, 'Anna Verdi'); assert.deepEqual(c.phones, ['+39-345-000-1111']); assert.deepEqual(c.emails, ['anna@x.it']); assert.equal(c.birthday, '02-14');
});

ok('name falls back to org, then e-mail, then phone', () => {
  const r = parseVcf(`BEGIN:VCARD\nTEL:333 9998887\nEND:VCARD\nBEGIN:VCARD\nEMAIL:a@b.co\nEND:VCARD`);
  assert.deepEqual(r.contacts.map(c => c.name), ['333 9998887', 'a@b.co']);
});

ok('birthday normalisation (Apple 1604 = no year)', () => {
  assert.equal(normBirthday('19850314'), '1985-03-14');
  assert.equal(normBirthday('1604-03-14'), '03-14');
  assert.equal(normBirthday('1985-03-14T00:00:00Z'), '1985-03-14');
  assert.equal(normBirthday('1985-13-40'), '');
});

ok('re-import adds only the new contacts', () => {
  const first = parseVcf(V3).contacts;
  const p1 = planImport(first, new Set());
  assert.equal(p1.fresh.length, 2);
  const seen = new Set(p1.fresh.flatMap(keysOf));
  // months later: Mario was removed from the file, Anna is new, Azienda is still there
  const later = parseVcf(`BEGIN:VCARD\nFN:Anna Verdi\nTEL:345 000 1111\nEND:VCARD\nBEGIN:VCARD\nFN:Azienda Senza Persone\nORG:Solo Azienda\nEND:VCARD`).contacts;
  const p2 = planImport(later, seen);
  assert.deepEqual(p2.fresh.map(c => c.name), ['Anna Verdi']);
  assert.equal(p2.existing, 1);
});

ok('same person is recognised with a different UID/format, or an extra number', () => {
  const seen = new Set(keysOf({ name: 'Mario Rossi', phones: ['+39 333 123 4567'], emails: [] }));
  const again = parseVcf(`BEGIN:VCARD\nFN:Màrio  Rossi\nTEL:3331234567\nTEL:06 111111\nUID:new-uid\nEND:VCARD`).contacts;
  assert.equal(planImport(again, seen).fresh.length, 0);
});

ok('different people with the same name are both kept', () => {
  const r = parseVcf(`BEGIN:VCARD\nFN:Marco Rossi\nTEL:333 1111111\nEND:VCARD\nBEGIN:VCARD\nFN:Marco Rossi\nTEL:333 2222222\nEND:VCARD`);
  assert.equal(planImport(r.contacts, new Set()).fresh.length, 2);
});

ok('exact duplicates inside one file are imported once', () => {
  const c = `BEGIN:VCARD\nFN:Gigi\nTEL:333 1111111\nEND:VCARD\n`;
  assert.equal(planImport(parseVcf(c + c).contacts, new Set()).fresh.length, 1);
});

ok('file names: unsafe characters, company disambiguation, numbering', () => {
  assert.equal(fileName('A/B: C?'), 'A B C');
  const a = { name: 'Marco Rossi', org: 'Acme' }, taken = new Set(['marco rossi']);
  assert.equal(uniqueName(a, taken), 'Marco Rossi (Acme)');
  taken.add('marco rossi (acme)');
  assert.equal(uniqueName(a, taken), 'Marco Rossi (Acme) (2)');
});

ok('note frontmatter is valid and quotes awkward values', () => {
  const c = parseVcf(V3).contacts[0];
  const md = buildNote(c, '2026-11-25');
  assert.match(md, /^---\ntipo: contatto\nnome: "Mario Rossi"\n/);
  assert.match(md, /compleanno: 1985-03-14\n/);
  assert.match(md, /telefono:\n  - "\+39 333 123 4567"\n  - "\+39 02 1234567"\n/);
  assert.match(md, /importato: 2026-11-25\n---\n\n## Note\n\nConosciuto/);
  const weird = buildNote({ ...c, name: 'He said "hi": ok', note: '' }, '2026-11-25');
  assert.match(weird, /nome: "He said \\"hi\\": ok"/);
});

console.log(`\n${n} checks passed`);

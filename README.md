# Rolodex

An address book for Obsidian. Import a `.vcf` file and every contact becomes a note, listed in a quiet A–Z view.

- **Import**: pick (or drop) a `.vcf` exported from iPhone, macOS Contacts, Google Contacts or Outlook (vCard 2.1, 3.0 and 4.0). A preview shows how many people are in the file, how many are new and how many are already in the address book, then you confirm.
- **Re-import is additive**: months later, load an updated file and only the **new** people are added. Existing notes are never edited, and people missing from the new file are never removed.
- **Address book view**: contacts grouped by letter, with search over name, company, phone and e-mail. Click to open the note beside the list; ⌘/Ctrl-click for a new tab.
- English and Italian. Works on mobile.

## What each note looks like

```yaml
---
tipo: contatto
nome: "Mario Rossi"
azienda: "Acme S.r.l."
ruolo: "Direttore"
telefono:
  - "+39 333 123 4567"
email:
  - "mario@example.com"
indirizzo:
  - "Via Roma 1, 20100 Milano (MI), Italia"
compleanno: 1985-03-14
sito:
  - "https://example.com/"
vcf_uid: "abc-123"
importato: 2026-11-25
---
## Note

Whatever the NOTE field said.
```

Files go in `Rubrica/` (changeable in settings), named after the person. Two people with the same name become `Name (Company)` or `Name (2)`. Empty fields are left out. Photos are not imported.

## How "already in the address book" is decided

A contact counts as already imported if it shares any of these with someone known:

1. the vCard `UID` (when the exporter wrote one);
2. the same name **and** the same phone number (last 9 digits) **or** the same e-mail.

Known people are the notes currently in the folder **plus** a memory of everyone ever imported, so a note you deleted is not brought back by the next import. *Settings → Forget imported contacts* clears that memory.

Limit: if the exporter writes no UID and someone changes their name *and* all their numbers, they look like a new person.

## Build

```
npm install
npm run build      # writes main.js
npm test           # parser and "only the new ones" checks
```

Copy `main.js`, `manifest.json` and `styles.css` to `<vault>/.obsidian/plugins/rolodex/`.

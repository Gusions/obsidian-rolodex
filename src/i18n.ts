export type Lang = 'it' | 'en';

const it: Record<string, string> = {
  'app.title': 'Rolodex', 'cmd.import': 'Importa contatti (.vcf)', 'cmd.open': 'Apri la rubrica',
  'head.count': '{n} contatti', 'head.count1': '1 contatto', 'head.of': '{n} di {total}',
  'search.ph': 'Cerca nome, azienda, numero…', 'btn.import': 'Importa .vcf',
  'empty.title': 'Ancora nessun contatto',
  'empty.body': 'Importa un file .vcf esportato dal telefono o dall\'app Contatti. Ogni persona diventa una nota in "{folder}".',
  'nomatch': 'Nessun risultato per "{q}".',

  'imp.title': 'Importa contatti',
  'imp.drop': 'Scegli un file .vcf', 'imp.dropHint': 'Oppure trascinalo qui. Va bene quello esportato da iPhone, Contatti di macOS, Google, Outlook.',
  'imp.bad': 'In questo file non ho trovato nessun contatto.', 'imp.readFail': 'Non riesco a leggere il file.',
  'imp.inFile': 'Nel file', 'imp.new': 'Nuovi', 'imp.have': 'Già in rubrica', 'imp.skipped': 'Senza nome, saltati',
  'imp.preview': 'Primi nuovi contatti', 'imp.more': '+ altri {n}',
  'imp.rule': 'Le note già presenti non vengono mai modificate, e i contatti che non sono più nel file non vengono mai rimossi.',
  'imp.go': 'Importa {n} nuovi', 'imp.none': 'Niente di nuovo da importare', 'imp.working': 'Importo {i} / {n}…',
  'imp.done': 'Importati {n} nuovi contatti in "{folder}"', 'imp.doneFail': ' · {f} non riusciti',
  'imp.another': 'Scegli un altro file', 'imp.cancel': 'Annulla',

  'set.language': 'Lingua', 'set.folder': 'Cartella della rubrica', 'set.folderHint': 'Ogni contatto è una nota in questa cartella.',
  'set.about': 'Importare di nuovo un file aggiornato aggiunge solo i contatti nuovi. Chi hai già importato non viene toccato né ricreato, anche se nel frattempo hai cancellato la sua nota.',
  'set.forget': 'Dimentica i contatti importati', 'set.forgetDesc': 'Svuota la memoria di chi è già stato importato. Alla prossima importazione chi non ha più una nota nella cartella verrà ricreato.', 'set.forgetBtn': 'Dimentica', 'set.forgot': 'Fatto',
};

const en: Record<string, string> = {
  'app.title': 'Rolodex', 'cmd.import': 'Import contacts (.vcf)', 'cmd.open': 'Open the address book',
  'head.count': '{n} contacts', 'head.count1': '1 contact', 'head.of': '{n} of {total}',
  'search.ph': 'Search name, company, number…', 'btn.import': 'Import .vcf',
  'empty.title': 'No contacts yet',
  'empty.body': 'Import a .vcf file exported from your phone or Contacts app. Each person becomes a note in "{folder}".',
  'nomatch': 'Nothing matches "{q}".',

  'imp.title': 'Import contacts',
  'imp.drop': 'Choose a .vcf file', 'imp.dropHint': 'Or drop it here. Works with files from iPhone, macOS Contacts, Google and Outlook.',
  'imp.bad': 'I found no contacts in this file.', 'imp.readFail': 'I can\'t read this file.',
  'imp.inFile': 'In the file', 'imp.new': 'New', 'imp.have': 'Already in the address book', 'imp.skipped': 'No name, skipped',
  'imp.preview': 'First new contacts', 'imp.more': '+ {n} more',
  'imp.rule': 'Existing notes are never changed, and contacts that are no longer in the file are never removed.',
  'imp.go': 'Import {n} new', 'imp.none': 'Nothing new to import', 'imp.working': 'Importing {i} / {n}…',
  'imp.done': 'Imported {n} new contacts into "{folder}"', 'imp.doneFail': ' · {f} failed',
  'imp.another': 'Choose another file', 'imp.cancel': 'Cancel',

  'set.language': 'Language', 'set.folder': 'Address book folder', 'set.folderHint': 'Each contact is a note in this folder.',
  'set.about': 'Importing an updated file again only adds the new contacts. People you already imported are never touched or recreated, even if you have since deleted their note.',
  'set.forget': 'Forget imported contacts', 'set.forgetDesc': 'Clears the memory of who was already imported. On the next import, anyone without a note in the folder will be created again.', 'set.forgetBtn': 'Forget', 'set.forgot': 'Done',
};

const dict = { it, en };

export function detectLang(setting: string, locale: string): Lang {
  if (setting === 'it' || setting === 'en') return setting;
  return /^it/i.test(locale || '') ? 'it' : 'en';
}

export type T = (key: string, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): T {
  return (key, vars) => {
    let s = dict[lang][key] ?? en[key] ?? key;
    if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]));
    return s;
  };
}

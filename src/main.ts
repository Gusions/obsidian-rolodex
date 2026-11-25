import { Notice, Plugin, PluginSettingTab, Setting, moment, normalizePath } from 'obsidian';
import type { App } from 'obsidian';
import { Lang, T, detectLang, makeT } from './i18n.ts';
import { ImportModal } from './modals.ts';
import { importContacts, knownKeys } from './ops.ts';
import { RolodexView, VIEW } from './view.ts';
import type { ViewHost } from './view.ts';

interface Settings {
  language: 'auto' | Lang;
  folder: string;
  /** identity keys of everyone ever imported, so a deleted note is not resurrected by the next import */
  seen: string[];
}
const DEFAULTS: Settings = { language: 'auto', folder: 'Rubrica', seen: [] };

export default class RolodexPlugin extends Plugin implements ViewHost {
  settings: Settings = { ...DEFAULTS };
  private tr: T = makeT('en');
  private lg: Lang = 'en';

  t = () => this.tr;
  lang = () => this.lg;
  folder = () => this.settings.folder;

  refreshLang() {
    this.lg = detectLang(this.settings.language, (moment as any).locale?.() || navigator.language);
    this.tr = makeT(this.lg);
  }

  async onload() {
    this.settings = { ...DEFAULTS, ...((await this.loadData()) || {}) };
    this.refreshLang();
    this.registerView(VIEW, leaf => new RolodexView(leaf, this));
    this.addRibbonIcon('contact', 'Rolodex', () => void this.open());
    this.addCommand({ id: 'open', name: this.tr('cmd.open'), callback: () => void this.open() });
    this.addCommand({ id: 'import', name: this.tr('cmd.import'), callback: () => this.importFile() });
    this.addSettingTab(new RolodexSettings(this.app, this));
  }

  onunload() { this.app.workspace.detachLeavesOfType(VIEW); }

  async savePrefs() { await this.saveData(this.settings); }

  async open() {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW)[0];
    if (!leaf) { leaf = ws.getLeaf('tab'); await leaf.setViewState({ type: VIEW, active: true }); }
    await ws.revealLeaf(leaf);
  }

  rebuildViews() { this.app.workspace.getLeavesOfType(VIEW).forEach(l => (l.view as RolodexView).rebuild()); }

  importFile() {
    new ImportModal(this.app, {
      t: this.tr,
      folder: this.settings.folder,
      known: () => knownKeys(this.app, this.settings.folder, this.settings.seen),
      run: async (fresh, onProgress) => {
        const res = await importContacts(this.app, this.settings.folder, fresh, onProgress);
        const seen = new Set(this.settings.seen);
        res.keys.forEach(k => seen.add(k));
        this.settings.seen = [...seen];
        await this.savePrefs();
        return res;
      },
    }).open();
  }
}

class RolodexSettings extends PluginSettingTab {
  constructor(app: App, private plugin: RolodexPlugin) { super(app, plugin); }
  display() {
    const { containerEl: el } = this; el.empty();
    const p = this.plugin, s = p.settings;
    const t = p.t();

    new Setting(el).setName(t('set.language')).addDropdown(d => d.addOptions({ auto: 'Auto', it: 'Italiano', en: 'English' }).setValue(s.language).onChange(async v => {
      s.language = v as any; await p.savePrefs(); p.refreshLang(); p.rebuildViews(); this.display();
    }));
    new Setting(el).setName(t('set.folder')).setDesc(t('set.folderHint')).addText(x => x.setValue(s.folder).onChange(async v => {
      s.folder = normalizePath(v.trim() || 'Rubrica').replace(/^\/+|\/+$/g, ''); await p.savePrefs(); p.rebuildViews();
    }));
    new Setting(el).setName(t('set.about')).setDesc('');
    new Setting(el).setName(t('set.forget')).setDesc(t('set.forgetDesc')).addButton(b => b.setButtonText(t('set.forgetBtn')).onClick(async () => {
      s.seen = []; await p.savePrefs(); new Notice(t('set.forgot'));
    }));
  }
}

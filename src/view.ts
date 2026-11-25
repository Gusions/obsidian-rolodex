import { ItemView, Platform, WorkspaceLeaf, setIcon } from 'obsidian';
import type { App, TFile } from 'obsidian';
import type { T } from './i18n.ts';
import { inFolder, readRows } from './ops.ts';
import type { Row } from './ops.ts';

export const VIEW = 'rolodex-view';

export interface ViewHost {
  app: App;
  t: () => T;
  lang: () => string;
  folder: () => string;
  importFile: () => void;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const digits = (s: string) => s.replace(/\D/g, '');

export class RolodexView extends ItemView {
  private q = '';
  private listEl!: HTMLElement;
  private countEl!: HTMLElement;
  private timer: number | undefined;
  private detail: WorkspaceLeaf | null = null;

  constructor(leaf: WorkspaceLeaf, private host: ViewHost) { super(leaf); }
  getViewType() { return VIEW; }
  getDisplayText() { return 'Rolodex'; }
  getIcon() { return 'contact'; }

  async onOpen() {
    this.contentEl.addClass('rolodex-view');
    this.build();
    const soon = (f: { path: string }, old?: string) => {
      const folder = this.host.folder();
      if (inFolder(f.path, folder) || (old && inFolder(old, folder))) this.soon();
    };
    this.registerEvent(this.app.metadataCache.on('changed', f => soon(f)));
    this.registerEvent(this.app.vault.on('create', f => soon(f)));
    this.registerEvent(this.app.vault.on('delete', f => soon(f)));
    this.registerEvent(this.app.vault.on('rename', (f, old) => soon(f, old)));
    this.registerEvent(this.app.metadataCache.on('resolved', () => this.soon()));
  }

  async onClose() { window.clearTimeout(this.timer); }

  private soon() { window.clearTimeout(this.timer); this.timer = window.setTimeout(() => this.render(), 250); }

  /** Language or folder changed in settings. */
  rebuild() { this.build(); }

  private build() {
    const t = this.host.t();
    const root = this.contentEl;
    root.empty();
    const wrap = root.createDiv({ cls: 'rol-root' });

    const head = wrap.createDiv({ cls: 'rol-head' });
    const l = head.createDiv({ cls: 'rol-head-l' });
    l.createDiv({ cls: 'rol-brand', text: 'Rolodex' });
    this.countEl = l.createDiv({ cls: 'rol-faint rol-count' });
    const r = head.createDiv({ cls: 'rol-head-r' });
    const btn = r.createEl('button', { cls: 'rol-btn is-primary' });
    setIcon(btn.createSpan({ cls: 'rol-ic' }), 'upload');
    btn.createSpan({ text: t('btn.import') });
    btn.onclick = () => this.host.importFile();

    const bar = wrap.createDiv({ cls: 'rol-bar' });
    const search = bar.createEl('input', { cls: 'rol-search', type: 'search', attr: { placeholder: t('search.ph'), 'aria-label': t('search.ph') } });
    search.value = this.q;
    search.oninput = () => { this.q = search.value; this.render(); };

    this.listEl = wrap.createDiv({ cls: 'rol-body' });
    this.render();
  }

  private render() {
    if (!this.listEl) return;
    const t = this.host.t();
    const el = this.listEl;
    const top = el.scrollTop;
    el.empty();

    const all = readRows(this.app, this.host.folder());
    const q = fold(this.q.trim()), qd = digits(this.q);
    const rows = !q ? all : all.filter(r => fold(r.name + ' ' + r.org + ' ' + r.email).includes(q) || (qd.length >= 3 && digits(r.phone).includes(qd)));
    const collator = new Intl.Collator(this.host.lang(), { sensitivity: 'base', numeric: true });
    rows.sort((a, b) => collator.compare(a.name, b.name));

    this.countEl.setText(q
      ? t('head.of', { n: rows.length, total: all.length })
      : all.length === 1 ? t('head.count1') : t('head.count', { n: all.length }));

    if (!all.length) {
      const e = el.createDiv({ cls: 'rol-empty' });
      e.createDiv({ cls: 'rol-empty-t', text: t('empty.title') });
      e.createDiv({ cls: 'rol-faint', text: t('empty.body', { folder: this.host.folder() }) });
      return;
    }
    if (!rows.length) { el.createDiv({ cls: 'rol-empty' }).createDiv({ cls: 'rol-faint', text: t('nomatch', { q: this.q.trim() }) }); return; }

    let letter = '', group: HTMLElement | null = null;
    for (const r of rows) {
      const ch = fold(r.name).charAt(0).toUpperCase();
      const L = /[A-Z]/.test(ch) ? ch : '#';
      if (L !== letter) {
        letter = L;
        group = el.createDiv({ cls: 'rol-group' });
        group.createDiv({ cls: 'rol-letter', text: L });
      }
      this.row(group!, r);
    }
    el.scrollTop = top;
  }

  private row(parent: HTMLElement, r: Row) {
    const row = parent.createDiv({ cls: 'rol-row', attr: { tabindex: '0', role: 'link' } });
    const main = row.createDiv({ cls: 'rol-row-main' });
    main.createSpan({ cls: 'rol-name', text: r.name });
    if (r.org) main.createSpan({ cls: 'rol-org', text: r.org });
    const side = row.createDiv({ cls: 'rol-row-side' });
    if (r.phone) side.createSpan({ text: r.phone });
    if (r.email) side.createSpan({ text: r.email });
    const open = (e: MouseEvent | KeyboardEvent) => void this.openContact(r.file, e.metaKey || e.ctrlKey);
    row.onclick = open;
    row.onkeydown = e => { if (e.key === 'Enter') open(e); };
  }

  /** A contact opens beside the list (desktop), reusing one pane; on mobile it just opens. */
  private async openContact(file: TFile, newTab: boolean) {
    const ws = this.app.workspace;
    let leaf: WorkspaceLeaf;
    if (Platform.isMobile) leaf = ws.getLeaf(false);
    else if (newTab) leaf = ws.getLeaf('tab');
    else {
      const alive = this.detail && ws.getLeavesOfType('markdown').includes(this.detail);
      leaf = alive ? this.detail! : ws.getLeaf('split', 'vertical');
      this.detail = leaf;
    }
    await leaf.openFile(file);
  }
}

import { App, Modal, Notice } from 'obsidian';
import { parseVcf } from './vcf.ts';
import type { Contact } from './vcf.ts';
import { planImport } from './plan.ts';
import type { Plan } from './plan.ts';
import type { T } from './i18n.ts';

export interface ImportHost {
  t: T;
  folder: string;
  /** keys of everyone already in the address book */
  known(): Set<string>;
  run(fresh: Contact[], onProgress: (i: number) => void): Promise<{ created: number; failed: number }>;
}

/** Pick (or drop) a .vcf, see what would happen, confirm. */
export class ImportModal extends Modal {
  constructor(app: App, private host: ImportHost) { super(app); }

  onOpen() { this.modalEl.addClass('rol-modal'); this.pick(); }
  onClose() { this.contentEl.empty(); }

  private pick() {
    const { contentEl: el } = this, t = this.host.t;
    el.empty();
    this.titleEl.setText(t('imp.title'));
    const input = el.createEl('input', { type: 'file', attr: { accept: '.vcf,.vcard,text/vcard,text/x-vcard', hidden: 'true' } });
    const zone = el.createDiv({ cls: 'rol-drop', attr: { tabindex: '0', role: 'button' } });
    zone.createDiv({ cls: 'rol-drop-t', text: t('imp.drop') });
    zone.createDiv({ cls: 'rol-faint', text: t('imp.dropHint') });
    const err = el.createDiv({ cls: 'rol-err' });
    const open = () => input.click();
    zone.onclick = open;
    zone.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    zone.ondragover = e => { e.preventDefault(); zone.addClass('is-over'); };
    zone.ondragleave = () => zone.removeClass('is-over');
    zone.ondrop = e => { e.preventDefault(); zone.removeClass('is-over'); const f = e.dataTransfer?.files?.[0]; if (f) void this.load(f, err); };
    input.onchange = () => { const f = input.files?.[0]; if (f) void this.load(f, err); };
  }

  private async load(file: File, err: HTMLElement) {
    const t = this.host.t;
    err.setText('');
    let text = '';
    try { text = await file.text(); } catch { err.setText(t('imp.readFail')); return; }
    const parsed = parseVcf(text);
    if (!parsed.total) { err.setText(t('imp.bad')); return; }
    this.review(parsed.contacts, parsed.total, parsed.skipped, planImport(parsed.contacts, this.host.known()));
  }

  private review(all: Contact[], total: number, skipped: number, plan: Plan) {
    const { contentEl: el } = this, t = this.host.t;
    el.empty();
    this.titleEl.setText(t('imp.title'));

    const stats = el.createDiv({ cls: 'rol-stats' });
    const stat = (label: string, n: number, cls = '') => {
      const s = stats.createDiv({ cls: 'rol-stat ' + cls });
      s.createDiv({ cls: 'rol-stat-n', text: String(n) });
      s.createDiv({ cls: 'rol-stat-l', text: label });
    };
    stat(t('imp.inFile'), total);
    stat(t('imp.new'), plan.fresh.length, 'is-new');
    stat(t('imp.have'), plan.existing);
    if (skipped) stat(t('imp.skipped'), skipped);

    if (plan.fresh.length) {
      el.createDiv({ cls: 'rol-label', text: t('imp.preview') });
      const ul = el.createDiv({ cls: 'rol-preview' });
      for (const c of plan.fresh.slice(0, 8)) {
        const r = ul.createDiv({ cls: 'rol-pv' });
        r.createSpan({ cls: 'rol-pv-n', text: c.name });
        const sub = c.org || c.phones[0] || c.emails[0] || '';
        if (sub) r.createSpan({ cls: 'rol-faint', text: sub });
      }
      if (plan.fresh.length > 8) ul.createDiv({ cls: 'rol-faint', text: t('imp.more', { n: plan.fresh.length - 8 }) });
    }

    el.createDiv({ cls: 'rol-rule', text: t('imp.rule') });

    const row = el.createDiv({ cls: 'rol-actions' });
    const back = row.createEl('button', { cls: 'rol-btn is-quiet', text: t('imp.another') });
    back.onclick = () => this.pick();
    const go = row.createEl('button', { cls: 'rol-btn is-primary', text: plan.fresh.length ? t('imp.go', { n: plan.fresh.length }) : t('imp.none') });
    go.disabled = !plan.fresh.length;
    go.onclick = async () => {
      go.disabled = true; back.disabled = true;
      const n = plan.fresh.length;
      go.setText(t('imp.working', { i: 0, n }));
      try {
        const res = await this.host.run(plan.fresh, i => go.setText(t('imp.working', { i, n })));
        new Notice(t('imp.done', { n: res.created, folder: this.host.folder }) + (res.failed ? t('imp.doneFail', { f: res.failed }) : ''), 6000);
        this.close();
      } catch (e: any) {
        new Notice(String(e?.message || e), 8000);
        go.disabled = false; back.disabled = false; go.setText(t('imp.go', { n }));
      }
    };
    window.setTimeout(() => go.focus(), 30);
  }
}

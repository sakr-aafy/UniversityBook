/**
 * Impression d'une facture dans une fenêtre dédiée, au même format que la facture papier de la
 * caisse (voir caisse/pages/clients/clients.component.ts#construireCorpsFacture / styleFacture) :
 * document A4, en-tête entreprise + logo, tableau des lignes, montant en toutes lettres, cachet /
 * signature, encadré des montants. Générée hors du DOM Angular pour ne subir aucun CSS de la
 * modale d'écran (mêmes raisons que côté caisse).
 */

export interface FactureImpressionLigne {
  designation: string;
  qty: number;
  prixHT: number;
  tva: number;
  totalTTC: number;
}

export interface FactureImpressionData {
  numFacture: string;
  /** Date ISO ou "YYYY-MM-DD". */
  date: string;
  client: string;
  mf?: string;
  tel?: string;
  adresse?: string;
  /** Libellé du/des ticket(s) d'origine. */
  ticketsLabel?: string;
  produits: FactureImpressionLigne[];
  totalTTC: number;
  timbreFiscal: number;
}

export interface EntrepriseFacture {
  nomEntreprise?: string;
  adresse?: string;
  telephone?: string;
  matriculeFiscal?: string;
  nomSignataire?: string;
  signature?: string;
  cachet?: string;
  logo?: string;
}

const STYLE_FACTURE = `
  .fac-hd { display:flex; align-items:center; gap:18px; padding-bottom:18px; margin-bottom:18px; border-bottom:2px solid #000; }
  .fac-logo { width:64px; height:64px; object-fit:contain; flex-shrink:0; }
  .fac-hd-info h1 { font-size:22px; margin:0 0 4px; }
  .fac-hd-info p { font-size:12.5px; margin:0 0 1px; color:#333; }
  .fac-num { margin-left:auto; text-align:right; font-size:16px; font-weight:700; }
  .fac-num-lbl { display:block; font-size:11px; font-weight:400; text-transform:uppercase; letter-spacing:.5px; color:#555; }
  .fac-meta { display:flex; flex-wrap:wrap; gap:16px 28px; margin-bottom:20px; }
  .fac-meta > div { display:flex; flex-direction:column; gap:2px; }
  .fac-lbl { font-size:12px; font-weight:700; color:#666; text-transform:uppercase; }
  .fac-table { width:100%; border-collapse:collapse; font-size:13.5px; margin-bottom:16px; }
  .fac-table th { text-align:left; background:#f3f4f6; font-weight:600; font-size:12px; text-transform:uppercase; padding:10px 12px; border-bottom:1.5px solid #ddd; }
  .fac-table td { padding:11px 12px; border-bottom:1px solid #eee; }
  .fac-table .tc { text-align:center; } .fac-table .tr { text-align:right; }
  .fac-bottom { display:flex; justify-content:space-between; align-items:flex-start; gap:40px; margin-top:auto; padding-top:16px; }
  .fac-word { flex:1; }
  .fac-word p { margin:0 0 8px; font-size:13px; }
  .fac-word-value { font-weight:600; }
  .fac-sign-box { margin-top:28px; font-size:12px; font-weight:600; color:#333; display:flex; flex-direction:column; align-items:flex-start; }
  .fac-sign-title { display:block; }
  .fac-sign-media { position:relative; min-height:70px; margin-top:6px; display:flex; align-items:flex-end; gap:8px; }
  .fac-cachet-img { max-height:110px; max-width:150px; object-fit:contain; opacity:.9; }
  .fac-sign-img { max-height:70px; max-width:160px; object-fit:contain; }
  .fac-signataire { margin-top:2px; font-weight:700; font-size:12px; }
  .fac-amt-box { width:280px; flex-shrink:0; }
  .fac-amt-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; font-size:13.5px; }
  .fac-amt-final { border-top:2px solid #000; margin-top:4px; padding-top:10px; font-weight:800; font-size:15.5px; }
  .fac-amt-final span:last-child { background:#eee; padding:3px 10px; border-radius:3px; }
`;

function echapper(v: string | number | null | undefined): string {
  const d = document.createElement('div');
  d.textContent = v === null || v === undefined ? '' : String(v);
  return d.innerHTML;
}

/** "1 234,567 DT" — même rendu que caisse/shared/format.util.ts#formatMontant. */
function formaterMontant(v: number): string {
  const n = Number.isFinite(v) ? v : 0;
  const s = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n);
  return s.replace(/ /g, ' ') + ' DT';
}

function formaterDate(d: string): string {
  if (!d) return '';
  const dt = new Date(d);
  if (!isNaN(dt.getTime())) {
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
  }
  // "YYYY-MM-DD" simple
  const [y, m, j] = d.split('-');
  return j ? `${j}/${m}/${y}` : d;
}

function nombreEnLettres(n: number): string {
  const unites = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  const moins100 = (v: number): string => {
    if (v < 20) return unites[v];
    if (v < 70) {
      const d = Math.floor(v / 10), u = v % 10;
      if (u === 0) return dizaines[d];
      if (u === 1) return dizaines[d] + ' et un';
      return dizaines[d] + '-' + unites[u];
    }
    if (v < 80) {
      const u = v - 60;
      if (u === 11) return 'soixante et onze';
      return 'soixante-' + unites[u];
    }
    const u = v - 80;
    if (u === 0) return 'quatre-vingts';
    return 'quatre-vingt-' + unites[u];
  };

  const moins1000 = (v: number): string => {
    if (v < 100) return moins100(v);
    const c = Math.floor(v / 100), r = v % 100;
    let s = (c === 1 ? 'cent' : unites[c] + ' cent') + (c > 1 && r === 0 ? 's' : '');
    if (r > 0) s += ' ' + moins100(r);
    return s;
  };

  if (n < 1000) return moins1000(n);
  const milliers = Math.floor(n / 1000), reste = n % 1000;
  let s = milliers === 1 ? 'mille' : moins1000(milliers) + ' mille';
  if (reste > 0) s += ' ' + moins1000(reste);
  return s;
}

/** Montant en Dinars/Millimes tunisiens en toutes lettres (ligne "Arrêtée la présente facture…"). */
function montantEnLettres(montant: number): string {
  if (!Number.isFinite(montant)) montant = 0;
  let dinars = Math.floor(montant + 1e-9);
  let millimes = Math.round((montant - dinars) * 1000);
  if (millimes >= 1000) { dinars += 1; millimes -= 1000; }

  const mots = nombreEnLettres(dinars) + ' Dinar' + (dinars > 1 ? 's' : '');
  if (millimes <= 0) return mots;
  return mots + ' ' + nombreEnLettres(millimes) + ' Millime' + (millimes > 1 ? 's' : '');
}

function construireCorps(f: FactureImpressionData, ent: EntrepriseFacture): string {
  const e = echapper;
  const totalAPayer = f.totalTTC + f.timbreFiscal;
  const nom = ent.nomEntreprise || 'University Book';

  const lignes = f.produits.map(p => `
    <tr>
      <td>${e(p.designation)}</td>
      <td class="tc">${e(p.qty)}</td>
      <td class="tr">${e(formaterMontant(p.prixHT))}</td>
      <td class="tc">${e(p.tva)}%</td>
      <td class="tr">${e(formaterMontant(p.totalTTC))}</td>
    </tr>`).join('');

  return `
    <div class="fac-hd">
      ${ent.logo ? `<img src="${e(ent.logo)}" class="fac-logo" alt="Logo">` : ''}
      <div class="fac-hd-info">
        <h1>${e(nom)}</h1>
        ${ent.adresse ? `<p>${e(ent.adresse)}</p>` : ''}
        ${ent.telephone ? `<p>Tel : ${e(ent.telephone)}</p>` : ''}
        ${ent.matriculeFiscal ? `<p>MF : ${e(ent.matriculeFiscal)}</p>` : ''}
      </div>
      <div class="fac-num">
        <span class="fac-num-lbl">Facture</span>
        <strong>${e(f.numFacture || '—')}</strong><br>
        <span>${e(formaterDate(f.date))}</span>
      </div>
    </div>
    <div class="fac-meta">
      <div><span class="fac-lbl">Client</span><span>${e(f.client || '—')}</span></div>
      <div><span class="fac-lbl">MF</span><span>${e(f.mf || '—')}</span></div>
      <div><span class="fac-lbl">Tel</span><span>${e(f.tel || '—')}</span></div>
      <div><span class="fac-lbl">Adresse</span><span>${e(f.adresse || '—')}</span></div>
      <div><span class="fac-lbl">Ticket(s)</span><span>${e(f.ticketsLabel || '—')}</span></div>
    </div>
    <table class="fac-table">
      <thead>
        <tr><th>Désignation</th><th class="tc">Qté</th><th class="tr">Prix HT</th><th class="tc">TVA</th><th class="tr">Total TTC</th></tr>
      </thead>
      <tbody>${lignes}</tbody>
    </table>
    <div class="fac-bottom">
      <div class="fac-word">
        <p>Arrêtée la présente Facture à la somme de :</p>
        <p class="fac-word-value">${e(montantEnLettres(totalAPayer))}</p>
        <div class="fac-sign-box">
          <span class="fac-sign-title">Cachet et Signature</span>
          <div class="fac-sign-media">
            ${ent.cachet ? `<img src="${e(ent.cachet)}" class="fac-cachet-img" alt="Cachet">` : ''}
            ${ent.signature ? `<img src="${e(ent.signature)}" class="fac-sign-img" alt="Signature">` : ''}
          </div>
          ${ent.nomSignataire ? `<span class="fac-signataire">${e(ent.nomSignataire)}</span>` : ''}
        </div>
      </div>
      <div class="fac-amt-box">
        <div class="fac-amt-row"><span>Montant TTC :</span><span>${e(formaterMontant(f.totalTTC))}</span></div>
        <div class="fac-amt-row"><span>Timbre :</span><span>${e(formaterMontant(f.timbreFiscal))}</span></div>
        <div class="fac-amt-row fac-amt-final"><span>Montant Facture :</span><span>${e(formaterMontant(totalAPayer))}</span></div>
      </div>
    </div>
  `;
}

/**
 * Ouvre une fenêtre A4 avec la facture mise en page comme en caisse et lance l'impression.
 */
export function imprimerFacture(titre: string, f: FactureImpressionData, entreprise: EntrepriseFacture | null): void {
  const fenetre = window.open('', '_blank', 'width=900,height=1000');
  if (!fenetre) {
    alert("Impossible d'ouvrir la fenêtre d'impression — vérifiez que les fenêtres popup ne sont pas bloquées pour ce site.");
    return;
  }
  const corps = construireCorps(f, entreprise || {});

  fenetre.document.open();
  fenetre.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${echapper(titre)}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; width:210mm; min-height:297mm; padding:12mm; display:flex; flex-direction:column; }
  ${STYLE_FACTURE}
</style>
</head>
<body>${corps}</body>
</html>`);
  fenetre.document.close();

  let imprime = false;
  const lancer = () => {
    if (imprime) return;
    imprime = true;
    fenetre.focus();
    fenetre.print();
  };
  fenetre.onload = lancer;
  // Filet de sécurité : onload pas toujours fiable pour un document généré via document.write().
  setTimeout(lancer, 300);
}

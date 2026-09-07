/* ============================================================
   MODÈLE DE DESIGN PERSONNALISÉ — gabarit à copier par le vendeur
   ------------------------------------------------------------
   Comment s'en servir :
     1. copier ce fichier en src/templates/DesignClient.tsx
     2. l'adapter (couleurs, blocs, ordre des sections…)
     3. npm run design:pack -- src/templates/DesignClient.tsx --name="Design Dupont"
     4. envoyer le fichier DesignClient.dddesign.js au client (WhatsApp) :
        il clique « Importer mon design » dans l'application.

   CONTRAT (ce que l'application vérifie à l'import) :
   - un composant exporté PAR DÉFAUT, props { data, svgRef }
   - qui renvoie UN SEUL <svg> en viewBox « 0 0 794 HAUTEUR »
     (794 = largeur A4 à 96 dpi ; 1123 = une page — si vous dépassez,
     répétez la structure par page de 1123, sinon tout tient sur une page)
   - svgRef attaché au <svg> : c'est par là que l'export PDF lit le document
   - des <text> uniquement (le PDF ne rend pas le HTML : pas de foreignObject),
     police = data.fontFamily, couleur = data.accentColor
   - pas de paquet tiers : seuls react et react/jsx-runtime existent (fournis
     par l'app) ; tous vos imports internes sont recopiés dans le fichier
   - hooks acceptés, rendu synchrone (pas de fetch ici)
   ============================================================ */
import type { RefObject } from 'react';
import { formatMoney, WATERMARK_LABEL, type QuoteData } from '../src/types';

interface Props {
  data: QuoteData;
  svgRef?: RefObject<SVGSVGElement | null>;
}

const W = 794;      // largeur d'une page
const PH = 1123;    // hauteur d'une page A4
const M = 56;       // marge
const PAGE = W - M * 2;

const money = (n: number, cur: QuoteData['currency']) => formatMoney(Math.round(n), cur);

/** Coupe un texte en lignes de `max` caractères (le SVG ne sait pas wrapper). */
function lines(text: string, max = 46, count = 4): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { out.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
    if (out.length === count) break;
  }
  if (out.length < count && cur) out.push(cur.trim());
  return out.slice(0, count);
}

export default function Template({ data, svgRef }: Props) {
  const accent = data.accentColor || '#0057FF';
  const font = `"${data.fontFamily || 'Inter'}",'Helvetica Neue',Arial,sans-serif`;
  const subtotal = data.items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const taxRate = data.taxRate || 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  const rows = data.items.slice(0, 12);
  const notes = lines(data.notes, 52, 4);

  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${PH}`} width="100%" height="100%" style={{ fontFamily: font }}>
      <rect x="0" y="0" width={W} height={PH} fill="#FFFFFF" />
      <rect x="0" y="0" width={W} height="6" fill={accent} />

      {/* en-tête : marque + titre du document */}
      <rect x={M} y="46" width="46" height="46" rx="12" fill={accent} />
      <text x={M + 23} y="78" textAnchor="middle" fontSize="22" fontWeight="800" fill="#FFFFFF">
        {(data.designerName || 'D').slice(0, 1).toUpperCase()}
      </text>
      <text x={M + 66} y="66" fontSize="17" fontWeight="800" fill="#111111">{data.designerName || 'Votre entreprise'}</text>
      <text x={M + 66} y="84" fontSize="9.5" fill="#777777">
        {[data.designerTitle, data.designerPhone, data.designerEmail].filter(Boolean).join('   ·   ')}
      </text>
      <text x={W - M} y="68" textAnchor="end" fontSize="26" fontWeight="900" letterSpacing="3" fill={accent}>
        {data.docType === 'facture' ? 'FACTURE' : 'DEVIS'}
      </text>
      <text x={W - M} y="86" textAnchor="end" fontSize="10" fill="#888888">{data.quoteNumber}</text>

      {/* dates + client */}
      <text x={M} y="150" fontSize="9" fontWeight="700" letterSpacing="1.2" fill="#999999">ÉMIS LE</text>
      <text x={M} y="166" fontSize="11" fill="#222222">{data.quoteDate}</text>
      <text x={M + 160} y="150" fontSize="9" fontWeight="700" letterSpacing="1.2" fill="#999999">VALABLE JUSQU'AU</text>
      <text x={M + 160} y="166" fontSize="11" fill="#222222">{data.validUntil}</text>
      <rect x={M} y="186" width={PAGE} height="58" rx="10" fill="#F6F7F9" />
      <text x={M + 16} y="208" fontSize="9" fontWeight="700" letterSpacing="1.2" fill="#999999">CLIENT</text>
      <text x={M + 16} y="226" fontSize="12" fontWeight="700" fill="#111111">{data.clientName || 'Nom du client'}</text>
      <text x={M + 16} y="239" fontSize="9.5" fill="#666666">{[data.clientCompany, data.clientAddress].filter(Boolean).join('   ·   ')}</text>

      {/* tableau des prestations */}
      <rect x={M} y="270" width={PAGE} height="26" fill={accent} />
      <text x={M + 12} y="287" fontSize="9" fontWeight="700" letterSpacing="1" fill="#FFFFFF">PRESTATION</text>
      <text x={M + 360} y="287" fontSize="9" fontWeight="700" letterSpacing="1" fill="#FFFFFF">QTÉ</text>
      <text x={M + 452} y="287" fontSize="9" fontWeight="700" letterSpacing="1" fill="#FFFFFF">P.U.</text>
      <text x={W - M - 12} y="287" textAnchor="end" fontSize="9" fontWeight="700" letterSpacing="1" fill="#FFFFFF">TOTAL</text>
      {rows.map((it, i) => {
        const ry = 311 + i * 26;
        return (
          <g key={it.id}>
            {i % 2 === 1 && <rect x={M} y={ry - 17} width={PAGE} height="26" fill="#FAFAFB" />}
            <text x={M + 12} y={ry} fontSize="10.5" fill="#222222">{String(it.description || '').slice(0, 60)}</text>
            <text x={M + 360} y={ry} fontSize="10.5" fill="#222222">{it.quantity}</text>
            <text x={M + 452} y={ry} fontSize="10.5" fill="#222222">{money(it.unitPrice || 0, data.currency)}</text>
            <text x={W - M - 12} y={ry} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#111111">
              {money((it.quantity || 0) * (it.unitPrice || 0), data.currency)}
            </text>
          </g>
        );
      })}

      {/* conditions à gauche, totaux à droite */}
      <line x1={M} y1="646" x2={W - M} y2="646" stroke="#E6E6E6" strokeWidth="1" />
      <text x={M} y="674" fontSize="9" fontWeight="700" letterSpacing="1.2" fill="#999999">CONDITIONS</text>
      {notes.map((l, i) => (
        <text key={i} x={M} y={692 + i * 14} fontSize="9.5" fill="#555555">{l}</text>
      ))}
      <text x={W - M - 200} y="674" fontSize="10" fill="#777777">Sous-total</text>
      <text x={W - M - 12} y="674" textAnchor="end" fontSize="10.5" fill="#333333">{money(subtotal, data.currency)}</text>
      <text x={W - M - 200} y="694" fontSize="10" fill="#777777">TVA {taxRate}%</text>
      <text x={W - M - 12} y="694" textAnchor="end" fontSize="10.5" fill="#333333">{money(tax, data.currency)}</text>
      <rect x={W - M - 262} y="710" width="262" height="42" rx="10" fill={accent} />
      <text x={W - M - 246} y="736" fontSize="10" fontWeight="700" letterSpacing="1" fill="#FFFFFF">TOTAL TTC</text>
      <text x={W - M - 16} y="736" textAnchor="end" fontSize="15" fontWeight="900" fill="#FFFFFF">{money(total, data.currency)}</text>

      {/* signatures */}
      <line x1={M} y1="900" x2={M + 250} y2="900" stroke="#CCCCCC" strokeWidth="1" />
      <text x={M} y="916" fontSize="9" fill="#888888">
        Signature — {data.designerName || 'émetteur'}{data.designerSignedAt ? '  ·  ' + data.designerSignedAt : ''}
      </text>
      <line x1={W - M - 250} y1="900" x2={W - M} y2="900" stroke="#CCCCCC" strokeWidth="1" />
      <text x={W - M - 250} y="916" fontSize="9" fill="#888888">
        Signature — {data.clientName || 'client'}{data.clientSignedAt ? '  ·  ' + data.clientSignedAt : ''}
      </text>

      {data.showWatermark && (
        <text x={W / 2} y={PH / 2} textAnchor="middle" fontSize="70" fontWeight="900" fill={accent} opacity="0.12"
          transform={`rotate(-28 ${W / 2} ${PH / 2})`}>{WATERMARK_LABEL[data.status]}</text>
      )}
      <text x={M} y={PH - 34} fontSize="8.5" fill="#AAAAAA">{[data.designerAddress, data.designerSiret ? 'Réf. ' + data.designerSiret : ''].filter(Boolean).join('   ·   ')}</text>
      <text x={W - M} y={PH - 34} textAnchor="end" fontSize="8.5" fill="#AAAAAA">{data.quoteNumber} · {data.docType === 'facture' ? 'Facture' : 'Devis'}</text>
    </svg>
  );
}

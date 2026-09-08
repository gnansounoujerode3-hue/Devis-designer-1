export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export type CurrencyCode = 'EUR' | 'XOF' | 'USD';

export interface CurrencyOption {
  code: CurrencyCode;
  label: string;
  symbol: string;
  symbolPosition: 'before' | 'after';
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'XOF', label: 'Franc CFA', symbol: 'F',      symbolPosition: 'after'  },
  { code: 'EUR', label: 'Euro',      symbol: '\u20AC', symbolPosition: 'after'  },
  { code: 'USD', label: 'Dollar US', symbol: '$',       symbolPosition: 'before' },
];

export function formatMoney(n: number, currencyCode: CurrencyCode): string {
  const cur = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const isInteger = abs === Math.floor(abs);
  let formatted: string;
  if (cur.code === 'USD') {
    if (isInteger) { formatted = Math.floor(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    else { const fixed = abs.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); const parts = fixed.split('.'); const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); formatted = parts.length > 1 ? intPart + '.' + parts[1] : intPart; }
  } else {
    if (isInteger) { formatted = Math.floor(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    else { const fixed = abs.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); const parts = fixed.split('.'); const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); formatted = parts.length > 1 ? intPart + ',' + parts[1] : intPart; }
  }
  if (cur.symbolPosition === 'before') return sign + cur.symbol + ' ' + formatted;
  return sign + formatted + ' ' + cur.symbol;
}

export type DocType = 'devis' | 'facture';
export type DocStatus = 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'paye';

export const STATUS_META: Record<DocStatus, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: '#888', bg: '#F0F0F0' },
  envoye:    { label: 'Envoyé',    color: '#3B82F6', bg: '#EFF6FF' },
  accepte:   { label: 'Accepté',   color: '#10B981', bg: '#ECFDF5' },
  refuse:    { label: 'Refusé',    color: '#EF4444', bg: '#FEF2F2' },
  paye:      { label: 'Payé',      color: '#8B5CF6', bg: '#F5F3FF' },
};

export const WATERMARK_LABEL: Record<DocStatus, string> = {
  brouillon: 'BROUILLON',
  envoye: 'ENVOYE',
  accepte: 'ACCEPTE',
  refuse: 'REFUSE',
  paye: 'PAYE',
};

export interface QuoteData {
  id: string;
  docType: DocType;
  status: DocStatus;
  designerName: string;
  designerTitle: string;
  designerEmail: string;
  designerPhone: string;
  designerAddress: string;
  designerSiret: string;
  designerLogo: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  clientAddress: string;
  quoteNumber: string;
  quoteDate: string;
  validUntil: string;
  items: QuoteItem[];
  notes: string;
  taxRate: number;
  accentColor: string;
  currency: CurrencyCode;
  fontFamily: string;
  templateId: TemplateId;
  designerSignature: string;
  designerSignedAt: string;
  clientSignature: string;
  clientSignedAt: string;
  showWatermark: boolean;
  /** Textes du document personnalisés par l'utilisateur (clé = chemin SVG, valeur = texte). */
  textOverrides?: Record<string, { orig: string; val: string }>;
  createdAt: number;
  updatedAt: number;
}

export interface SavedClient {
  id: string;
  name: string;
  company: string;
  email: string;
  address: string;
}

/**
 * Un émetteur enregistré — le pendant du carnet de clients pour VOTRE fiche :
 * tout ce qui remplit l'en-tête d'un devis. Le journal sert à ne pas retaper
 * ses coordonnées à chaque nouveau document, et à tenir plusieurs casiers
 * (une entreprise, une antenne, une marque) sur le même appareil.
 */
export interface SavedEmitter {
  id: string;
  /** Nom court affiché dans le carnet (« Atelier Kpodé », « Agence Nord »). */
  label: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  address: string;
  siret: string;
  /** Logo en dataURL. Peut être lourd : il saute de lui-même si le stockage est plein. */
  logo: string;
}

/**
 * Une prestation mémorisée — l'équivalent du carnet de clients, pour les LIGNES du devis.
 * Un artisan facture les dix mêmes choses : le carnet retient l'intitulé et le dernier prix
 * unitaire posé, et compte les documents qui l'utilisent (jamais les sauvegardes automatiques :
 * une même ligne enregistrée vingt fois reste une ligne d'un seul devis).
 */
export interface SavedService {
  id: string;
  /** Intitulé tel que saisi (coupé à 100 caractères, comme une ligne de devis). */
  label: string;
  /** Dernier prix unitaire posé pour cet intitulé, dans la devise du document. */
  unitPrice: number;
  /** ids des documents où cette ligne est apparue (borné : sert à compter, pas à archiver). */
  docs: string[];
  /** Nombre de documents différents qui l'ont portée — c'est ce qui trie le carnet. */
  uses: number;
  /** Dernier contact (epoch ms), pour départager deux prestations aussi fréquentes. */
  lastAt: number;
}

/**
 * Les 12 modèles embarqués, plus les designs sur mesure importés par le client :
 * « custom » = 1er emplacement (nom historique), « custom-2 » … « custom-6 » ensuite.
 */
export type BuiltinTemplateId = 'modern' | 'classic' | 'minimal' | 'creative' | 'studio' | 'architect' | 'adapted' | 'minimalist' | 'purple' | 'corporate' | 'modernorange' | 'cleangradient';
export type TemplateId = BuiltinTemplateId | 'custom' | `custom-${number}`;

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
}

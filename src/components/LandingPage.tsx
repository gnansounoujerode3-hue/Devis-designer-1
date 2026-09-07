import { useEffect, useMemo, useState, type ReactNode } from 'react';
import logoUrl from '../assets/logo.png';
import QuoteSVG from './QuoteSVG';
import FAQModal from './FAQModal';
import LegalModal from './LegalModal';
import { TEMPLATES } from '../templates';
import { createDefaultDoc } from '../store';
import { VENDOR, APP_VERSION } from '../lib/config';
import { FREE_EXPORT_LIMIT, PRICE_MONTHLY, PRICE_ANNUAL, PRICE_CUSTOM_DESIGN, PRICE_ALL } from '../lib/license';
import { saveParrainCode } from '../lib/referral';
import { goApp } from '../lib/route';
import type { QuoteData, TemplateId } from '../types';

/* ============================================================
   PAGE D'ACCUEIL PUBLIQUE (landing)
   ------------------------------------------------------------
   Elle est servie à la racine du site ; l'application se trouve
   derrière le bouton « Ouvrir l'application » (route #/app).
   Même charte que l'app : fond #F0F0F0, cartes blanches, accent
   #0057FF, Inter, mode sombre repris de la préférence 'devis_dark'.
   Les aperçus de document sont RÉELS : ce sont les composants des
   modèles de l'app qui rendent un jeu de données de démonstration.
   Règle de rédaction : on n'écrit jamais que l'app s'ouvre hors
   réseau (elle a besoin d'internet), et on n'invente ni retour client
   ni chiffre d'usage.
   ============================================================ */

const ACCENT = '#0057FF';
const CARD_RADIUS = 18;

/* Petit utilitaire : 2000 s'affiche « 2 000 F CFA » (espace insécable française). */
function price(n: number): string {
  return `${n.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} F CFA`;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------
   Jeu de données de démonstration.
   Aucun document n'est créé ni sauvegardé : createDefaultDoc() lit
   uniquement la numérotation existante, et le résultat n'est jamais
   passé à saveDoc(). Les coordonnées ci-dessous sont fictives et
   l'aperçu est marqué « démonstration » à l'écran.
   ------------------------------------------------------------ */
function demoDoc(overrides: Partial<QuoteData> = {}): QuoteData {
  return createDefaultDoc({
    docType: 'devis',
    status: 'accepte',
    designerName: 'Atelier Kpodé',
    designerTitle: 'Design graphique & impression',
    designerEmail: 'contact@atelier-kpode.bj',
    designerPhone: '+229 01 00 00 00 00',
    designerAddress: 'Cotonou, Bénin',
    designerLogo: logoUrl,
    clientName: 'M. Bidossessi',
    clientCompany: 'SARL Sunlè',
    clientEmail: 'commandes@sunle.bj',
    clientAddress: 'Porto-Novo, Bénin',
    quoteNumber: 'DEV-2026-014',
    quoteDate: '2026-09-01',
    validUntil: '2026-10-01',
    items: [
      { id: 'd1', description: 'Création de logo — 3 propositions', quantity: 1, unitPrice: 120000 },
      { id: 'd2', description: 'Charte graphique (PDF, 12 pages)', quantity: 1, unitPrice: 180000 },
      { id: 'd3', description: 'Impression 500 cartes de visite', quantity: 500, unitPrice: 150 },
      { id: 'd4', description: 'Retouches et fichiers sources', quantity: 3, unitPrice: 15000 },
    ],
    notes: 'Acompte de 30% à la signature du devis. Solde à la livraison finale.',
    showWatermark: false,
    ...overrides,
  });
}

/* ------------------------------------------------------------
   Icônes : SVG inline, monochromes, trait 1.8 — même langage visuel
   que les icônes du menu « Exporter » de l'application. Pas d'emoji :
   ils rendent mal selon l'OS et ne suivent ni la couleur ni le mode sombre.
   ------------------------------------------------------------ */
type IconName = 'doc' | 'grid' | 'pen' | 'export' | 'users' | 'percent' | 'device' | 'cursor' | 'sun' | 'moon';

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const g = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === 'doc' && (<g {...g}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 16h4" /></g>)}
      {name === 'grid' && (<g {...g}><rect x="3.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.6" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.6" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.6" /></g>)}
      {name === 'pen' && (<g {...g}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14.2 5.8 18.2 9.8" /></g>)}
      {name === 'export' && (<g {...g}><path d="M12 3v11" /><path d="M8 10.6 12 14.6 16 10.6" /><path d="M4.5 17v3.5h15V17" /></g>)}
      {name === 'users' && (<g {...g}><circle cx="9" cy="8" r="3.2" /><path d="M3.6 20.4c0-3.1 2.4-5.2 5.4-5.2s5.4 2.1 5.4 5.2" /><path d="M16 5.6a3.2 3.2 0 0 1 0 5.5" /><path d="M17.6 15.6c1.8.7 2.9 2.4 2.9 4.5" /></g>)}
      {name === 'percent' && (<g {...g}><path d="M19 5 5 19" /><circle cx="8" cy="8" r="2.4" /><circle cx="16" cy="16" r="2.4" /></g>)}
      {name === 'device' && (<g {...g}><rect x="2.5" y="4.5" width="13.5" height="10.5" rx="1.6" /><path d="M5.5 19h7.5" /><rect x="17.6" y="9" width="4" height="9.5" rx="1.4" /></g>)}
      {name === 'cursor' && (<g {...g}><path d="M6 3.4 19 8.2l-5.4 1.7-1.8 5.4z" /><path d="M13 14.6 18.4 20" /></g>)}
      {name === 'sun' && (<g {...g}><circle cx="12" cy="12" r="4" /><path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5" /></g>)}
      {name === 'moon' && (<g {...g}><path d="M20 14.6A8.4 8.4 0 1 1 9.6 4.1 7 7 0 0 0 20 14.6z" /></g>)}
    </svg>
  );
}

/* Tuile d'icône, comme dans le menu Exporter de l'app. */
function IconTile({ name, dark }: { name: IconName; dark: boolean }) {
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${dark ? 'bg-zinc-800 text-zinc-300' : 'bg-[#F2F2F2] text-[#444]'}`}>
      <Icon name={name} />
    </div>
  );
}

/* ============================ UI atoms ============================ */

function Chip({ children, tone = 'blue', dark }: { children: ReactNode; tone?: 'blue' | 'green' | 'neutral'; dark: boolean }) {
  const tones = {
    blue: dark ? 'bg-blue-950/40 text-blue-300 border-blue-900' : 'bg-blue-50 text-[#0057FF] border-[#0057FF]/20',
    green: dark ? 'bg-green-950/40 text-green-300 border-green-900' : 'bg-green-50 text-green-700 border-green-200',
    neutral: dark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#F6F6F6] text-[#555] border-[#E8E8E8]',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function SectionTitle({ kicker, title, sub, dark }: { kicker: string; title: string; sub?: string; dark: boolean }) {
  return (
    <div className="max-w-2xl mb-10">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] mb-3" style={{ color: ACCENT }}>{kicker}</div>
      <h2 className={`text-2xl sm:text-[34px] font-extrabold tracking-tight leading-[1.15] ${dark ? 'text-white' : 'text-[#111]'}`}>{title}</h2>
      {sub && <p className={`mt-4 text-[15px] sm:text-base leading-relaxed ${dark ? 'text-zinc-400' : 'text-[#555]'}`}>{sub}</p>}
    </div>
  );
}

/* Aperçu d'un modèle, à l'échelle du conteneur (le SVG est en viewBox). */
function DocPreview({ templateId, accent = ACCENT, className = '' }: { templateId: TemplateId; accent?: string; className?: string }) {
  const data = useMemo(() => demoDoc({ templateId, accentColor: accent }), [templateId, accent]);
  return (
    <div
      className={`overflow-hidden bg-white ${className}`}
      style={{ aspectRatio: '794 / 1123' }}
      aria-hidden="true"
    >
      <QuoteSVG data={data} />
    </div>
  );
}

/* ============================ Page ============================ */

export default function LandingPage() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('devis_dark') === '1'; } catch { return false; }
  });
  const [faqOpen, setFaqOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'cgu' | 'privacy'>('cgu');
  const [openQ, setOpenQ] = useState<number | null>(0);

  /* Le visiteur arrive peut-être avec un lien de parrainage (…?ref=DDREF-…).
     On l'enregistre ici aussi : sinon le code serait perdu pour la personne
     qui lit la page d'accueil sans entrer dans l'application. */
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('ref');
      if (p) saveParrainCode(p);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('devis_dark', dark ? '1' : '0'); } catch { /* ignore */ }
  }, [dark]);

  const bg = dark ? 'bg-[#0a0a0a]' : 'bg-[#F0F0F0]';
  const card = dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-[#E6E6E6]';
  const ink = dark ? 'text-white' : 'text-[#111]';
  const mute = dark ? 'text-zinc-400' : 'text-[#555]';
  const soft = dark ? 'text-zinc-500' : 'text-[#888]';

  const features: Array<{ t: string; d: string; i: IconName }> = [
    { i: 'doc', t: 'Devis et factures dans la même fiche', d: 'Un document se convertit en facture en un clic, avec sa propre numérotation. Cinq statuts de suivi : brouillon, envoyé, accepté, refusé, payé.' },
    { i: 'grid', t: `${TEMPLATES.length} modèles mis en page`, d: 'Chaque modèle est une mise en page complète (en-tête, tableau, totaux, conditions), pas un simple habillage. La couleur d’accent et la police se changent à tout moment.' },
    { i: 'pen', t: 'Signature en ligne', d: 'Le client signe avec le doigt ou la souris sur le document, ou vous joignez l’image de votre cachet. La date de signature est inscrite sur le PDF.' },
    { i: 'export', t: 'PDF A4, SVG ou présentation', d: "Export PDF multi-pages prêt à envoyer, SVG vectoriel à confier à l'imprimeur, ou présentation plein écran du devis chez le client." },
    { i: 'users', t: 'Fichier clients', d: 'Les coordonnées d’un client sont réutilisées d’un document à l’autre : plus rien à retaper pour une relance ou une facture.' },
    { i: 'percent', t: 'TVA et multi-devises', d: 'Taux de taxe paramétrable, conditions et notes libres imprimées sous le tableau, montants en franc CFA, en euros ou en dollars.' },
    { i: 'device', t: 'Sauvegarde sur l’appareil', d: 'Tout ce que vous saisissez est enregistré dans le navigateur — automatiquement, toutes les quelques secondes — et vous pouvez exporter une copie JSON à réimporter plus tard sur un autre appareil.' },
    { i: 'cursor', t: 'Édition directe sur le document', d: "Activez l'édition directe et tapez directement sur l'aperçu : chaque texte du devis est modifiable là où il se lit, sans chercher le bon champ dans le panneau." },
  ];

  const steps: Array<{ n: string; t: string; d: string }> = [
    { n: '1', t: 'Renseignez votre entreprise', d: "Nom, activité, coordonnées, logo : l'en-tête de votre devis. Pour le document suivant, dupliquez le précédent — vous ne le retapez pas." },
    { n: '2', t: 'Ajoutez vos lignes', d: 'Prestations, quantités, prix unitaires. La TVA, le total et l’acompte se calculent pendant que vous tapez.' },
    { n: '3', t: 'Choisissez le modèle', d: 'Comparez les 12 mises en page sur votre propre contenu, ajustez la couleur et la police.' },
    { n: '4', t: 'Exportez, faites signer', d: "PDF à envoyer, fichier de signature pour le client, puis conversion en facture une fois l'accord reçu." },
  ];

  const offers: Array<{ name: string; amount: string; note?: string; desc: string; best?: boolean }> = [
    { name: 'Découverte', amount: '0 F', note: `${FREE_EXPORT_LIMIT} exports offerts`, desc: `${FREE_EXPORT_LIMIT} exports par appareil sur 30 jours, tous les modèles inclus. Sans carte bancaire, sans engagement.` },
    { name: 'Abonnement 1 mois', amount: price(PRICE_MONTHLY), desc: 'Exports et envois en signature illimités pendant 1 mois. L’offre s’active dès que le paiement est confirmé.' },
    { name: 'Abonnement 1 an', amount: price(PRICE_ANNUAL), note: 'soit 1 250 F/mois', desc: `12 mois d’exports illimités. ${price(PRICE_ANNUAL)} au lieu de ${price(PRICE_MONTHLY * 12)} : 9 000 F d’économie.`, best: true },
    { name: 'Design personnalisé', amount: price(PRICE_CUSTOM_DESIGN), desc: `Le vendeur crée une mise en page à vos couleurs, pour vous seul — et 1 mois d'exports illimités est inclus. Vous recevez le design en fichier, à importer dans l'application.` },
    { name: 'Tous les designs · 1 an', amount: price(PRICE_ALL), desc: 'N’importe quel modèle gratuit pendant 1 an, exports illimités inclus.' },
  ];

  const faqs: Array<{ q: string; a: string }> = [
    { q: 'Faut-il installer quelque chose ?', a: 'Non. Devis Designer est un site web : vous l’ouvrez dans le navigateur de l’ordinateur ou du téléphone, et le document se met en page immédiatement. En revanche, il faut une connexion internet pour l’ouvrir — l’application ne fonctionne pas hors connexion.' },
    { q: 'Où sont mes documents ?', a: 'Sur votre appareil, dans le stockage du navigateur. Ils ne sont envoyés à aucun serveur. Pensez à exporter régulièrement « Exporter une copie » : c’est ce fichier qui vous permet de tout retrouver après un changement d’ordinateur ou un nettoyage du navigateur.' },
    { q: 'Combien de devis puis-je faire gratuitement ?', a: `${FREE_EXPORT_LIMIT} exports (PDF, image ou envoi en signature) par appareil et par période de 30 jours. Vous pouvez vous abonner, ou demander à un ami de vous parrainer. Au-delà, le compte est réellement tenu par le serveur du vendeur : la navigation privée ne remet pas le compteur à zéro.` },
    { q: 'Comment ça se passe pour payer ?', a: 'Dans l’application : bouton « PRO », vous choisissez l’offre, vous cliquez sur « Payer ». La caisse de paiement en ligne s’ouvre (Chariow : MTN MoMo, Orange Money, Wave, Moov) et l’offre s’active toute seule dès que le paiement est confirmé — aucun code à recopier. En secours, si la caisse ne répond pas : paiement Mobile Money au numéro du vendeur, puis le code d’activation qu’il vous envoie à saisir dans « Activer ». Dans les deux cas, le paiement ne se renouvelle pas tout seul : l’accès s’arrête à l’échéance, sans prélèvement automatique.' },
    { q: 'Et si je change d’ordinateur ?', a: 'Exportez une copie JSON depuis l’ancien poste (« Sauvegarder »), réimportez-la sur le nouveau. Le compteur d’exports est transféré avec la copie, pour ne pas repartir de zéro ni repartir sans limite.' },
  ];

  return (
    <div className={`min-h-screen ${bg}`} style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>
      {/* ============================ Header ============================ */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur ${dark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white/90 border-[#E4E4E4]'}`}>
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 h-[62px] flex items-center gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <img src={logoUrl} width={32} height={32} alt="" style={{ borderRadius: 8, objectFit: 'cover' }} />
            <div className="leading-none">
              <div className={`text-[13px] font-extrabold tracking-tight ${ink}`}>DEVIS</div>
              <div className={`text-[9px] font-semibold tracking-[0.2em] mt-0.5 ${soft}`}>DESIGNER</div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 ml-4">
            {[['Fonctionnalités', 'features'], ['Modèles', 'templates'], ['Tarifs', 'pricing'], ['Parrainage', 'referral'], ['FAQ', 'faq']].map(([label, id]) => (
              <button
                key={id}
                onClick={() => scrollToId(id)}
                className={`px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors hover:bg-[#0057FF]/10 ${mute}`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setDark(v => !v)}
              title={dark ? 'Mode clair' : 'Mode sombre'}
              aria-label={dark ? 'Passer en mode clair' : 'Passer en mode sombre'}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${dark ? 'bg-zinc-800 border-zinc-700 text-yellow-400' : 'bg-white border-[#E0E0E0] text-zinc-600'}`}
            >
              <Icon name={dark ? 'sun' : 'moon'} size={17} />
            </button>
            <button
              onClick={goApp}
              className="h-9 px-4 rounded-lg text-[13px] font-bold text-white transition-transform active:scale-[0.98]"
              style={{ background: ACCENT }}
            >
              Ouvrir l'application
            </button>
          </div>
        </div>
      </header>

      {/* ============================ Hero ============================ */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 -top-40 h-[420px] opacity-[0.13]"
          style={{ background: `radial-gradient(60% 60% at 50% 50%, ${ACCENT} 0%, transparent 70%)` }}
        />
        <div className="relative mx-auto max-w-[1180px] px-4 sm:px-6 pt-14 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
          <div>
            <div className="flex flex-wrap gap-2 mb-6">
              <Chip dark={dark}>{FREE_EXPORT_LIMIT} exports offerts</Chip>
              <Chip dark={dark} tone="neutral">Aucune installation</Chip>
              <Chip dark={dark} tone="green">Paiement Mobile Money en ligne</Chip>
            </div>
            <h1 className={`text-[34px] sm:text-[52px] font-extrabold tracking-[-0.02em] leading-[1.05] ${ink}`}>
              Vos devis et vos factures <span style={{ color: ACCENT }}>aussi soignés</span> que votre travail.
            </h1>
            <p className={`mt-6 text-[16px] sm:text-[17px] leading-relaxed max-w-xl ${mute}`}>
              Renseignez votre entreprise, ajoutez vos lignes, choisissez une mise en page : le document est prêt à
              être envoyé, signé et réglé. Devis Designer s'ouvre dans le navigateur — les {TEMPLATES.length} modèles
              sont inclus, et {FREE_EXPORT_LIMIT} exports vous sont offerts pour commencer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={goApp}
                className="h-12 px-6 rounded-xl text-[15px] font-bold text-white shadow-[0_10px_30px_-12px_rgba(0,87,255,0.8)] transition-transform active:scale-[0.98]"
                style={{ background: ACCENT }}
              >
                Ouvrir l'application
              </button>
              <button
                onClick={() => scrollToId('templates')}
                className={`h-12 px-6 rounded-xl text-[15px] font-bold border transition-colors ${dark ? 'border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'border-[#DADADA] text-[#222] hover:bg-white'}`}
              >
                Voir les {TEMPLATES.length} modèles
              </button>
            </div>
            <p className={`mt-6 text-[12.5px] leading-relaxed max-w-lg ${soft}`}>
              Connexion internet nécessaire pour ouvrir l'application · vos documents restent sur votre appareil ·
              pas de compte à créer, pas de carte bancaire.
            </p>
          </div>

          {/* Aperçu réel : composant du modèle « Modern » avec données de démonstration */}
          <div className="relative">
            <div className={`rounded-[24px] border p-3 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)] ${card}`}>
              <DocPreview templateId="modern" className="rounded-[14px] border border-[#ECECEC]" />
            </div>
            <div className={`absolute -bottom-4 left-3 sm:-left-4 rounded-2xl border px-4 py-3 shadow-lg ${card}`}>
              <div className={`text-[10px] font-extrabold uppercase tracking-wider ${soft}`}>Total TTC</div>
              <div className={`text-[19px] font-extrabold ${ink}`}>
                {(() => {
                  const d = demoDoc();
                  const sub = d.items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);
                  return Math.round(sub * (1 + d.taxRate / 100)).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + ' F CFA';
                })()}
              </div>
            </div>
            <div className={`absolute top-5 -right-1 sm:-right-3 rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${card} ${soft}`}>
              Document de démonstration
            </div>
          </div>
        </div>
      </section>

      {/* ============================ Repères ============================ */}
      <section className={`border-y ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-[#E4E4E4] bg-white'}`}>
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-7 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            [`${TEMPLATES.length}`, 'modèles de mise en page'],
            ['2', 'types de documents : devis, facture'],
            ['5', 'statuts de suivi, du brouillon au paiement'],
            ['3', 'devises : franc CFA, euro, dollar US'],
          ].map(([big, small]) => (
            <div key={small}>
              <div className={`text-[26px] font-extrabold tracking-tight ${ink}`}>{big}</div>
              <div className={`text-[12.5px] mt-1 leading-snug ${soft}`}>{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ Fonctionnalités ============================ */}
      <section id="features" className="mx-auto max-w-[1180px] px-4 sm:px-6 py-16 sm:py-24 scroll-mt-[70px]">
        <SectionTitle
          kicker="Ce que fait l'application"
          title="Tout ce qu'il faut pour qu'un devis se signe, se relance et se facture."
          sub="Pas de traitement de texte à mettre en page, pas de tableur à bricoler : l'application connaît les usages du métier."
          dark={dark}
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(f => (
            <div key={f.t} className={`border p-5 transition-shadow hover:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.35)] ${card}`} style={{ borderRadius: CARD_RADIUS }}>
              <IconTile name={f.i} dark={dark} />
              <div className={`text-[14.5px] font-extrabold leading-snug ${ink}`}>{f.t}</div>
              <p className={`mt-2 text-[13px] leading-relaxed ${mute}`}>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ Comment ça marche ============================ */}
      <section className={`border-y ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-[#E4E4E4] bg-white'}`}>
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-16 sm:py-20">
          <SectionTitle kicker="Comment ça marche" title="Quatre étapes, et le document part." dark={dark} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map(s => (
              <div key={s.n} className={`relative rounded-2xl border p-5 ${card}`}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-extrabold text-white mb-4"
                  style={{ background: ACCENT }}
                >
                  {s.n}
                </div>
                <div className={`text-[14.5px] font-extrabold ${ink}`}>{s.t}</div>
                <p className={`mt-2 text-[13px] leading-relaxed ${mute}`}>{s.d}</p>
              </div>
            ))}
          </div>
          <div className={`mt-8 flex flex-wrap items-center gap-3 text-[13px] ${soft}`}>
            <span>Pas de compte à créer :</span>
            <button onClick={goApp} className="font-bold underline underline-offset-4" style={{ color: ACCENT }}>
              ouvrez l'application
            </button>
            <span>et commencez à saisir. La sauvegarde se fait toute seule dans le navigateur.</span>
          </div>
        </div>
      </section>

      {/* ============================ Modèles ============================ */}
      <section id="templates" className="mx-auto max-w-[1180px] px-4 sm:px-6 py-16 sm:py-24 scroll-mt-[70px]">
        <SectionTitle
          kicker="Les modèles"
          title={`Les ${TEMPLATES.length} mises en page sont incluses, sans surcoût.`}
          sub="Chaque aperçu ci-dessous est rendu par le modèle lui-même, avec les mêmes règles de pagination que dans l'application. Vous les comparez sur votre propre contenu une fois à l'intérieur."
          dark={dark}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {TEMPLATES.map(t => (
            <figure key={t.id} className={`${card} rounded-2xl border p-3 transition-transform hover:-translate-y-0.5`}>
              <DocPreview templateId={t.id} className="rounded-lg border border-[#EFEFEF]" />
              <figcaption className="pt-3 pb-1 px-1">
                <div className={`text-[13px] font-extrabold ${ink}`}>{t.name}</div>
                <div className={`text-[11.5px] mt-1 leading-snug ${soft}`}>{t.description}</div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className={`mt-8 text-[13px] ${soft}`}>
          Un modèle qui n'existe pas encore ? Le vendeur peut créer une mise en page à vos couleurs pour{' '}
          <span className={`font-bold ${ink}`}>{price(PRICE_CUSTOM_DESIGN)}</span>.
        </p>
      </section>

      {/* ============================ Tarifs ============================ */}
      <section id="pricing" className={`border-y ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-[#E4E4E4] bg-white'} scroll-mt-[70px]`}>
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-16 sm:py-24">
          <SectionTitle
            kicker="Tarifs"
            title="Commencez gratuitement. Le reste, ça se règle en ligne."
            sub={`${FREE_EXPORT_LIMIT} exports offerts par appareil et par période de 30 jours. Ensuite, l'abonnement se paie dans l'application, via la caisse de paiement Chariow (MTN MoMo, Orange Money, Wave, Moov) : l'offre s'active dès que le paiement est confirmé. Il n'y a ni prélèvement automatique, ni renouvellement forcé.`}
            dark={dark}
          />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.map(o => (
              <div
                key={o.name}
                className={`relative rounded-[20px] border p-6 ${card}`}
                style={o.best ? { borderColor: ACCENT, borderWidth: 2 } : undefined}
              >
                {o.best && (
                  <div className="absolute -top-3 left-6 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white" style={{ background: ACCENT }}>
                    Le plus avantageux
                  </div>
                )}
                <div className={`text-[12.5px] font-extrabold uppercase tracking-wider ${soft}`}>{o.name}</div>
                <div className="mt-3 flex items-end gap-2">
                  <div className={`text-[30px] font-extrabold tracking-tight ${ink}`}>{o.amount}</div>
                  {o.note && <div className={`pb-2 text-[12px] font-semibold ${soft}`}>{o.note}</div>}
                </div>
                <p className={`mt-4 text-[13.5px] leading-relaxed ${mute}`}>{o.desc}</p>
              </div>
            ))}
            <div className={`rounded-[20px] border p-6 flex flex-col ${card}`}>
              <div className={`text-[12.5px] font-extrabold uppercase tracking-wider ${soft}`}>Comment payer</div>
              <ol className="mt-3 space-y-3">
                {[
                  {
                    t: (<>Dans l'application : bouton <b className={ink}>« PRO »</b>, l'offre, puis <b className={ink}>« Payer »</b>. La caisse de paiement en ligne s'ouvre (Chariow : MTN MoMo, Orange Money, Wave, Moov) et l'offre s'active <b className={ink}>toute seule</b> dès le paiement confirmé — aucun code à recopier.</>),
                  },
                  {
                    t: (<>
                      <b className={ink}>Si la caisse ne répond pas</b> (à titre de secours) : paiement Mobile Money
                      direct au <b className={ink}>{VENDOR.PHONE}</b>, vous envoyez la référence par WhatsApp et le
                      vendeur vous transmet un code à coller dans « Activer ».
                    </>),
                  },
                ].map((row, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-[22px] h-[22px] rounded-full shrink-0 mt-0.5 flex items-center justify-center text-[11px] font-extrabold text-white" style={{ background: ACCENT }}>
                      {i + 1}
                    </span>
                    <p className={`text-[13.5px] leading-relaxed ${mute}`}>{row.t}</p>
                  </li>
                ))}
              </ol>
              <p className={`mt-4 text-[12px] ${soft}`}>Dans les deux cas : aucun prélèvement automatique, aucun renouvellement forcé.</p>
              <button
                onClick={goApp}
                className="mt-auto pt-0 h-11 rounded-xl text-white text-[14px] font-bold"
                style={{ background: ACCENT }}
              >
                Ouvrir l'application
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ Parrainage ============================ */}
      <section id="referral" className="mx-auto max-w-[1180px] px-4 sm:px-6 py-16 sm:py-24 scroll-mt-[70px]">
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-10 items-center">
          <div>
            <SectionTitle
              kicker="Parrainage"
              title="Un ami qui commence, un mois offert pour vous."
              sub="Dans l'application, chaque utilisateur dispose d'un lien de parrainage personnel. Vous le partagez sur WhatsApp, à votre atelier, à votre fournisseur : dès qu'une personne que vous avez invitée fait son premier export, vous recevez un mois d'abonnement."
              dark={dark}
            />
            <button
              onClick={goApp}
              className="h-12 px-6 rounded-xl text-[15px] font-bold text-white"
              style={{ background: ACCENT }}
            >
              Récupérer mon lien de parrainage
            </button>
          </div>
          <div className={`${card} rounded-[22px] border p-6 sm:p-8`}>
            <ol className="space-y-5">
              {[
                ["Vous partagez votre lien", "Le lien contient votre code personnel (DDREF-…). Il ouvre directement l'application."],
                ['Votre filleul travaille', 'Il crée ses devis normalement. Le jour où il fait son premier export, le serveur le constate.'],
                ["Le mois est crédité", "La récompense arrive sur votre compte : un mois d'abonnement, plafonné à 12 mois sur les 12 derniers mois."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold text-white shrink-0"
                    style={{ background: ACCENT }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div className={`text-[14px] font-extrabold ${ink}`}>{t}</div>
                    <div className={`text-[13px] mt-1 leading-relaxed ${mute}`}>{d}</div>
                  </div>
                </li>
              ))}
            </ol>
            <p className={`mt-6 pt-5 border-t text-[12.5px] leading-relaxed ${soft} ${dark ? 'border-zinc-800' : 'border-[#EDEDED]'}`}>
              Les règles, clairement : un mois offert par filleul et par parrain, maximum 12 mois gagnés sur
              12 mois glissants, et un seul mois par installation filleul (elle ne compte qu'une fois). Le parrainage
              fait gagner un mois au parrain — le filleul, lui, garde simplement ses {FREE_EXPORT_LIMIT} exports
              gratuits. Les compteurs sont tenus par le serveur du vendeur, pas par le navigateur.
            </p>
          </div>
        </div>
      </section>

      {/* ============================ FAQ ============================ */}
      <section id="faq" className={`border-y ${dark ? 'border-zinc-800 bg-zinc-900/40' : 'border-[#E4E4E4] bg-white'} scroll-mt-[70px]`}>
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-[0.8fr_1.2fr] gap-10">
          <div>
            <SectionTitle kicker="Questions fréquentes" title="Ce que les gens demandent avant d'ouvrir l'application." dark={dark} />
            <button
              onClick={() => setFaqOpen(true)}
              className={`h-11 px-5 rounded-xl text-[14px] font-bold border ${dark ? 'border-zinc-700 text-zinc-200' : 'border-[#DADADA] text-[#222]'} hover:bg-[#0057FF]/5`}
            >
              Lire la FAQ complète
            </button>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => {
              const on = openQ === i;
              return (
                <div key={f.q} className={`${card} rounded-2xl border overflow-hidden`}>
                  <button
                    onClick={() => setOpenQ(on ? null : i)}
                    aria-expanded={on}
                    className="w-full text-left px-5 py-4 flex items-center gap-4"
                  >
                    <span className={`flex-1 text-[14.5px] font-extrabold leading-snug ${ink}`}>{f.q}</span>
                    <span className={`text-[18px] leading-none transition-transform ${on ? 'rotate-45' : ''}`} style={{ color: ACCENT }} aria-hidden="true">+</span>
                  </button>
                  {on && <p className={`px-5 pb-5 text-[13.5px] leading-relaxed ${mute}`}>{f.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================ Bande finale ============================ */}
      <section className="mx-auto max-w-[1180px] px-4 sm:px-6 py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-[26px] border p-8 sm:p-12" style={{ background: dark ? '#111' : '#fff', borderColor: dark ? '#27272a' : '#E6E6E6' }}>
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-[320px] w-[320px] rounded-full opacity-[0.16]"
            style={{ background: `radial-gradient(circle, ${ACCENT} 0%, transparent 70%)` }}
          />
          <div className="relative grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
            <div>
              <h2 className={`text-[26px] sm:text-[34px] font-extrabold tracking-tight leading-[1.15] ${ink}`}>
                Votre prochain devis peut être le plus beau de la ville.
              </h2>
              <p className={`mt-4 text-[15px] leading-relaxed ${mute}`}>
                {FREE_EXPORT_LIMIT} exports offerts, {TEMPLATES.length} modèles, aucune inscription. Et si une question
                vous arrête, le vendeur répond directement sur WhatsApp.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={goApp} className="h-12 rounded-xl text-white text-[15px] font-bold" style={{ background: ACCENT }}>
                Ouvrir l'application
              </button>
              <a
                href={VENDOR.WHATSAPP.split('?')[0]}
                target="_blank"
                rel="noopener noreferrer"
                className={`h-12 rounded-xl border text-[15px] font-bold flex items-center justify-center gap-2 ${dark ? 'border-zinc-700 text-zinc-200' : 'border-[#DADADA] text-[#222]'}`}
              >
                Écrire au vendeur sur WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ Pied de page ============================ */}
      <footer className={`border-t ${dark ? 'border-zinc-800' : 'border-[#E4E4E4]'}`}>
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoUrl} width={26} height={26} alt="" style={{ borderRadius: 6, objectFit: 'cover' }} />
            <div>
              <div className={`text-[13px] font-extrabold ${ink}`}>{VENDOR.APP_NAME}</div>
              <div className={`text-[11.5px] mt-0.5 ${soft}`}>Version {APP_VERSION} · document de démonstration sur cette page</div>
            </div>
          </div>
          <div className={`flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] ${mute}`}>
            <a href={`mailto:${VENDOR.EMAIL}`} className="hover:underline">Contact : {VENDOR.EMAIL}</a>
            <button onClick={() => { setLegalTab('cgu'); setLegalOpen(true); }} className="font-bold hover:underline">Conditions d'utilisation</button>
            <button onClick={() => { setLegalTab('privacy'); setLegalOpen(true); }} className="font-bold hover:underline">Confidentialité</button>
          </div>
        </div>
      </footer>

      <FAQModal open={faqOpen} onClose={() => setFaqOpen(false)} />
      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} initialTab={legalTab} />
    </div>
  );
}

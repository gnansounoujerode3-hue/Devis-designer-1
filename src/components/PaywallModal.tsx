import { useEffect, useRef, useState } from 'react';
import {
  FREE_EXPORT_LIMIT, PRICE_MONTHLY, PRICE_ANNUAL, PRICE_CUSTOM_DESIGN, PRICE_ALL,
  LicenseState, loadLicense, getExportCount, applyCode,
  isLicensed, daysLeft,
} from '../lib/license';
import { VENDOR, CHARIOW_LINKS, createChariowPayment } from '../lib/config';
import { explainWorkerFailure, invalidateWorkerBase, isWorkerConfigured, warmWorkerBase, workerBase } from '../lib/workerBase';
import { getMyRefCode } from '../lib/referral';
import { quotaRefresh, type QuotaState } from '../lib/quota';
import ReferralCard from './ReferralCard';
import QuotaUnlockCard from './QuotaUnlockCard';
import CustomDesignCard from './CustomDesignCard';

interface Props {
  open: boolean;
  onClose: () => void;
  /** true si le blocage vient d'une tentative de création */
  blocked?: boolean;
  /** État du compteur d'exports côté serveur (null = compteur purement local). */
  quota?: QuotaState | null;
  onQuotaChange?: (q: QuotaState | null) => void;
  onActivated?: () => void;
}

type OfferId = 'monthly' | 'annual' | 'design' | 'all';

const OFFERS: { id: OfferId; title: string; price: number; desc: string; badge?: string; link: string }[] = [
  { id: 'monthly', title: 'Abonnement Mensuel', price: PRICE_MONTHLY, desc: 'Exports PDF et envois signature illimités pendant 1 mois.', badge: 'Populaire', link: CHARIOW_LINKS.MONTHLY },
  { id: 'annual', title: 'Abonnement 1 An', price: PRICE_ANNUAL, desc: 'Exports illimités pendant 1 an. Économisez 2 mois par rapport au mensuel.', link: CHARIOW_LINKS.ANNUAL },
  { id: 'design', title: 'Design Personnalisé', price: PRICE_CUSTOM_DESIGN, desc: 'Un design sur mesure pour VOTRE document, créé pour vous + 1 mois d’exports illimités.', link: CHARIOW_LINKS.CUSTOM_DESIGN },
  { id: 'all', title: 'TOUS les Designs (1 an)', price: PRICE_ALL, desc: 'N\'importe quel design de template gratuit pendant 1 an + exports illimités.', badge: 'Best value', link: CHARIOW_LINKS.ALL },
];

const fmt = (n: number) => n.toLocaleString('fr-FR') + ' F';

export default function PaywallModal({ open, onClose, blocked, quota, onQuotaChange, onActivated }: Props) {
  const [license, setLicense] = useState<LicenseState>(() => loadLicense());
  const [code, setCode] = useState('');
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [paying, setPaying] = useState<OfferId | null>(null);
  const [contactDesign, setContactDesign] = useState(false);

  /* ---------------- Paiement automatique (Worker + Chariow) ----------------
     Si AUTO_PAY_WORKER_URL est configuré : le client paie, le Worker
     reçoit la confirmation Chariow (Pulse signé) et génère le code,
     l'application l'applique automatiquement. Sinon : flux manuel. */
  const autoPay = isWorkerConfigured();
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  /* Chariow exige nom + numéro + email. Un client qui appuie sur PAYER sans les remplir ne
     comprenait rien : le message d'erreur arrivait après coup, et les champs restaient neutres.
     `tried` allume donc le marqueur * sur ce qui manque précisément (et seulement après le
     premier essai : marquer un champ vierge d'un astérisque rouge avant même qu'il ait tapé
     est une pression inutile). */
  const [tried, setTried] = useState(false);
  const missing = {
    name: !customer.name.trim(),
    phone: customer.phone.replace(/\D/g, '').length < 8,
    email: !customer.email.trim(),
  };
  const custOk = !missing.name && !missing.phone && !missing.email;
  const fieldCls = (bad: boolean) => 'px-3 py-2.5 text-sm rounded-lg border focus:outline-none '
    + (bad ? 'border-red-400 bg-red-50/40 dark:bg-red-950/20' : 'border-[#E0E0E0] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white focus:border-[#0057FF]');
  const [autoState, setAutoState] = useState<'idle' | 'starting' | 'openCheckout' | 'waiting' | 'activating' | 'done' | 'error' | 'cancelled'>('idle');
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const [realStatus, setRealStatus] = useState<string | null>(null);
  const [payStatus, setPayStatus] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTries = useRef(0);
  const [activePurchase, setActivePurchase] = useState<string | null>(null);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => {
    if (!open) { stopPolling(); setActivePurchase(null); setAutoState('idle'); setAutoMsg(null); setRealStatus(null); setPayStatus(null); setCheckoutUrl(null); }
  }, [open]);
  useEffect(() => () => stopPolling(), []);

  /* À l'ouverture, on relit le serveur (un déblocage a pu être accordé entre-temps).
     Ce hook est placé AVANT le `if (!open) return null` : après, le nombre de hooks
     changerait entre deux rendus et React plante (erreur #310). */
  useEffect(() => {
    if (!open || isLicensed(loadLicense())) return;
    let alive = true;
    void quotaRefresh().then(q => { if (alive) onQuotaChange?.(q); });
    return () => { alive = false; };
  }, [open]);

  /* À la réouverture : si un paiement récent est resté en cours (l'utilisateur
     a pu payer sur Orqex après avoir fermé la fenêtre), reprendre la
     vérification et activer automatiquement si c'est confirmé. */
  useEffect(() => {
    if (!open || !autoPay) return;
    let last: { purchaseId: string; at: number } | null = null;
    try { const r = localStorage.getItem('dd_last_purchase'); if (r) last = JSON.parse(r); } catch { last = null; }
    if (!last || !last.purchaseId) return;
    // L'âge ne doit pas empêcher la lecture : un client qui a payé puis fermé la fenêtre
    // (ou dont le Pulse était cassé) doit être activé à la réouverture, pas devoir relancer
    // un paiement. Seule la reprise du polling reste limitée à une vente récente.
    const pid = last.purchaseId;
    const recent = Date.now() - (last.at || 0) < 20 * 60000;
    fetch(workerBase() + '/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchaseId: pid, deviceId: getMyRefCode() }),
    }).then(r => r.json()).then(data => {
      if (data.ok && data.status === 'paid' && data.code) activateCode(data.code);
      else if (data.ok && data.status === 'paid') {
        // Payé, mais le code est parti sur une autre installation : à traiter à la main.
        setAutoState('error');
        setAutoMsg('Votre paiement est bien confirmé chez le vendeur, mais il a déjà été utilisé sur un autre appareil. Contactez le vendeur avec la référence du paiement : il délivrera un nouveau code.');
      } else if (data.ok && data.status === 'pending' && recent) { setAutoState('waiting'); startPolling(pid); }
      else {
        // Expirée ou abandonnée depuis trop longtemps : on oublie la référence, le client
        // repart sur un paiement normal sans message d'erreur.
        try { localStorage.removeItem('dd_last_purchase'); } catch { /* ignore */ }
      }
    }).catch(() => { /* reseau : on ignore, l'utilisateur peut relancer */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activateCode = async (code: string) => {
    setAutoState('activating');
    const r = await applyCode(code);
    if (r.ok) { try { localStorage.removeItem('dd_last_purchase'); } catch { /* ignore */ } setAutoState('done'); setAutoMsg(r.message); refresh(); }
    else { setAutoState('error'); setAutoMsg(r.message); }
  };

  /* Un relevé de statut, une seule fois. Joué par le timer (5 s), par le retour du client
     sur l'onglet, et par la réouverture de la fenêtre. La réponse du Worker distingue trois
     fins : payé, annulé sur le téléphone, échoué chez l'opérateur — les deux dernières
     arrêtent l'attente au lieu de la laisser tourner un quart d'heure. */
  const checkOnce = async (purchaseId: string, net: { fails: number }) => {
    try {
      const res = await fetch(workerBase() + '/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, deviceId: getMyRefCode() }),
      });
      const data = await res.json().catch(() => null);
      if (!data || typeof data !== 'object') throw new Error('json');
      net.fails = 0;
      setRealStatus(data.realSaleStatus || null);
      setPayStatus(data.paymentStatus || null);
      if (data.status === 'cancelled') {
        stopPolling();
        setActivePurchase(null);
        try { localStorage.removeItem('dd_last_purchase'); } catch { /* ignore */ }
        setAutoState('cancelled');
        setAutoMsg(String(data.message || 'Vous avez annulé le paiement sur votre téléphone.'));
        return;
      }
      if (data.status === 'paid' && data.code) { stopPolling(); setActivePurchase(null); await activateCode(data.code); return; }
      if (!data.ok || data.status === 'expired' || data.status === 'failed') {
        stopPolling();
        setActivePurchase(null);
        setAutoState('error');
        if (data.status === 'failed') {
          setAutoMsg('Selon Chariow, ce paiement n\'a pas abouti (échec ou abandon du Mobile Money). Vérifiez votre solde Mobile Money : si les fonds ont été débités, contactez votre opérateur avec la référence du paiement. Sinon, relancez un nouveau paiement.');
        } else {
          setAutoMsg((data.message || 'Le paiement n\'a pas abouti.') + ' Relancez le paiement.');
        }
      }
    } catch (e) {
      // Le client a payé, il attend : on continue de demander, mais on le dit. Trois échecs
      // réseau d'affilée = l'adresse ne répond plus ; on la marque morte et on re-sonde la
      // liste, sans quoi les 192 tentatives suivantes taperaient toutes dans le vide.
      net.fails += 1;
      if (net.fails === 3 && (e instanceof TypeError || /failed to fetch|networkerror/i.test(String((e as Error | null)?.message || '')))) {
        invalidateWorkerBase();
        void warmWorkerBase(4000);
        setAutoMsg('Impossible de joindre le serveur de paiement pour vérifier votre vente. Gardez cette fenêtre ouverte : la vérification reprend dès que la connexion revient, et votre paiement ne sera pas perdu.');
      }
    }
  };

  const startPolling = (purchaseId: string) => {
    stopPolling();
    pollTries.current = 0;
    setActivePurchase(purchaseId);
    const net = { fails: 0 };
    void checkOnce(purchaseId, net);
    pollRef.current = setInterval(() => {
      pollTries.current += 1;
      if (pollTries.current > 192) {
        stopPolling();
        setActivePurchase(null);
        setAutoState('error');
        setAutoMsg('Le paiement n\'a pas été confirmé après 16 minutes. Relancez le paiement ou contactez ' + VENDOR.PHONE + '.');
        return;
      }
      void checkOnce(purchaseId, net);
    }, 5000);
  };

  /* Le client revient de la page Chariow (il vient d'annuler, ou vient de taper son PIN) :
     le statut est relu immédiatement, pas au prochain tick. */
  useEffect(() => {
    if (!activePurchase) return;
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    const net = { fails: 0 };
    const onVisible = () => { if (!document.hidden) void checkOnce(activePurchase, net); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePurchase]);

  const startAutoPay = async (off: (typeof OFFERS)[number]) => {
    const phoneDigits = customer.phone.replace(/\D/g, '');
    if (!custOk) {
      setTried(true);
      const manquants = [
        missing.name && 'votre nom',
        missing.phone && 'votre numéro Mobile Money (8 chiffres minimum)',
        missing.email && 'votre email',
      ].filter(Boolean).join(', ');
      setAutoState('error');
      setAutoMsg('Il manque ' + manquants + '. Les champs marqués * sont obligatoires : ils servent à encaisser le paiement et à vous renvoyer la facture.');
      if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
        const id = missing.name ? 'dd-pay-name' : missing.phone ? 'dd-pay-phone' : 'dd-pay-email';
        try { (document.getElementById(id) as HTMLInputElement | null)?.focus(); } catch { /* rendu sans DOM */ }
      }
      return;
    }
    setTried(false);
    setAutoState('starting');
    setAutoMsg(null);
    const offerMap: Record<OfferId, string> = { monthly: 'MONTHLY', annual: 'ANNUAL', design: 'DESIGN', all: 'ALL' };
    try {
      const res = await fetch(workerBase() + '/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer: offerMap[off.id],
          deviceId: getMyRefCode(),
          customer: { name: customer.name.trim(), email: customer.email.trim(), phone: phoneDigits },
        }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json().catch(() => null);
      if (!data || typeof data !== 'object') throw new Error('Le serveur a répondu quelque chose de non lisible (pas de JSON).');
      if (!data.ok || (!data.checkout_url && !data.code)) {
        setAutoState('error');
        setAutoMsg(String(data.message || 'Le paiement n’a pas pu être lancé.') + ' Vous pouvez réessayer, ou payer en secours : Mobile Money de ' + fmt(off.price) + ' au ' + VENDOR.PHONE + ', puis code d\u2019activation.');
        return;
      }
      if (data.status === 'paid' && data.code) { await activateCode(data.code); return; }
      try { localStorage.setItem('dd_last_purchase', JSON.stringify({ purchaseId: data.purchaseId, at: Date.now() })); } catch { /* ignore */ }
      // La page Orqex refuse de s'afficher dans un cadre (iframe de prévisualisation) :
      // on donne l'URL au bouton « PAYER MAINTENANT » qui l'ouvre dans la fenêtre
      // du navigateur (target="_top"). Au retour, l'app reprend la vérification.
      setCheckoutUrl(data.checkout_url);
      setAutoState('openCheckout');
      startPolling(data.purchaseId);
    } catch (e) {
      setAutoState('error');
      // Une `fetch` qui échoue produit un `TypeError: Failed to fetch` — du jargon, devant un
      // client qui a déjà son téléphone à la main. On traduit la panne en français, et on en
      // tire la conséquence : cette adresse est morte, on cherche la suivante tout de suite
      // (les clients qui ont téléchargé l'app avant un renommage de sous-domaine payaient
      // une erreur, alors qu'une adresse de secours répondait à côté).
      const down = e instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(String((e as Error | null)?.message || ''));
      if (down) { invalidateWorkerBase(); void warmWorkerBase(4000); }
      setAutoMsg(explainWorkerFailure(e)
        + (down ? ' Réessayez : l’application vient de chercher une autre adresse du serveur de paiement.' : '')
        + ' Le paiement reste possible, en secours : paiement Mobile Money de ' + fmt(off.price) + ' au ' + VENDOR.PHONE + ', puis code d\u2019activation.');
    }
  };

  // Le marqueur des offres : identique pour les trois, jamais un « désactivé » muet —
  // cliquer reste le moyen le plus sûr de savoir quoi remplir.
  const payMark = autoPay && tried && !custOk;

  if (!open) return null;

  const refresh = () => { setLicense(loadLicense()); onActivated?.(); };
  // Le compteur affiché est le plus sévère des deux : local ou serveur.
  const used = quota ? Math.max(getExportCount(), quota.used) : getExportCount();
  const handlePay = async (off: (typeof OFFERS)[number]) => {
    if (autoPay) { await startAutoPay(off); return; }
    setPaying(off.id);
    try {
      const url = off.link || (await createChariowPayment(off.price, off.title));
      if (url) {
        window.open(url, '_blank');
        setCodeMsg({ ok: true, text: 'Paiement lancé sur Chariow. Après confirmation, entrez le code d\'activation reçu ci-dessous.' });
      } else {
        setCodeMsg({ ok: true, text: `Payez ${fmt(off.price)} via Mobile Money (MTN MoMo / Orange Money / Wave / Moov) au ${VENDOR.PHONE}. Envoyez la référence du paiement par WhatsApp, vous recevrez votre code d'activation.` });
      }
    } finally {
      setPaying(null);
    }
  };

  const handleApplyCode = async () => {
    const r = await applyCode(code);
    setCodeMsg({ ok: r.ok, text: r.message });
    if (r.ok) { refresh(); setCode(''); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* En-tête */}
        <div className="p-6 pb-4 border-b border-[#F0F0F0] dark:border-zinc-800 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-black text-[#111] dark:text-white">
              {blocked ? 'Limite d\'exports gratuits atteinte ' : 'Devis Designer Pro'}
            </h2>
            <p className="text-sm text-[#888] mt-1">
              {isLicensed(license)
                ? ` Abonnement actif — reste ${daysLeft(license)} jour(s)`
                : `${Math.min(used, FREE_EXPORT_LIMIT)} / ${FREE_EXPORT_LIMIT} exports gratuits utilisés${quota && quota.used > getExportCount() ? ` (compteur serveur : ${Math.min(quota.used, quota.limit)} / ${quota.limit} sur ${quota.windowDays} j)` : ''}${blocked ? ' — passez à Pro pour continuer' : ''}`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#F0F0F0] dark:hover:bg-zinc-800 flex items-center justify-center text-[#999]"></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Compteur serveur + demande de déblocage (mode dur) */}
          {blocked && quota && (
            <QuotaUnlockCard quota={quota} onChanged={onQuotaChange} />
          )}
          {/* Paiement automatique : coordonnées du client (requis par Chariow) */}
          {autoPay && autoState !== 'done' && (
            <div className="rounded-xl border border-dashed p-4" style={{ borderColor: '#0057FF66' }}>
              <div className="text-xs font-black tracking-widest text-[#111] dark:text-white mb-1">PAIEMENT AUTOMATIQUE</div>
              <p className="text-[11px] text-[#888] mb-3">
                Payez par Mobile Money : votre offre sera activée <b>automatiquement</b>, sans code à saisir.
                <span className={`block mt-1 ${payMark ? 'text-red-500 font-bold' : ''}`}>Les trois champs marqués <b className="text-red-500">*</b> sont obligatoires — la caisse en ligne ne peut pas vous identifier sans eux.</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  ['name', 'dd-pay-name', 'Votre nom complet', 'text', 'Nom *'],
                  ['phone', 'dd-pay-phone', 'N° Mobile Money (01...)', 'tel', 'N° Mobile Money *'],
                  ['email', 'dd-pay-email', 'Votre email', 'email', 'Email *'],
                ] as const).map(([key, id, ph, mode, lab]) => (
                  <label key={key} className="block">
                    <span className={`block text-[10px] font-black tracking-widest mb-1 ${tried && missing[key] ? 'text-red-500' : 'text-[#999]'}`}>
                      {lab.slice(0, -2)}<b className="text-red-500"> *</b>
                    </span>
                    <input id={id} value={customer[key]} onChange={e => setCustomer(c => ({ ...c, [key]: e.target.value }))}
                      placeholder={ph} inputMode={mode === 'text' ? 'text' : mode}
                      required aria-required="true" aria-invalid={tried && missing[key] ? true : undefined}
                      className={fieldCls(tried && missing[key])} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Offres */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OFFERS.map(o => (
              <div key={o.id} className={`relative rounded-xl border-2 p-4 flex flex-col ${o.badge ? 'border-[#0057FF] dark:border-blue-500' : 'border-[#ECECEC] dark:border-zinc-700'}`}>
                {o.badge && <span className="absolute -top-2.5 left-3 text-[9px] font-black px-2 py-0.5 rounded-full bg-[#0057FF] text-white tracking-wider uppercase">{o.badge}</span>}
                <div className="text-[11px] font-bold tracking-widest text-[#999] uppercase">{o.title}</div>
                <div className="text-2xl font-black mt-1" style={{ color: '#0057FF' }}>{fmt(o.price)}</div>
                <div className="text-[11px] text-[#777] dark:text-zinc-400 mt-1 flex-1">{o.desc}</div>
                <button
                  onClick={() => handlePay(o)}
                  disabled={paying === o.id || autoState === 'starting' || autoState === 'openCheckout' || autoState === 'waiting' || autoState === 'activating'}
                  className="mt-3 w-full h-9 rounded-lg bg-[#0057FF] text-white text-xs font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                >
                  {paying === o.id || autoState === 'starting' || autoState === 'openCheckout' || autoState === 'waiting' || autoState === 'activating'
                    ? '...'
                    : autoPay ? `Payer ${fmt(o.price)} — activation auto` : 'Payer via Chariow (Mobile Money)'}
                </button>
              </div>
            ))}
          </div>

          {/* Statuts du paiement automatique */}
          {autoPay && autoState === 'openCheckout' && checkoutUrl && (
            <div className="rounded-xl border-2 p-4 text-center" style={{ borderColor: 'rgba(0,87,255,0.4)' }}>
              <div className="text-xs font-black tracking-widest text-[#111] dark:text-white mb-2">ÉTAPE SUIVANTE — PAIEMENT</div>
              <p className="text-[11px] text-[#888] mb-3">
                Cliquez sur le bouton ci-dessous : la page de paiement Orqex s'ouvre dans votre navigateur.
                Terminez le paiement Mobile Money (code PIN sur le téléphone), puis revenez ici avec le
                bouton retour du navigateur — l'offre sera activée automatiquement.
              </p>
              <a href={checkoutUrl} target="_top" rel="noreferrer"
                className="block w-full py-3.5 rounded-xl bg-[#0057FF] text-white text-sm font-black hover:opacity-90">
                PAYER MAINTENANT
              </a>
              <div className="mt-2 text-[9px] text-[#AAA] break-all select-all">{checkoutUrl}</div>
            </div>
          )}
          {autoPay && (autoState === 'starting' || autoState === 'waiting') && (
            <div className="rounded-xl bg-[#F8F8FF] dark:bg-zinc-800/50 border border-[#E8E8FF] dark:border-zinc-700 p-4 text-center">
              <div className="text-xs font-black tracking-widest text-[#111] dark:text-white mb-1">
                {autoState === 'starting' ? 'LANCEMENT DU PAIEMENT…' : 'EN ATTENTE DE CONFIRMATION DU PAIEMENT'}
              </div>
              <p className="text-[11px] text-[#888]">
                {autoState === 'starting'
                  ? 'Ouverture de la page de paiement Chariow…'
                  : 'Terminez le paiement Mobile Money. La confirmation Chariow arrive 1 à 5 minutes après le code sur le téléphone. Vous pouvez fermer cette fenêtre : en rouvrant PRO, la confirmation sera reprise et l\'offre activée automatiquement.'}
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-[#E8E8FF] dark:bg-zinc-700 overflow-hidden"><div className="h-full w-1/3 rounded-full bg-[#0057FF] animate-pulse" /></div>
              {payStatus && payStatus !== 'success' && (
                <div className="text-[10px] text-[#999] mt-2">
                  Paiement sur votre téléphone : <b className="text-[#111] dark:text-white">{payStatus === 'pending' || payStatus === 'initiated' ? 'en cours de validation chez votre opérateur' : payStatus}</b>
                </div>
              )}
              <button onClick={() => { stopPolling(); setActivePurchase(null); try { localStorage.removeItem('dd_last_purchase'); } catch { /* ignore */ } setAutoState('cancelled'); setAutoMsg('Vous avez indiqué avoir annulé le paiement. Rien n\'a été débité : vous pouvez en relancer un autre quand vous voulez.'); }}
                className="mt-3 text-[10px] font-black tracking-widest text-[#888] underline hover:text-[#111] dark:hover:text-white">
                J\u2019AI ANNULÉ LE PAIEMENT
              </button>
              {realStatus && (
                <div className="text-[10px] text-[#999] mt-2">
                  Statut Chariow : <b className={realStatus === 'completed' || realStatus === 'settled' ? 'text-green-600 dark:text-green-400' : 'text-[#111] dark:text-white'}>{realStatus === 'awaiting_payment' ? 'en attente de paiement (normal, patientez)' : realStatus === 'completed' || realStatus === 'settled' ? 'PAIEMENT REÇU — activation…' : realStatus}</b>
                </div>
              )}
            </div>
          )}
          {autoPay && autoState === 'activating' && (
            <div className="rounded-xl bg-[#F8F8FF] dark:bg-zinc-800/50 border border-[#E8E8FF] dark:border-zinc-700 p-4 text-center">
              <div className="text-xs font-black tracking-widest text-[#111] dark:text-white">ACTIVATION DE VOTRE OFFRE…</div>
              <p className="text-[11px] text-[#888] mt-1">Paiement confirmé — une seconde.</p>
            </div>
          )}
          {autoPay && autoState === 'done' && (
            <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4 text-center">
              <div className="text-xs font-black tracking-widest text-green-700 dark:text-green-400 mb-1">PAIEMENT CONFIRMÉ — OFFRE ACTIVÉE</div>
              <p className="text-[11px] text-[#666] dark:text-zinc-300">{autoMsg}</p>
            </div>
          )}
          {autoPay && autoState === 'cancelled' && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
              <div className="text-xs font-black tracking-widest text-amber-700 dark:text-amber-400 mb-1">PAIEMENT ANNULÉ</div>
              <p className="text-[11px] text-[#666] dark:text-zinc-300 mb-3">{autoMsg}</p>
              <button onClick={() => { setAutoState('idle'); setAutoMsg(null); setRealStatus(null); setPayStatus(null); setCheckoutUrl(null); }}
                className="w-full py-2.5 rounded-xl border-2 border-[#0057FF] text-[#0057FF] text-xs font-black tracking-widest hover:bg-[#0057FF] hover:text-white">
                RECOMMENCER LE PAIEMENT
              </button>
            </div>
          )}
          {autoPay && autoState === 'error' && autoMsg && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-[11px] text-red-600 dark:text-red-400">{autoMsg}</div>
          )}

          {/* Saisie de code d'activation */}
          <div className="rounded-xl bg-[#F8F8FF] dark:bg-zinc-800/50 border border-[#E8E8FF] dark:border-zinc-700 p-4">
            <div className="text-xs font-black tracking-widest text-[#111] dark:text-white mb-1">Déjà abonné ?</div>
            <div className="text-[11px] text-[#888] mb-3">Entrez le code d'activation reçu par WhatsApp / SMS après votre paiement.</div>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="DD-XXXX-XXXX-XXXX"
                className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-[#E0E0E0] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white font-mono tracking-wider focus:outline-none focus:border-[#0057FF]"
              />
              <button onClick={handleApplyCode} className="px-5 rounded-lg bg-[#111] dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90">Activer</button>
            </div>
            {codeMsg && (
              <div className={`mt-2 text-[11px] font-medium ${codeMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{codeMsg.text}</div>
            )}

          </div>

          {/* Design personnalisé : on importe le fichier reçu du vendeur (puis on le contacte) */}
          {license.customDesign && <CustomDesignCard onChanged={() => { refresh(); onActivated?.(); }} />}
          {license.customDesign && !contactDesign && (
            <button onClick={() => setContactDesign(true)} className="w-full rounded-xl border-2 border-dashed border-[#0057FF]/40 p-3 text-xs font-bold text-[#0057FF] hover:bg-blue-50 dark:hover:bg-blue-950/30">
              Design personnalisé débloqué — contacter le designer
            </button>
          )}
          {contactDesign && (
            <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4">
              <div className="text-xs font-black text-green-700 dark:text-green-400 mb-2">Votre design personnalisé</div>
              <p className="text-[11px] text-[#666] dark:text-zinc-300 mb-3">Décrivez votre design (couleurs, logo, mise en page…) et envoyez-le au designer :</p>
              <a href={VENDOR.WHATSAPP} target="_blank" rel="noreferrer" className="block w-full text-center py-2.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:opacity-90 mb-2">WhatsApp — décrire mon design</a>
              <div className="text-center text-[11px] text-[#888]">ou appelez : <b>{VENDOR.PHONE}</b></div>
            </div>
          )}

          {/* PARRAINAGE — seule récompense gratuite de l'app (1 mois offert au parrain) */}
          <ReferralCard />

        </div>
      </div>
    </div>
  );
}

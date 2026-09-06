import { useState } from 'react';
import {
  getParrainCode, getMyRewardCode, isRewardReminderDismissed, dismissRewardReminder,
  rewardWhatsAppUrl, markMyRewardSent,
} from '../lib/referral';
import { REF_REWARD_MONTHS } from '../lib/license';

interface Props {
  /** Change à chaque export réussi : force la relecture de l'état de parrainage. */
  tick?: number;
  onOpenPaywall?: () => void;
}

/**
 * Carte flottante — côté FILLEUL uniquement.
 *
 * Le parrainage de cette installation vient d'être validé (le filleul a
 * exporté au moins un document) : « 1 parrainage = 1 mois gratuit pour le
 * parrain ». Le code remerciement est prêt, il ne reste qu'à l'envoyer.
 * Aucune récompense n'est prévue pour le filleul.
 */
export default function ReferralToast({ tick = 0, onOpenPaywall }: Props) {
  const [hidden, setHidden] = useState(() => isRewardReminderDismissed());
  const [copied, setCopied] = useState(false);

  // relecture à chaque tick (Après un export, le code vient d'être généré)
  void tick;
  const parrain = getParrainCode();
  const reward = getMyRewardCode();
  if (hidden || isRewardReminderDismissed() || !parrain || !reward) return null;

  const close = () => { dismissRewardReminder(); setHidden(true); };

  return (
    <div className="fixed bottom-4 right-4 z-[94] w-[min(92vw,360px)]">
      <div className="rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 border-l-4" style={{ borderLeftColor: '#10B981' }}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400">
              PARRAINAGE VALIDÉ
            </div>
            <button onClick={close} className="w-6 h-6 -mt-1 -mr-1 rounded-full text-[#AAA] hover:bg-[#F0F0F0] dark:hover:bg-zinc-800 flex items-center justify-center text-sm">
              ×
            </button>
          </div>

          <div className="text-sm font-black text-[#111] dark:text-white mt-1">
            Votre parrain reçoit {REF_REWARD_MONTHS} mois gratuit{REF_REWARD_MONTHS > 1 ? 's' : ''}
          </div>
          <p className="text-[11px] text-[#777] dark:text-zinc-400 mt-1 leading-relaxed">
            Vous l'avez parrainé avec le code <b className="font-mono">{parrain}</b> et votre premier
            document est exporté. Envoyez-lui son code de remerciement :
          </p>

          <div className="mt-2 rounded-xl bg-[#F0FDF4] dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-2.5">
            <div className="font-mono font-black text-[11px] tracking-wider text-emerald-800 dark:text-emerald-300 break-all leading-relaxed select-all">
              {reward}
            </div>
            <div className="text-[9px] text-[#999] mt-1">
              À coller par votre parrain dans « PRO » → « Déjà abonné ? ». Activable 30 jours.
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <a
              href={rewardWhatsAppUrl(reward)}
              target="_blank"
              rel="noreferrer"
              onClick={() => { markMyRewardSent(); close(); }}
              className="flex-1 text-center py-2.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:opacity-90"
            >
              Envoyer à mon parrain
            </a>
            <button
              onClick={() => { navigator.clipboard?.writeText(reward).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="px-3 py-2.5 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 text-[11px] font-bold text-[#666] dark:text-zinc-300 hover:bg-[#F5F5F5] dark:hover:bg-zinc-800"
            >
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>

          {onOpenPaywall && (
            <button onClick={() => { close(); onOpenPaywall(); }} className="mt-2 w-full text-[10px] font-bold text-[#999] hover:text-[#0057FF]">
              Ouvrir l'espace offres &amp; parrainage
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  getMyRefCode, whatsappShareUrl, getParrainCode, saveParrainCode, isReferred,
  getMyRewardCode, rewardWhatsAppUrl, markMyRewardSent, parrainStatusLabel,
  hasMinimumExport, settleReferralReward, controlLabel, getRewardSource,
  isParrainCapped, isWorkerReferralEnabled,
} from '../lib/referral';
import { REF_REWARD_MONTHS, REF_MAX_MONTHS_PER_YEAR } from '../lib/license';

/**
 * Encart PARRAINAGE — la seule récompense gratuite de l'application.
 * Politique : « 1 parrainage valide = 1 mois gratuit pour LE PARRAIN ».
 *  - côté parrain : son code à partager + suivi des mois reçus (plafond annuel)
 *  - côté filleul : saisie du code reçu, puis envoi du code remerciement
 * Aucun concours, aucun autre bonus de mois gratuits n'existe dans l'app.
 */
export default function ReferralCard() {
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sent, setSent] = useState(false);
  /** simple tick de re-rendu après (re)vérification du parrainage */
  const [, forceRender] = useState(0);
  const recheck = () => settleReferralReward().finally(() => forceRender(n => n + 1));

  /** Le parrainage est validé dès qu'un document a été exporté : on prépare le code remerciement. */
  useEffect(() => { recheck(); }, []);

  const parrain = getParrainCode();
  const reward = getMyRewardCode();
  const referred = isReferred();

  const applyParrain = () => {
    if (saveParrainCode(input)) {
      setMsg({ ok: true, text: 'Code parrain enregistré. Votre 1er document exporté récompensera votre parrain (1 mois offert pour lui).' });
      setInput('');
      recheck();
    } else {
      setMsg({ ok: false, text: 'Code invalide — il ressemble à DDREF-ABCD1234.' });
    }
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-[#0057FF]/30 p-4">
      <div className="text-xs font-black tracking-widest text-[#111] dark:text-white mb-1">
        PARRAINAGE — {REF_REWARD_MONTHS} MOIS OFFERT{REF_REWARD_MONTHS > 1 ? 'S' : ''} PAR PARRAINAGE
      </div>
      <p className="text-[11px] text-[#888] mb-3">
        Chaque ami qui ouvre l'app avec <b>votre lien</b> (ou saisit votre code) et exporte au moins un document vous
        offre <b className="text-emerald-600 dark:text-emerald-400">{REF_REWARD_MONTHS} mois gratuit{REF_REWARD_MONTHS > 1 ? 's' : ''}</b>
        {' '}(max. {REF_MAX_MONTHS_PER_YEAR} mois offerts par an). Le mois offert va au parrain : c'est la seule récompense de l'application.
      </p>

      {/* Votre code parrain */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 font-mono font-black tracking-widest text-[#0057FF] bg-blue-50 dark:bg-blue-950/40 rounded-lg py-2 text-center break-all">
          {getMyRefCode()}
        </div>
        <button
          onClick={() => { navigator.clipboard?.writeText(getMyRefCode()).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="px-3 py-2 rounded-lg border border-[#BFDBFE] text-[11px] font-bold text-[#0057FF] hover:bg-blue-50 dark:hover:bg-blue-950/40 whitespace-nowrap"
        >
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
      <a href={whatsappShareUrl()} target="_blank" rel="noreferrer" className="block w-full text-center py-2.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:opacity-90">
        Parrainer un ami sur WhatsApp
      </a>

      {/* Suivi des mois reçus + origine du contrôle */}
      <div className="mt-2 text-[10px] text-[#888] dark:text-zinc-400">{parrainStatusLabel()}</div>
      <div className="mt-1 flex items-center gap-1.5 text-[9px] text-[#999]">
        <span className={`w-1.5 h-1.5 rounded-full ${isWorkerReferralEnabled() ? 'bg-emerald-500' : 'bg-[#CCC] dark:bg-zinc-600'}`} />
        {controlLabel()}
      </div>

      {/* Côté filleul */}
      {referred ? (
        <div className="mt-3 rounded-lg bg-[#F8F8FF] dark:bg-zinc-800/60 border border-[#E8E8FF] dark:border-zinc-700 p-3">
          <div className="text-[10px] font-bold tracking-widest text-[#666] dark:text-zinc-400 mb-1">VOUS ÊTES PARRAINÉ PAR</div>
          <div className="font-mono text-xs font-black text-[#111] dark:text-white break-all">{parrain}</div>
          {reward ? (
            sent ? (
              <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                Merci ! Votre parrain a reçu son code de remerciement.
              </div>
            ) : (
              <>
                <div className="text-[11px] text-[#666] dark:text-zinc-400 mt-2">
                  Parrainage validé : transmettez-lui son code de remerciement
                  (<b>{REF_REWARD_MONTHS} mois offert</b>, activable sous 30 jours).
                  <span className="block mt-1 text-[9px] text-[#999]">
                    {getRewardSource() === 'server'
                      ? 'Code émis et plafonné par le serveur : un seul exemplaire au monde pour ce parrainage.'
                      : 'Code émis hors-ligne (serveur non joint).'}
                  </span>
                </div>
                <a
                  href={rewardWhatsAppUrl(reward)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => { markMyRewardSent(); setSent(true); }}
                  className="block w-full text-center mt-2 py-2 rounded-lg bg-[#25D366] text-white text-[11px] font-bold hover:opacity-90"
                >
                  Envoyer le code à mon parrain
                </a>
              </>
            )
          ) : (
            <>
              {isParrainCapped() && (
                <div className="mb-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                  Votre parrain a déjà reçu {REF_MAX_MONTHS_PER_YEAR} mois offerts sur 12 mois : aucun nouveau mois
                  ne peut être émis pour lui. Vous pouvez tout de même lui envoyer le lien de l'app.
                </div>
              )}
              <div className="text-[11px] text-[#888] mt-1">
                {hasMinimumExport()
                  ? 'Votre 1er document est exporté : le code de remerciement vient d\'être préparé.'
                  : 'Exportez votre premier document (PDF ou envoi signature) : votre parrain recevra alors son mois offert.'}
              </div>
              <button onClick={recheck} className="mt-2 w-full py-1.5 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 text-[10px] font-bold text-[#666] dark:text-zinc-300 hover:bg-[#F5F5F5] dark:hover:bg-zinc-800">
                Vérifier mon parrainage
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <div className="text-[10px] font-bold tracking-widest text-[#666] dark:text-zinc-400 mb-1">UN AMI VOUS A PARRAINÉ ?</div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              placeholder="DDREF-XXXXXXXX"
              className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border border-[#E0E0E0] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white font-mono tracking-wider focus:outline-none focus:border-[#0057FF]"
            />
            <button onClick={applyParrain} className="px-3 py-2 rounded-lg bg-[#111] dark:bg-white text-white dark:text-black text-[11px] font-bold hover:opacity-90 whitespace-nowrap">
              Enregistrer
            </button>
          </div>
          {msg && (
            <div className={`mt-2 text-[10px] font-medium ${msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{msg.text}</div>
          )}
        </div>
      )}
    </div>
  );
}

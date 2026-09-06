// ============================================================
// Carte « Quota serveur » : explique le compteur d'exports côté serveur et
// permet au client de DEMANDER un déblocage (le vendeur valide en 1 clic
// dans l'espace vendeur #/vendeur). Affichée dans le paywall quand l'export
// est bloqué et que le Worker gère le quota (mode dur).
// ============================================================
import { useEffect, useState } from 'react';
import {
  requestQuotaUnlock, quotaRefresh, type QuotaState,
} from '../lib/quota';
import { VENDOR } from '../lib/config';

interface Props {
  quota: QuotaState | null;
  /** Remonte le dernier état connu du serveur (déblocage accordé, fenêtre...). */
  onChanged?: (q: QuotaState | null) => void;
}

export default function QuotaUnlockCard({ quota, onChanged }: Props) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const unlocked = !!quota?.unlocked;
  const remaining = quota ? Math.max(0, quota.limit - quota.used) : 0;

  // En fermant la fenêtre, on rafraîchit : si le vendeur a débloqué entre-temps,
  // le client voit tout de suite qu'il peut réessayer.
  useEffect(() => () => { void quotaRefresh().then(q => onChanged?.(q)); }, []);

  const ask = async () => {
    setBusy(true); setMsg(null);
    const r = await requestQuotaUnlock(note.trim());
    setBusy(false);
    if (r.ok && r.duplicate) setMsg('Votre demande est déjà en attente : le vendeur la voit dans son espace, comptez quelques heures.');
    else if (r.ok) setMsg(r.message + ' Fermez cette fenêtre : le déblocage sera appliqué automatiquement, sans rien réinstaller.');
    else setMsg('Envoi impossible. ' + r.message + ' Vous pouvez aussi écrire directement au vendeur : ' + VENDOR.PHONE + ' / ' + VENDOR.EMAIL);
  };

  const check = async () => {
    setBusy(true);
    const q = await quotaRefresh();
    setBusy(false); onChanged?.(q);
    setMsg(q?.unlocked ? 'Déblocage accordé : vous pouvez exporter à nouveau.'
      : q && q.remaining > 0 ? `Il vous reste ${q.remaining} export(s) sur ${q.limit} dans cette période de ${q.windowDays} jours.`
      : 'Pas encore de déblocage : le vendeur doit valider dans son espace (bouton rouge « déblocages »).');
  };

  return (
    <div className="rounded-xl border border-[#E5E5E5] dark:border-zinc-800 p-4 bg-[#FAFAFA] dark:bg-zinc-900/60">
      <div className="text-[10px] font-bold tracking-wide uppercase mb-2" style={{ color: '#888' }}>
        Compteur d'exports (serveur)
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-bold text-[#111] dark:text-white">
          {quota ? `${quota.used} / ${quota.limit} exports — période glissante de ${quota.windowDays} jours` : 'Vérification du compteur…'}
        </div>
        <button onClick={() => void check()} disabled={busy}
          className="text-[11px] font-bold px-2 py-1 border border-[#E0E0E0] dark:border-zinc-700 rounded-lg hover:border-[#111] disabled:opacity-50">
          Actualiser
        </button>
      </div>
      {quota ? (
        <div className="text-[11.5px] text-[#666] mt-1.5 leading-snug">
          {unlocked ? (
            <span className="font-bold text-green-600">
              Déblocage temporaire accordé par le vendeur — vous pouvez encore exporter {remaining} fois pendant {quota.unlockDays || 30} jour(s).
            </span>
          ) : (
            <>
              Ce compteur est tenu par le serveur de l'application : changer de navigateur, ouvrir une
              fenêtre privée ou effacer les données ne le remet pas à zéro.
              {quota.resetInDays > 0 && remaining === 0 ? ` Nouvelle période dans ${quota.resetInDays} jour(s).` : ''}
            </>
          )}
        </div>
      ) : null}

      {!unlocked && (
        <div className="mt-3 pt-3 border-t border-[#EEE] dark:border-zinc-800">
          <div className="text-[12px] font-bold text-[#111] dark:text-white">Vous êtes un nouveau client ?</div>
          <div className="text-[11.5px] text-[#666] mb-2 leading-snug">
            Envoyez une demande de déblocage au vendeur (par exemple : vous installez l'app sur un
            nouvel appareil, ou vos 20 exports gratuits datent d'une période d'essai). Il valide en un clic.
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Une phrase pour le vendeur : votre nom, votre ville, ce que vous voulez débloquer…"
            className="w-full px-3 py-2 text-[12.5px] border border-[#E0E0E0] dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-[#111] dark:text-white outline-none focus:border-[#0057FF] resize-none" />
          <div className="flex items-center gap-2 mt-2">
            <button onClick={() => void ask()} disabled={busy}
              className="flex-1 text-[12px] font-bold px-3 py-2 rounded-lg text-white transition-opacity disabled:opacity-50"
              style={{ background: '#0057FF' }}>
              {busy ? 'Envoi…' : 'Demander un déblocage'}
            </button>
            <a href={`https://wa.me/${VENDOR.PHONE.replace(/\D/g, '')}`}
              target="_blank" rel="noopener"
              className="text-[11.5px] font-bold text-[#0057FF] whitespace-nowrap">
              Écrire au vendeur
            </a>
          </div>
          {msg && (
            <div className="text-[11.5px] mt-2 leading-snug" style={{ color: unlocked ? '#16A34A' : '#666' }}>{msg}</div>
          )}
        </div>
      )}
    </div>
  );
}

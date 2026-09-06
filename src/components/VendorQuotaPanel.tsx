// ============================================================
// Panneau vendeur — QUOTA D'EXPORTS & DÉBLOCAGES
// File d'attente des demandes de déblocage envoyées par les clients dont le
// compteur serveur (20 exports / 30 jours glissants) est épuisé, et boutons
// pour accorder ou retirer un déblocage temporaire. 1 clic, sans taper de code.
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import {
  fetchQuotaRequests, grantQuotaUnlock, revokeQuotaUnlock, type QuotaRequest,
} from '../lib/quota';
import { hasWorkerAdminKey } from '../lib/adminKey';

function ago(atMs?: number): string {
  if (!atMs) return '—';
  const min = Math.max(0, Math.round((Date.now() - atMs) / 60000));
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

export default function VendorQuotaPanel() {
  const [rows, setRows] = useState<QuotaRequest[]>([]);
  const [blocked, setBlocked] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [manualFp, setManualFp] = useState('');
  const [manualDays, setManualDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchQuotaRequests();
    setLoading(false);
    if (!r.ok) { setNote(r.message || 'Worker injoignable.'); return; }
    setRows(r.requests || []);
    setBlocked(r.blocked || 0);
    setTruncated(r.truncated === true);
    setNote(null);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (fp: string, kind: 'grant' | 'revoke', days = 30) => {
    setBusy(fp + kind + (kind === 'grant' ? days : '')); setNote(null);
    const r = kind === 'grant'
      ? await grantQuotaUnlock(fp, days)
      : await revokeQuotaUnlock(fp);
    setBusy(null);
    setNote(r.message);
    if (r.ok) void load();
  };

  return (
    <section className="rounded-2xl bg-white dark:bg-zinc-900 border border-[#ECECEC] dark:border-zinc-800 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-xs font-black tracking-widest text-[#111] dark:text-white">
          QUOTA D'EXPORTS &amp; DÉBLOCAGES
          {blocked > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black text-white" style={{ background: '#FF3B30' }}>
              {blocked}
            </span>
          )}
        </div>
        <button onClick={() => void load()} disabled={loading}
          className="px-2 py-1 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 text-[10px] font-bold text-[#666] dark:text-zinc-300 hover:bg-[#F5F5F5] dark:hover:bg-zinc-800 disabled:opacity-50">
          {loading ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      {!hasWorkerAdminKey() && (
        <div className="text-[11.5px] font-bold mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
          Saisissez d'abord la valeur de <code>ADMIN_PASS</code> dans le bandeau « Clé serveur » en haut de page :
          sans elle, le Worker refuse de lire la file d'attente.
        </div>
      )}
      <div className="text-[11px] text-[#888] leading-snug mb-3">
        Le Worker compte <b>20 exports par empreinte d'appareil sur 30 jours glissants</b> (fenêtre privée,
        changement de navigateur ou effacement des données ne remettent pas le compteur à zéro).
        Réglages côté Worker : <code>QUOTA_LIMIT</code>, <code>QUOTA_WINDOW_DAYS</code>.
      </div>

      {note && (
        <div className="text-[11.5px] font-bold mb-3 px-3 py-2 rounded-lg bg-[#F5F5F5] dark:bg-zinc-800 text-[#111] dark:text-white">{note}</div>
      )}

      {rows.length === 0 ? (
        <div className="text-[11.5px] text-[#999]">Aucune demande de déblocage en attente.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.fp + i} className="rounded-xl border border-[#EFEFEF] dark:border-zinc-800 p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[11px] font-black text-[#111] dark:text-white font-mono">{r.fp.slice(0, 12)}</span>
                <span className="text-[10.5px] text-[#888]">{ago(r.atMs)}</span>
                {r.deviceId && <span className="text-[10.5px] font-bold text-[#0057FF]">install. {r.deviceId}</span>}
                {r.country && <span className="text-[10.5px] text-[#888]">{r.country}{r.ip ? ` · ${r.ip}` : ''}</span>}
                <span className={`ml-auto text-[10.5px] font-black ${r.unlocked ? 'text-emerald-600' : r.remaining === 0 ? 'text-red-600' : 'text-[#888]'}`}>
                  {r.used ?? 0}/{r.limit ?? 20} {r.unlocked ? '· DÉBLOQUÉ' : r.remaining === 0 ? '· BLOQUÉ' : ''}
                </span>
              </div>
              {r.note && <div className="text-[12px] text-[#333] dark:text-zinc-300 mt-1.5">« {r.note} »</div>}
              {r.ua && <div className="text-[10px] text-[#AAA] mt-1 truncate">{r.ua}</div>}
              <div className="flex flex-wrap gap-2 mt-2">
                {[30, 7, 1].map(d => (
                  <button key={d} onClick={() => void act(r.fp, 'grant', d)} disabled={busy === r.fp + 'grant' + d}
                    className="text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                    Débloquer {d} j
                  </button>
                ))}
                {r.unlocked && (
                  <button onClick={() => void act(r.fp, 'revoke')} disabled={busy === r.fp + 'revoke'}
                    className="text-[10.5px] font-bold px-2.5 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Retirer
                  </button>
                )}
              </div>
            </div>
          ))}
          {truncated && <div className="text-[10.5px] text-[#AAA]">Liste tronquée (les 60 demandes les plus récentes).</div>}
        </div>
      )}

      {/* Déblocage manuel, si le client vous a juste transmis son empreinte */}
      <div className="mt-4 pt-3 border-t border-[#F0F0F0] dark:border-zinc-800">
        <div className="text-[10px] font-black tracking-widest uppercase text-[#999] mb-2">Débloquer une empreinte manuellement</div>
        <div className="flex flex-wrap gap-2 items-center">
          <input value={manualFp} onChange={e => setManualFp(e.target.value)} placeholder="empreinte (16 caractères, donnée par le client)"
            className="flex-1 min-w-[200px] px-2.5 py-1.5 text-[11.5px] font-mono border border-[#E0E0E0] dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-[#111] dark:text-white outline-none focus:border-[#0057FF]" />
          <select value={manualDays} onChange={e => setManualDays(Number(e.target.value))}
            className="px-2 py-1.5 text-[11.5px] border border-[#E0E0E0] dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-[#111] dark:text-white">
            <option value={1}>1 jour</option><option value={7}>7 jours</option><option value={30}>30 jours</option><option value={365}>1 an</option>
          </select>
          <button onClick={() => { const fp = manualFp.trim().toUpperCase(); if (!fp) { setNote('Renseignez d’abord l’empreinte.'); return; } void act(fp, 'grant', manualDays).then(() => setManualFp('')); }}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#111] text-white hover:bg-black">
            Débloquer
          </button>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Bandeau « Clé serveur » de l'espace vendeur.
// Saisie UNIQUE de la valeur de la variable Cloudflare `ADMIN_PASS` : elle est
// nécessaire aux appels sensibles (/referral/stats, /quota/pending|grant|revoke)
// et n'est JAMAIS embarquée dans le bundle de l'app. Elle reste dans le
// stockage local de VOTRE appareil. Bouton « Tester » = contrôle de déploiement.
// ============================================================
import { useState } from 'react';
import { testWorkerAdminKey, workerAdminKey, setWorkerAdminKey } from '../lib/adminKey';

interface Props {
  /** À appeler après un test réussi pour recharger les panneaux qui en dépendent. */
  onReady?: () => void;
}

export default function WorkerKeyBar({ onReady }: Props) {
  const saved = workerAdminKey();
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const run = async (key: string) => {
    setBusy(true); setMsg(null);
    const r = await testWorkerAdminKey(key);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) onReady?.();
    return r.ok;
  };

  const save = async () => {
    const k = value.trim();
    if (!k) { setMsg({ ok: false, text: 'Rien à enregistrer : tapez la clé.' }); return; }
    setWorkerAdminKey(k); setValue('');
    if (await run(k)) setMsg({ ok: true, text: 'Enregistrée sur cet appareil et acceptée par le serveur ✓' });
  };

  return (
    <section className="rounded-2xl bg-white dark:bg-zinc-900 border border-[#ECECEC] dark:border-zinc-800 p-4 sm:p-5">
      <div className="text-xs font-black tracking-widest text-[#111] dark:text-white mb-1">CLÉ SERVEUR (WORKER)</div>
      <div className="text-[11.5px] text-[#888] leading-snug mb-3">
        C'est la variable <code>ADMIN_PASS</code> de votre Worker — <b>pas</b> le code de la page, qui reste{' '}
        <code>2468</code>. Elle sert à lire les stats de parrainage et la file des déblocages.
        {saved
          ? <span className="font-bold text-emerald-600"> · enregistrée sur cet appareil ({'*'.repeat(Math.min(12, saved.length))})</span>
          : ' · aucune clé enregistrée sur cet appareil pour l\'instant.'}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void save(); }}
          placeholder={saved ? 'Remplacer la clé enregistrée…' : 'Collez la valeur de ADMIN_PASS…'}
          className="flex-1 min-w-[220px] px-3 py-2 text-[12.5px] font-mono border border-[#E0E0E0] dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-[#111] dark:text-white outline-none focus:border-[#0057FF]"
        />
        <button onClick={() => setShow(s => !s)} className="text-[11px] font-bold px-2 py-1.5 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 text-[#666]">
          {show ? 'Cacher' : 'Voir'}
        </button>
        <button onClick={() => void save()} disabled={busy || !value.trim()}
          className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg bg-[#111] text-white hover:bg-black disabled:opacity-40">
          Enregistrer
        </button>
        {saved && (
          <button onClick={() => void run(saved)} disabled={busy}
            className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg border border-[#0057FF] text-[#0057FF] hover:bg-[#0057FF]/5 disabled:opacity-40">
            {busy ? 'Test…' : 'Tester la clé'}
          </button>
        )}
        {saved && (
          <button onClick={() => { setWorkerAdminKey(''); setValue(''); setMsg({ ok: false, text: 'Clé effacée de cet appareil.' }); }}
            className="text-[11px] font-bold px-2 py-1.5 rounded-lg text-[#999] hover:text-red-600">
            Oublier
          </button>
        )}
      </div>
      {msg && (
        <div className={`text-[11.5px] font-bold mt-2 ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{msg.text}</div>
      )}
    </section>
  );
}

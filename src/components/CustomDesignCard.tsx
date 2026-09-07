import { useRef, useState } from 'react';
import { getInstalledDesign, installDesignFile, uninstallDesign } from '../lib/customDesign';
import { VENDOR } from '../lib/config';

/* ============================================================
   « IMPORTER MON DESIGN »
   ------------------------------------------------------------
   Voie de livraison du design sur mesure (offre 5 000 F) : le vendeur
   compileson modèle chez lui (`npm run design:pack`) et envoie le fichier
   .dddesign.js ; le client l'importe ici. Rien n'est téléchargé : le code
   du modèle est vérifié (signature au secret de l'app) puis rangé dans le
   localStorage de CET appareil — il part donc dans la sauvegarde JSON et
   survit à un changement de poste.

   Le fichier n'est PAS exécuté avant vérification ; après vérification,
   son texte est stocké tel quel (en-tête + signature) pour être re-joué
   au chargement. Un fichier modifié d'un caractère est refusé.
   ============================================================ */

interface Props {
  /** À appeler après installation/retrait : le sélecteur de modèles se rafraîchit. */
  onChanged?: () => void;
}

const MAX_LABEL = '250 ko';

export default function CustomDesignCard({ onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const installed = getInstalledDesign();

  const apply = async (text: string, from: string) => {
    setBusy(true);
    setMsg(null);
    const r = await installDesignFile(text);
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: `« ${r.meta.name} » est installé. Choisissez-le dans l’onglet STYLE pour l’appliquer à votre document.` });
      setShowPaste(false);
      setPaste('');
      onChanged?.();
    } else {
      setMsg({ ok: false, text: r.error + (from === 'paste' ? ' (le collage doit contenir TOUT le fichier, en-tête compris)' : '') });
    }
  };

  const onFile = async (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > 400_000) { setMsg({ ok: false, text: `Fichier trop volumineux (maximum ${MAX_LABEL}).` }); return; }
    try {
      const text = await f.text();
      await apply(text, 'file');
    } catch {
      setMsg({ ok: false, text: 'Lecture impossible. Vérifiez que c’est bien le fichier reçu du vendeur.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (installed) {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-black tracking-widest text-green-700 dark:text-green-400">VOTRE DESIGN PERSONNALISÉ · INSTALLÉ</div>
            <div className="text-[14px] font-extrabold text-[#111] dark:text-white truncate mt-1">{installed.meta.name}</div>
            <div className="text-[11px] text-[#666] dark:text-zinc-300 mt-0.5">
              {installed.meta.desc || 'Design sur mesure'}
              {installed.meta.author ? ' · ' + installed.meta.author : ''}
            </div>
            {installed.installedAt > 0 && (
              <div className="text-[10px] text-[#999] mt-1">
                Importé le {new Date(installed.installedAt).toLocaleDateString('fr-FR')}
                {installed.sig ? ' · contrôle ' + installed.sig.slice(0, 6) : ''}
              </div>
            )}
          </div>
          {msg && <div className={`text-[10.5px] font-bold max-w-[45%] text-right ${msg.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>{msg.text}</div>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-900 text-[11px] font-bold text-[#333] dark:text-zinc-200 hover:opacity-90"
          >
            Remplacer par un nouveau fichier
          </button>
          <button
            onClick={() => { uninstallDesign(); setMsg({ ok: true, text: 'Design retiré.' }); onChanged?.(); }}
            className="px-3 py-2 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 text-[11px] font-bold text-[#888] hover:text-red-500"
          >
            Retirer ce design
          </button>
        </div>
        <p className="text-[10px] text-[#8a8a8a] mt-2 leading-relaxed">
          Ce modèle n’appartient qu’à vous : il n’est pas ajouté à la liste des autres utilisateurs.
          Pensez à « Exporter une copie » pour l’emporter sur un autre appareil.
        </p>
        <input ref={fileRef} type="file" accept=".js,.dddesign.js,.txt,text/javascript" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-dashed p-4" style={{ borderColor: '#0057FF40' }}>
      <div className="text-[9px] font-black tracking-widest text-[#0057FF]">DESIGN PERSONNALISÉ · ÉTAPE 2</div>
      <div className="text-[13.5px] font-extrabold text-[#111] dark:text-white mt-1">Importer mon design</div>
      <p className="text-[11.5px] text-[#666] dark:text-zinc-300 mt-1.5 leading-relaxed">
        Le vendeur vous a envoyé un fichier <b>.dddesign.js</b> ? Importez-le ici : il s’ajoute à vos modèles,
        sur cet appareil. ({msg ? '' : 'Taille maximum ' + MAX_LABEL + ' · un fichier modifié est refusé.'})
      </p>
      {msg && (
        <div className={`mt-2 text-[11px] font-bold ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{msg.text}</div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="px-4 py-2.5 rounded-lg bg-[#0057FF] text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-60"
        >
          {busy ? 'Vérification…' : 'Choisir le fichier reçu'}
        </button>
        {!showPaste && (
          <button
            onClick={() => setShowPaste(true)}
            className="px-4 py-2.5 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 text-[12px] font-bold text-[#555] dark:text-zinc-300 hover:bg-[#F8F8F8] dark:hover:bg-zinc-800"
          >
            Je colle le contenu du fichier
          </button>
        )}
      </div>
      {showPaste && (
        <div className="mt-3">
          <textarea
            value={paste}
            onChange={e => setPaste(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder="Collez ici le contenu COMPLET du fichier (la première ligne commence par la balise DDDESIGN1)."
            className="w-full px-3 py-2.5 text-[11px] font-mono rounded-lg border border-[#E0E0E0] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white focus:outline-none focus:border-[#0057FF]"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => apply(paste, 'paste')}
              disabled={busy || paste.trim().length < 40}
              className="px-4 py-2 rounded-lg bg-[#0057FF] text-white text-[12px] font-bold disabled:opacity-50"
            >
              {busy ? 'Vérification…' : 'Importer ce texte'}
            </button>
            <button onClick={() => { setShowPaste(false); setPaste(''); }} className="px-4 py-2 rounded-lg text-[12px] font-bold text-[#888]">Annuler</button>
          </div>
        </div>
      )}
      <p className="text-[10px] text-[#999] mt-3 leading-relaxed">
        Pas encore de fichier ? Décrivez votre design au vendeur sur WhatsApp ({VENDOR.PHONE}) — il vous renvoie
        le fichier à importer ici. Vous recevrez aussi un code d’activation qui compte vos exports.
      </p>
      <input ref={fileRef} type="file" accept=".js,.dddesign.js,.txt,text/javascript" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
    </div>
  );
}

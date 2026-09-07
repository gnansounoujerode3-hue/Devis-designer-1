import { useRef, useState } from 'react';
import { MAX_DESIGNS, installDesignFile, listDesigns, uninstallDesign } from '../lib/customDesign';
import { VENDOR } from '../lib/config';

/* ============================================================
   « IMPORTER MES DESIGNS »
   ------------------------------------------------------------
   Voie de livraison du design sur mesure (offre 5 000 F) : le vendeur
   compile son modèle chez lui (`npm run design:pack`) et envoie le
   fichier .dddesign.js ; le client l'importe ici. Rien n'est téléchargé :
   le code est vérifié (signature au secret de l'app) puis rangé dans le
   localStorage de CET appareil — il part donc dans la sauvegarde JSON et
   survit à un changement de poste.

   Un client peut garder jusqu'à MAX_DESIGNS modèles importés. Remplacer un
   emplacement garde son identifiant : les devis déjà rédigés avec ce design
   continuent de s'afficher.
   ============================================================ */

interface Props {
  /** À appeler après installation/retrait : le sélecteur de modèles se rafraîchit. */
  onChanged?: () => void;
}

type Msg = { ok: boolean; text: string } | null;

export default function CustomDesignCard({ onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  /** null = nouvel emplacement ; n = remplacement de l'emplacement n. */
  const [target, setTarget] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const designs = listDesigns();

  const apply = async (text: string, from: 'file' | 'paste') => {
    setBusy(true);
    setMsg(null);
    const r = await installDesignFile(text, target ? { slot: target } : undefined);
    setBusy(false);
    if (r.ok) {
      setMsg({
        ok: true,
        text: designs.length === 0
          ? `« ${r.meta.name} » est installé. Choisissez-le dans l’onglet STYLE pour l’appliquer à votre document.`
          : `« ${r.meta.name} » est ${target ? `placé à l’emplacement ${r.slot} (remplacé)` : `ajouté en n° ${r.slot}`} dans vos modèles.`,
      });
      setShowPaste(false); setPaste(''); setTarget(null);
      onChanged?.();
    } else {
      setMsg({ ok: false, text: r.error + (from === 'paste' ? ' — le collage doit contenir TOUT le fichier, en-tête compris.' : '') });
    }
  };

  const onFile = async (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > 400_000) { setMsg({ ok: false, text: 'Fichier trop volumineux.' }); return; }
    try {
      await apply(await f.text(), 'file');
    } catch {
      setMsg({ ok: false, text: 'Lecture impossible. Vérifiez que c’est bien le fichier reçu du vendeur.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const pick = (slot: number | null) => { setTarget(slot); fileRef.current?.click(); };
  const full = designs.length >= MAX_DESIGNS;

  return (
    <div className={`rounded-xl border p-4 ${designs.length ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30' : 'border-2 border-dashed'}`}
      style={designs.length ? undefined : { borderColor: '#0057FF40' }}>

      {/* en-tête */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[9px] font-black tracking-widest ${designs.length ? 'text-green-700 dark:text-green-400' : 'text-[#0057FF]'}`}>
            {designs.length ? `MES DESIGNS PERSONNALISÉS · ${designs.length}/${MAX_DESIGNS}` : 'DESIGN PERSONNALISÉ · ÉTAPE 2'}
          </div>
          <div className="text-[13.5px] font-extrabold text-[#111] dark:text-white mt-1">
            {designs.length ? 'Vos modèles reçus du vendeur' : 'Importer mon design'}
          </div>
        </div>
        {msg && (
          <div className={`text-[10.5px] font-bold max-w-[46%] text-right leading-snug ${msg.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600'}`}>
            {msg.text}
          </div>
        )}
      </div>

      {/* état vide : on explique d'où vient le fichier */}
      {designs.length === 0 && (
        <p className="text-[11.5px] text-[#666] dark:text-zinc-300 mt-1.5 leading-relaxed">
          Le vendeur vous a envoyé un fichier <b>.dddesign.js</b> ? Importez-le ici : il s’ajoute à vos modèles,
          sur cet appareil seulement. (Taille maximum 250 ko · un fichier modifié est refusé.)
        </p>
      )}

      {/* la liste des emplacements occupés */}
      {designs.length > 0 && (
        <ul className="mt-3 space-y-2">
          {designs.map(d => (
            <li key={d.slot} className="rounded-lg bg-white dark:bg-zinc-900 border border-[#ECECEC] dark:border-zinc-800 px-3 py-2.5 flex items-center gap-3">
              <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: '#0057FF18', color: '#0057FF' }}>
                {d.slot}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-extrabold text-[#111] dark:text-white truncate">{d.meta.name}</div>
                <div className="text-[10.5px] text-[#888] truncate">
                  {d.meta.desc || 'Design sur mesure'}{d.meta.author ? ' · ' + d.meta.author : ''}
                  {d.installedAt > 0 ? ' · importé le ' + new Date(d.installedAt).toLocaleDateString('fr-FR') : ''}
                  {d.sig ? ' · ' + d.sig.slice(0, 6) : ''}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => pick(d.slot)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 text-[10.5px] font-bold text-[#555] dark:text-zinc-300 hover:border-[#0057FF] hover:text-[#0057FF]">
                  Remplacer
                </button>
                <button onClick={() => { uninstallDesign(d.slot); setMsg({ ok: true, text: `« ${d.meta.name} » retiré${target === d.slot ? '' : ''}.` }); setTarget(null); onChanged?.(); }}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 text-[10.5px] font-bold text-[#999] hover:text-red-500">
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {target !== null && (
        <div className="mt-2 text-[10.5px] font-bold text-[#0057FF]">
          Emplacement n° {target} sélectionné — choisissez le nouveau fichier, il remplacera l’ancien
          (vos devis déjà rédigés avec ce design restent à jour).
          <button onClick={() => setTarget(null)} className="ml-2 text-[#888] underline underline-offset-2">annuler</button>
        </div>
      )}

      {/* actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {!full && (
          <button onClick={() => pick(null)} disabled={busy}
            className="px-4 py-2.5 rounded-lg text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-60" style={{ background: '#0057FF' }}>
            {busy ? 'Vérification…' : designs.length ? 'Ajouter un autre design' : 'Choisir le fichier reçu'}
          </button>
        )}
        {full && (
          <button onClick={() => pick(designs[designs.length - 1]?.slot ?? 1)} disabled={busy}
            className="px-4 py-2.5 rounded-lg text-white text-[12px] font-bold hover:opacity-90 disabled:opacity-60" style={{ background: '#0057FF' }}>
            {busy ? 'Vérification…' : `Emplacements pleins (${MAX_DESIGNS}) — remplacer le n° ${designs[designs.length - 1]?.slot ?? 1}`}
          </button>
        )}
        {!showPaste && (
          <button onClick={() => setShowPaste(true)}
            className="px-4 py-2.5 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 text-[12px] font-bold text-[#555] dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800">
            Je colle le contenu du fichier
          </button>
        )}
        {designs.length > 0 && (
          <button onClick={() => { uninstallDesign(); setMsg({ ok: true, text: 'Tous vos designs importés ont été retirés.' }); onChanged?.(); }}
            className="px-4 py-2.5 rounded-lg text-[12px] font-bold text-[#999] hover:text-red-500">
            Tout retirer
          </button>
        )}
      </div>

      {/* collage de secours (pas de gestionnaire de fichiers, ou fichier reçu en texte) */}
      {showPaste && (
        <div className="mt-3">
          <textarea
            value={paste}
            onChange={e => setPaste(e.target.value)}
            rows={5}
            spellCheck={false}
            placeholder="Collez ici le contenu COMPLET du fichier — la première ligne commence par la balise DDDESIGN1."
            className="w-full px-3 py-2.5 text-[11px] font-mono rounded-lg border border-[#E0E0E0] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white focus:outline-none focus:border-[#0057FF]"
          />
          <div className="mt-2 flex gap-2">
            <button onClick={() => apply(paste, 'paste')} disabled={busy || paste.trim().length < 40}
              className="px-4 py-2 rounded-lg text-white text-[12px] font-bold disabled:opacity-50" style={{ background: '#0057FF' }}>
              {busy ? 'Vérification…' : (target ? `Remplacer l'emplacement n° ${target}` : 'Importer ce texte')}
            </button>
            <button onClick={() => { setShowPaste(false); setPaste(''); }} className="px-4 py-2 rounded-lg text-[12px] font-bold text-[#888]">Annuler</button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-[#999] mt-3 leading-relaxed">
        {designs.length === 0 ? (
          <>Pas encore de fichier ? Décrivez votre design au vendeur — WhatsApp ou {VENDOR.PHONE} (bouton dans le bloc « Votre design personnalisé »).</>
        ) : (
          <>Ces modèles n’appartiennent qu’à vous : ils n’apparaissent pas chez les autres utilisateurs. « Exporter une copie » (sauvegarde JSON) les emporte avec vos devis.</>
        )}
      </p>
      <input ref={fileRef} type="file" accept=".js,.dddesign.js,.txt,text/javascript" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
    </div>
  );
}

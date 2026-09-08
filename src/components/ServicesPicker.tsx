/* ============================================================
   CARNET DE PRESTATIONS — le picker et l'étoile de l'onglet « Prestations ».
   ------------------------------------------------------------
   Le store (`learnServices` dans src/store.ts) remplit le carnet tout seul à chaque
   enregistrement ; ce fichier ne fait que le rendre lisible et actionnable :
   poser une ligne habituelle d'un tap, corriger un tarif, retirer une habitude.
   Rien ici n'invente de donnée : la liste affichée est exactement celle du stockage.
   ============================================================ */
import { useMemo, useState } from 'react';
import { SavedService } from '../types';
import { deleteService, normServiceLabel, rememberService } from '../store';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
const MAX_VISIBLE = 8;

/** Autocomplétion des intitulés connus sur les champs « Description » des deux panneaux. */
export function ServicesDatalist({ services }: { services: SavedService[] }) {
  return (
    <datalist id="dd-services">
      {services.map(s => <option key={s.id} value={s.label} />)}
    </datalist>
  );
}

/**
 * L'étoile d'une ligne : elle dit la vérité du carnet, pas une intention.
 * Trois états seulement — mémoriser, à jour, prix différent — parce qu'un bouton dont
 * le libellé change tout seul est le seul moyen d'éviter le « pourquoi ça n'a pas marché ».
 */
export function ServiceStar({ label, unitPrice, services, accent, dark, onChange }: {
  label: string; unitPrice: number; services: SavedService[];
  accent: string; dark: boolean; onChange: () => void;
}) {
  const hit = services.find(s => normServiceLabel(s.label) === normServiceLabel(label));
  const upToDate = !!hit && hit.unitPrice === unitPrice;
  const cls = `text-[9px] font-black tracking-widest px-2 py-1 rounded-md border transition-colors ${dark ? 'border-zinc-700' : 'border-[#E8E8E8]'}`;
  if (!hit) {
    return (
      <button type="button" className={cls} style={{ color: accent }}
        title="Garder cette ligne et ce prix pour les prochains devis"
        onClick={() => { rememberService(label, unitPrice); onChange(); }}>
        ＋ MÉMORISER
      </button>
    );
  }
  if (upToDate) {
    return (
      <button type="button" className={cls} style={{ color: dark ? '#7ee787' : '#127a2f', borderColor: '#127a2f33' }}
        title={`Mémorisée ${hit.uses > 0 ? 'sur ' + hit.uses + ' document(s)' : 'dans le carnet'} — un tap la retire du carnet`}
        onClick={() => { deleteService(hit.id); onChange(); }}>
        ✓ MÉMORISÉE
      </button>
    );
  }
  return (
    <button type="button" className={cls} style={{ color: '#b45309', borderColor: '#b4530933' }}
      title={`Le carnet garde ${fmt(hit.unitPrice)} — un tap y enregistre ${fmt(unitPrice)}`}
      onClick={() => { rememberService(label, unitPrice); onChange(); }}>
      ↻ PRIX À {fmt(unitPrice)}
    </button>
  );
}

/** Le carnet, posé au-dessus des lignes : un tap = la ligne entre dans le devis. */
export function ServicesPicker({ services, curShort, onPick, onChange, dark, accent }: {
  services: SavedService[]; curShort: string;
  onPick: (s: SavedService) => void; onChange: () => void; dark: boolean; accent: string;
}) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [armed, setArmed] = useState('');
  const list = useMemo(() => {
    const n = normServiceLabel(q);
    return n ? services.filter(s => normServiceLabel(s.label).includes(n)) : services;
  }, [services, q]);
  const shown = showAll || q.trim() ? list : list.slice(0, MAX_VISIBLE);
  const box = dark ? 'bg-zinc-800/40 border-zinc-700' : 'bg-[#FAFAFA] border-[#ECECEC]';
  const mute = dark ? 'text-zinc-400' : 'text-[#888]';

  return (
    <div className={`rounded-xl border-2 p-3 ${box}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-[10px] font-black tracking-widest ${dark ? 'text-zinc-300' : 'text-[#666]'}`}>
          MES PRESTATIONS MÉMORISÉES · {services.length}
        </span>
        {services.length > MAX_VISIBLE && (
          <button type="button" className={`text-[9px] font-bold tracking-wider ${mute} hover:opacity-70`}
            onClick={() => setShowAll(v => !v)}>
            {showAll ? 'VOIR MOINS' : `VOIR LES ${services.length}`}
          </button>
        )}
      </div>

      {!services.length ? (
        <p className={`text-[11px] ${mute}`}>
          Rien de mémorisé pour l'instant. Enregistrez un devis (ou touchez ＋ MÉMORISER sur une ligne) :
          vos prestations habituelles reviendront ici, prix compris, sur tous les documents suivants.
        </p>
      ) : (
        <>
          {services.length > 5 && (
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrer : logo, charte, impression…"
              className={`w-full px-2.5 py-1.5 mb-2 text-[12px] rounded-lg border focus:outline-none ${dark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-[#E0E0E0] text-[#333]'}`} />
          )}
          {!list.length ? (
            <p className={`text-[11px] ${mute}`}>Aucune prestation ne correspond à « {q.trim()} ».</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {shown.map(s => (
                <span key={s.id} className="inline-flex items-stretch rounded-lg border overflow-hidden"
                  style={{ borderColor: accent + '40' }}>
                  <button type="button" onClick={() => onPick(s)} title="Poser cette ligne dans le devis"
                    className={`px-2.5 py-1.5 text-[11px] font-bold hover:opacity-85 ${dark ? 'bg-zinc-800 text-zinc-100' : 'bg-white text-[#222]'}`}>
                    {s.label}
                    <b style={{ color: accent }} className="ml-1.5 font-black">{fmt(s.unitPrice)} {curShort}</b>
                    {s.uses > 1 && <i className={`not-italic ml-1.5 text-[9px] font-bold ${mute}`}>×{s.uses}</i>}
                  </button>
                  <button type="button" aria-label={`Retirer ${s.label} du carnet`}
                    onClick={() => {
                      if (armed !== s.id) { setArmed(s.id); return; }
                      deleteService(s.id); setArmed(''); onChange();
                    }}
                    className={`px-2 text-[10px] font-black ${armed === s.id ? 'text-white bg-red-500' : mute + ' hover:text-red-500'}`}>
                    {armed === s.id ? 'SÛR ?' : '×'}
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className={`text-[10px] mt-2 ${mute}`}>
            Le carnet se remplit tout seul à chaque enregistrement ; le prix affiché est le dernier posé.
            Il vit dans ce navigateur — la sauvegarde JSON l'emporte avec vous.
          </p>
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { VENDOR, APP_VERSION } from '../lib/config';

/** Adresse publique de l'app (la même que celle des liens de parrainage). */
const APP_URL = VENDOR.DOWNLOAD_LINK.replace(/\/+$/, '');

interface Props {
  open: boolean;
  onClose: () => void;
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Comment installer l\'application ?',
    a: `Aucune installation : ${VENDOR.APP_NAME} est une application web. Ouvrez ${APP_URL} dans votre navigateur (PC, tablette ou téléphone) et travaillez tout de suite. Sur téléphone, le menu du navigateur propose « Installer l'application » ou « Ajouter à l'écran d'accueil » : vous obtenez une icône qui ouvre l'app comme une application normale.`,
  },
  {
    q: 'L\'application fonctionne-t-elle sans internet ?',
    a: `Oui pour l'essentiel : créer, modifier, consulter et sauvegarder vos devis se fait hors-ligne, et vos documents restent sur votre appareil. Internet sert au paiement, aux liens de partage WhatsApp et à la vérification du compteur d'exports — si le serveur est injoignable, l'application utilise son compteur local et rien ne se bloque.`,
  },
  {
    q: 'Quels sont les prix ?',
    a: `La version gratuite donne 20 exports (PDF ou envoi pour signature) par appareil, sur une période glissante de 30 jours. Ensuite : abonnement mensuel 2 000 F, abonnement 1 an 15 000 F, design personnalisé 5 000 F (paiement unique), ou tous les designs pendant 1 an 50 000 F. La création de devis, elle, reste gratuite et illimitée.`,
  },
  {
    q: 'Combien d\'exports gratuits ai-je droit ?',
    a: `20 exports par appareil sur 30 jours glissants. Le compteur est tenu par le serveur de l'application à partir d'une empreinte de l'appareil : changer de navigateur, ouvrir une fenêtre privée, effacer les données du site ou réimporter une sauvegarde ne le remet donc pas à zéro. Un compteur local sert de secours quand vous êtes hors-ligne.`,
  },
  {
    q: 'Une fenêtre de navigation privée donne-t-elle des exports gratuits en plus ?',
    a: `Non. C'est précisément le cas d'usage que le compteur serveur bloque : l'empreinte de l'appareil et le code de l'installation sont reconnus même en navigation privée, et le nombre d'exports déjà consommés reste acquis sur la période de 30 jours. Si vous avez un vrai besoin d'exports supplémentaires, il y a trois voies honnêtes : l'abonnement, le parrainage, ou une demande de déblocage au vendeur.`,
  },
  {
    q: 'J\'ai atteint ma limite d\'exports, que faire ?',
    a: `Trois options : attendre la fin de la période en cours (la fenêtre d'offres indique « remise à zéro dans X jours »), parrainer un ami (1 mois offert par parrainage valide, jusqu'à 12 mois), ou prendre un abonnement. Si vous venez d'installer l'app sur un nouvel appareil, utilisez le bouton « Demander un déblocage » dans la fenêtre d'offres : le vendeur valide en un clic et vous pouvez exporter à nouveau.`,
  },
  {
    q: 'Comment payer ?',
    a: `Bouton « PRO » (ou « X EXPORTS GRATUITS » en haut), choisissez l'offre et payez par Mobile Money (MTN MoMo, Orange Money, Wave, Moov) dans la caisse sécurisée. Dès que le paiement est confirmé, l'abonnement s'active automatiquement : aucun code à taper. Si la caisse est injoignable, payez au ${VENDOR.PHONE} et le vendeur vous transmet un code d'activation.`,
  },
  {
    q: 'Comment activer mon abonnement ?',
    a: `Normalement vous n'avez rien à faire : l'activation est automatique après paiement. Si le vendeur vous a transmis un code, ouvrez la fenêtre des offres, section « Déjà abonné ? », collez-le et cliquez sur « Activer ». La licence est active immédiatement.`,
  },
  {
    q: 'Que se passe-t-il à la fin de mon abonnement ?',
    a: `Vos devis restent consultables et modifiables. Seuls les nouveaux exports PDF et envois pour signature sont bloqués jusqu'au renouvellement. Un rappel s'affiche 3 jours avant l'expiration.`,
  },
  {
    q: 'Comment sauvegarder mes devis ?',
    a: `Sur la page d'accueil, dans la barre « SAUVEGARDE » : « Exporter une copie » télécharge un fichier JSON contenant tous vos devis et vos clients — ainsi que votre compteur d'exports. « Restaurer une copie » les réimporte, sur le même appareil ou sur un autre.`,
  },
  {
    q: 'Puis-je utiliser l\'application sur plusieurs appareils ?',
    a: `Oui. Exportez une copie sur le premier appareil et restaurez-la sur le second : devis et clients sont fusionnés sans doublons. Deux précisions : chaque appareil conserve son propre compteur d'exports (le quota ne se transfère pas en bonus), et la licence est liée à l'appareil qui l'a activée — pour la déplacer, prévenez le vendeur au ${VENDOR.PHONE}.`,
  },
  {
    q: 'Comment fonctionne le parrainage ?',
    a: `C'est la seule façon d'obtenir des mois gratuits. Partagez votre lien de parrainage (bouton « Parrainer un ami sur WhatsApp » de l'encart PARRAINAGE, accessible via « PRO ») : le lien porte déjà votre code, votre ami n'a rien à saisir. Dès qu'il a exporté au moins un document, votre application reçoit 1 mois offert sous forme de code de remerciement qu'il vous envoie ; vous le collez dans « Déjà abonné ? ». Plafond : 12 mois offerts sur 12 mois glissants, et un seul mois par filleul. Le filleul, lui, ne reçoit rien.`,
  },
  {
    q: 'J\'ai un code parrain, où le saisir ?',
    a: `Le plus simple : ouvrez le lien reçu, le code est enregistré tout seul. Sinon, ouvrez la fenêtre des offres (bouton « PRO »), encart « PARRAINAGE », champ « Un ami vous a parrainé ? », saisissez le code DDREF-… puis « Enregistrer ». Dès votre premier export, votre parrain reçoit son mois offert.`,
  },
  {
    q: 'Mes données sont-elles en sécurité ?',
    a: `Vos devis, vos clients, vos logos et vos signatures ne quittent jamais votre appareil : ils ne sont ni envoyés, ni lus, ni stockés par un serveur. Seules des informations purement techniques circulent quand vous êtes en ligne — une empreinte de l'appareil, le code de l'installation et le nombre d'exports — uniquement pour compter le quota gratuit et valider le parrainage. Rien n'est revendu ni utilisé à des fins publicitaires. Protégez tout de même votre appareil par un code PIN : c'est lui qui contient vos données.`,
  },
  {
    q: 'J\'ai perdu un code d\'activation, que faire ?',
    a: `Contactez le support avec vos informations de paiement (date, montant, numéro) : le code pourra vous être renvoyé, ou votre licence réactivée sur votre nouvel appareil. Ne partagez jamais vos codes avec d'autres personnes.`,
  },
  {
    q: 'Comment vérifier que j\'ai la bonne version ?',
    a: `Le pied de page affiche « Devis Designer · Version ${APP_VERSION} ». Si un écran semble bloqué ou date un peu, rechargez en dur (Ctrl+Maj+R sur ordinateur, ou videz le cache du navigateur sur téléphone) : l'application tient dans un seul fichier et l'ancienne version peut rester en cache.`,
  },
  {
    q: 'Comment contacter le support ?',
    a: `Par WhatsApp ou téléphone au ${VENDOR.PHONE}, ou par email à ${VENDOR.EMAIL}. Nous répondons en général sous 24 h.`,
  },
];
export default function FAQModal({ open, onClose }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[97] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-[#F0F0F0] dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-[#111] dark:text-white">Questions fréquentes</h2>
            <div className="text-[11px] text-[#888] mt-0.5">{FAQS.length} questions — touchez une question pour voir la réponse</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#F0F0F0] dark:hover:bg-zinc-800 flex items-center justify-center text-[#999]">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {FAQS.map((f, i) => (
            <div key={i} className="rounded-xl border border-[#ECECEC] dark:border-zinc-700 overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#F8F8F8] dark:hover:bg-zinc-800 transition-colors"
              >
                <span className={`text-xs font-bold ${openIdx === i ? 'text-[#0057FF]' : 'text-[#333] dark:text-zinc-200'}`}>{f.q}</span>
                <span className={`text-[#999] text-sm transition-transform ${openIdx === i ? 'rotate-45' : ''}`}>+</span>
              </button>
              {openIdx === i && (
                <div className="px-4 pb-3 text-[11px] leading-relaxed text-[#666] dark:text-zinc-400">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-[#F0F0F0] dark:border-zinc-800 flex items-center justify-between gap-3">
          <div className="text-[10px] text-[#999]">Une autre question ?<br />{VENDOR.PHONE}</div>
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-[#111] dark:bg-white text-white dark:text-black text-sm font-bold hover:opacity-90">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { VENDOR } from '../lib/config';

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab?: 'cgu' | 'privacy';
}

/**
 * E — Mentions légales : Conditions Générales d'Utilisation (CGU)
 * et Politique de Confidentialité (conforme loi n°2017-20, Code du numérique Bénin).
 */
export default function LegalModal({ open, onClose, initialTab }: Props) {
  const [tab, setTab] = useState<'cgu' | 'privacy'>(initialTab || 'cgu');
  // Synchronise l'onglet à chaque ouverture
  useEffect(() => { if (open && initialTab) setTab(initialTab); }, [open, initialTab]);
  if (!open) return null;

  const appName = VENDOR.APP_NAME;
  const contact = `${VENDOR.PHONE} / ${VENDOR.EMAIL}`;
  const site = VENDOR.DOWNLOAD_LINK.replace(/\/+$/, '');

  const Section = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <div className="text-xs font-black text-[#111] dark:text-white mb-1">{n}. {title}</div>
      <div className="text-[11px] leading-relaxed text-[#666] dark:text-zinc-400">{children}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[97] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* En-tête + onglets */}
        <div className="p-5 border-b border-[#F0F0F0] dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-[#111] dark:text-white">Informations légales</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#F0F0F0] dark:hover:bg-zinc-800 flex items-center justify-center text-[#999]">×</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTab('cgu')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${tab === 'cgu' ? 'bg-[#0057FF] text-white' : 'bg-[#F0F0F0] dark:bg-zinc-800 text-[#666] dark:text-zinc-400'}`}>
              Conditions d'utilisation
            </button>
            <button onClick={() => setTab('privacy')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${tab === 'privacy' ? 'bg-[#0057FF] text-white' : 'bg-[#F0F0F0] dark:bg-zinc-800 text-[#666] dark:text-zinc-400'}`}>
              Confidentialité
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'cgu' ? (
            <>
              <Section n="1" title="Objet">
                Les présentes conditions générales d'utilisation (CGU) régissent l'utilisation de l'application {appName},
                éditée par {VENDOR.APP_NAME}, joignable au {contact}. L'application permet de créer, personnaliser,
                exporter des devis et factures professionnels et de les faire signer.
              </Section>
              <Section n="2" title="Accès au service">
                L'application est un service web accessible à l'adresse <a href={site} className="underline">{site}</a>,
                sans installation ni téléchargement, sur ordinateur comme sur téléphone. Les documents sont créés et
                conservés sur l'appareil de l'utilisateur. L'accès est gratuit, avec un quota d'exports et des
                fonctionnalités payantes décrits à l'article 3.
              </Section>
              <Section n="3" title="Offres et tarifs">
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Version gratuite : 20 exports (PDF ou envoi pour signature) par appareil, sur une période
                    glissante de 30 jours. La création et la consultation des documents restent illimitées.</li>
                  <li>Abonnement mensuel : 2 000 F CFA / mois.</li>
                  <li>Abonnement 1 an : 15 000 F CFA.</li>
                  <li>Design personnalisé : 5 000 F CFA (paiement unique). Le design est livré en fichier
                    (<code>.dddesign.js</code>) que l'utilisateur importe dans l'application — carte « Importer mon
                    design » — et ce paiement inclut 1 mois d'exports illimités. L'utilisateur peut conserver
                    jusqu'à 6 designs importés et les remplacer par une version corrigée.</li>
                  <li>Tous les designs pendant 1 an : 50 000 F CFA.</li>
                  <li>
                    Parrainage : chaque parrainage valide ouvre droit à <b>1 mois d'abonnement offert pour le parrain</b>{' '}
                    (jamais pour le filleul), dans la limite de 12 mois offerts sur 12 mois glissants. Il n'existe aucun
                    autre dispositif de mois gratuits dans l'application (ni concours, ni bonus de lancement).
                  </li>
                </ul>
                Les paiements sont effectués via la plateforme Chariow (Mobile Money : MTN MoMo, Orange Money, Wave, Moov)
                ou selon les modalités communiquées par l'éditeur. L'abonnement est activé automatiquement dès la
                confirmation du paiement ; à titre de secours, l'éditeur peut transmettre un code d'activation que
                l'utilisateur saisit dans la fenêtre des offres.
              </Section>
              <Section n="4" title="Quota et abonnements">
                En version gratuite, l'utilisateur dispose de 20 exports (PDF ou envoi pour signature) par appareil sur
                30 jours glissants. Ce compteur est tenu par le serveur de l'éditeur à partir d'une empreinte technique
                de l'appareil et du code d'installation : changer de navigateur, ouvrir une fenêtre de navigation privée,
                effacer les données du site ou réimporter une sauvegarde ne le réinitialise pas. Au-delà du quota, un
                abonnement est requis ; une demande de déblocage motivée peut être adressée à l'éditeur, qui l'accorde
                ou la refuse à sa discrétion. L'abonnement mensuel est reconductible ; l'abonnement annuel expire
                à la date indiquée. Les documents créés restent consultables et modifiables même après expiration de
                l'abonnement ; seuls les nouveaux exports sont bloqués jusqu'au renouvellement.
                Un parrainage est considéré comme valide lorsque le filleul a enregistré le code parrain dans
                l'application et y a effectué au moins un export (PDF ou envoi pour signature). Le code de remerciement
                généré est nominatif : il n'est activable que sur l'installation du parrain qu'il récompense et reste
                activable pendant 30 jours. Un même filleul ne peut récompenser qu'une seule fois.
              </Section>
              <Section n="5" title="Propriété intellectuelle">
                L'application, ses templates et son contenu sont la propriété de l'éditeur. L'utilisateur bénéficie d'un
                droit d'usage personnel et non cessible. Les documents qu'il crée (devis, factures) lui appartiennent.
                La revente ou la redistribution des templates sans autorisation est interdite.
              </Section>
              <Section n="6" title="Responsabilité">
                L'application est fournie « en l'état ». Les données sont stockées localement sur l'appareil de
                l'utilisateur ; il appartient à ce dernier d'effectuer des sauvegardes régulières (export JSON).
                L'éditeur ne peut être tenu responsable d'une perte de données liée à une désinstallation, un
                nettoyage du stockage ou une panne de l'appareil, ni de l'usage fait des documents créés.
              </Section>
              <Section n="7" title="Données personnelles">
                Les données personnelles éventuellement saisies dans l'application sont traitées conformément à la
                politique de confidentialité (onglet « Confidentialité ») et à la loi n°2017-20 du 20 avril 2018
                portant code du numérique en République du Bénin.
              </Section>
              <Section n="8" title="Droit applicable">
                Les présentes CGU sont soumises au droit béninois. Tout litige relève des tribunaux compétents de la
                République du Bénin.
              </Section>
              <Section n="9" title="Contact">
                Pour toute question : {contact}.
              </Section>
            </>
          ) : (
            <>
              <Section n="1" title="Responsable du traitement">
                Le responsable du traitement des données est {VENDOR.APP_NAME}, joignable au {contact}.
              </Section>
              <Section n="2" title="Données collectées">
                Deux catégories de données sont traitées.
                <br /><br />
                <b>1. Les données de vos documents</b> — nom, coordonnées et adresse de l'émetteur et du client,
                description des prestations, montants, signatures électroniques, logo et préférences (couleurs, polices) :
                elles sont saisies par l'utilisateur et restent sur son appareil. Elles ne sont ni transmises, ni lues,
                ni stockées par le serveur de l'éditeur.
                <br /><br />
                <b>2. Les données techniques de comptage</b> — une empreinte anonyme de l'appareil (hash de signaux comme
                le navigateur, la langue, la résolution d'écran ou le fuseau horaire), le code d'installation de
                l'application, le nombre d'exports réalisés et, pour les paiements, les références de la transaction.
                Elles servent uniquement à appliquer le quota gratuit, à vérifier un abonnement et à valider le
                parrainage. Elles sont envoyées au serveur de l'éditeur (Cloudflare Workers) uniquement lorsque
                l'appareil est connecté.
              </Section>
              <Section n="3" title="Stockage">
                Les documents, clients, logos, signatures, fiches émetteurs et prestations mémorisées sont stockés
                exclusivement dans le navigateur de l'appareil
                de l'utilisateur (localStorage et IndexedDB) : ils ne sont jamais transmis à un serveur et ne sont pas
                partagés avec des tiers. Les données techniques de comptage sont conservées côté serveur le temps de la
                période de quota (30 jours glissants) et de la validité des codes de licence, puis écrasées ; elles ne
                sont utilisées à aucune autre fin, ni publicitaire, ni statistique revendue. L'utilisateur peut à tout
                moment exporter ses documents (sauvegarde JSON) ou tout effacer en supprimant les données du site — pour
                les mentions techniques côté serveur, il s'adresse à l'éditeur au {contact}.
              </Section>
              <Section n="4" title="Finalités">
                Les données sont utilisées uniquement pour : la création, la personnalisation, l'export et la signature
                des devis et factures ; l'application du quota d'exports gratuits ; la délivrance et la vérification des
                abonnements ; la gestion du parrainage et, le cas échéant, le traitement d'une demande de déblocage.
              </Section>
              <Section n="5" title="Conservation">
                Les données de documents sont conservées sur l'appareil jusqu'à leur suppression par l'utilisateur
                (suppression d'un document, effacement des données du site). Les compteurs techniques côté serveur sont
                datés et oubliés à l'issue de la fenêtre glissante de 30 jours ; les demandes de déblocage restent
                visibles par l'éditeur jusqu'à ce qu'il les traite, puis sont supprimées.
              </Section>
              <Section n="6" title="Droits de l'utilisateur">
                Conformément au code du numérique (loi n°2017-20), l'utilisateur dispose d'un droit d'accès, de
                rectification, d'opposition et de suppression des données le concernant. Ces droits s'exercent
                directement dans l'application (suppression, modification) ou en contactant l'éditeur au {contact}.
              </Section>
              <Section n="7" title="Sécurité">
                Les données restant sur l'appareil, leur sécurité dépend principalement des mesures de protection de
                l'appareil (code PIN, verrouillage). L'éditeur recommande d'activer le verrouillage de l'appareil et
                d'effectuer des sauvegardes régulières.
              </Section>
              <Section n="8" title="Déclaration réglementaire">
                Conformément à la loi n°2017-20 du 20 avril 2018 portant code du numérique en République du Bénin,
                le traitement des données à caractère personnel effectué dans le cadre de cette application fera
                l'objet d'une déclaration auprès de l'Autorité de Protection des Données à caractère Personnel (APDP).
              </Section>
              <Section n="9" title="Contact et droits">
                Pour exercer vos droits ou toute question relative à vos données : {contact}.
              </Section>
            </>
          )}
        </div>

        <div className="p-4 border-t border-[#F0F0F0] dark:border-zinc-800">
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-[#111] dark:bg-white text-white dark:text-black text-sm font-bold hover:opacity-90">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

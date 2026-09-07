import TemplateModern from './TemplateModern';
import TemplateClassic from './TemplateClassic';
import TemplateMinimal from './TemplateMinimal';
import TemplateCreative from './TemplateCreative';
import TemplateStudio from './TemplateStudio';
import TemplateArchitect from './TemplateArchitect';
import TemplateAdapted from './TemplateAdapted';
import TemplateMinimalist from './TemplateMinimalist';
import TemplatePurple from './TemplatePurple';
import TemplateCorporate from './TemplateCorporate';
import TemplateModernOrange from './TemplateModernOrange';
import TemplateCleanGradient from './TemplateCleanGradient';
import { BuiltinTemplateId, TemplateId, TemplateInfo } from '../types';
import { customTemplateInfos, onDesignChange, resolveCustomTemplate } from '../lib/customDesign';

export const TEMPLATES: TemplateInfo[] = [
  { id: 'modern',    name: 'Modern',     description: 'Swiss contemporain, bandeau coloré' },
  { id: 'studio',    name: 'Studio',     description: 'Cards arrondies, dégradé, style SaaS' },
  { id: 'minimal',   name: 'Minimal',    description: 'Ultra-épuré, espace blanc maximal' },
  { id: 'architect', name: 'Fresh',      description: 'Double-ligne, blocs teintes, 3 cards meta' },
  { id: 'creative',  name: 'Creative',   description: 'Formes géométriques, couleurs douces' },
  { id: 'classic',   name: 'Signature',  description: 'Titre italic, cercle initial, ligne accent' },
  { id: 'adapted',   name: 'Adapted',    description: 'Colonne sombre, INVOICE, cartes info' },
  { id: 'minimalist', name: 'Minimalist', description: 'Serif élégant, flèche, cartes arrondies' },
  { id: 'purple',    name: 'Purple',     description: 'Épuré, cercles décoratifs, total dégradé' },
  { id: 'corporate', name: 'Corporate',  description: 'Fond sombre, accents orange, table épurée' },
  { id: 'modernorange', name: 'Modern Orange', description: 'Noir/orange, INVOICE empilé, pied de page noir' },
  { id: 'cleangradient', name: 'Clean Gradient', description: 'Bulles dégradées, pilules sombres, épuré' },
];

export const TEMPLATE_COMPONENTS: Record<BuiltinTemplateId, typeof TemplateModern> = {
  modern: TemplateModern,
  classic: TemplateClassic,
  minimal: TemplateMinimal,
  creative: TemplateCreative,
  studio: TemplateStudio,
  architect: TemplateArchitect,
  adapted: TemplateAdapted,
  minimalist: TemplateMinimalist,
  purple: TemplatePurple,
  corporate: TemplateCorporate,
  modernorange: TemplateModernOrange,
  cleangradient: TemplateCleanGradient,
};

/** Les modèles proposés au client : les 12 embarqués + ses designs importés, s'il y en a. */
export function allTemplates(): TemplateInfo[] {
  const mine = customTemplateInfos();
  return mine.length ? [...TEMPLATES, ...mine] : TEMPLATES;
}

/**
 * Composant d'un modèle (importé ou embarqué). Un id « custom-n » dont le fichier a
 * été retiré retombe sur Modern : un document rédigé avec un design disparu continue
 * de s'afficher (et de s'exporter) au lieu de faire un écran blanc.
 */
export function resolveTemplate(id: TemplateId): typeof TemplateModern {
  const custom = resolveCustomTemplate(id);
  if (custom) return custom as unknown as typeof TemplateModern;
  return TEMPLATE_COMPONENTS[id as BuiltinTemplateId] || TEMPLATE_COMPONENTS.modern;
}

export { onDesignChange };

export { TemplateModern, TemplateClassic, TemplateMinimal, TemplateCreative, TemplateStudio, TemplateArchitect, TemplateAdapted, TemplateMinimalist, TemplatePurple, TemplateCorporate, TemplateModernOrange, TemplateCleanGradient };

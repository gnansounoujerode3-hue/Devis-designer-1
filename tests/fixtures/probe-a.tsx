/* Gabarit de test : un modèle conforme au contrat, qui écrit FIXTURE-A. */
import type { RefObject } from 'react';
import { formatMoney, type QuoteData } from '../../src/types';

interface Props { data: QuoteData; svgRef?: RefObject<SVGSVGElement | null> }

export default function Template({ data, svgRef }: Props) {
  const total = data.items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 1123" width="100%" height="100%">
      <text x="40" y="80" fontSize="28" fontWeight="800">FIXTURE-A</text>
      <text x="40" y="130" fontSize="14">{data.clientName}</text>
      <text x="40" y="170" fontSize="14">{formatMoney(total, data.currency)}</text>
    </svg>
  );
}

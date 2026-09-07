/* Gabarit de test : prouve que le design importé reçoit bien le React de l'app
   (deux copies de React font planter les hooks). */
import { useState, type RefObject } from 'react';
import type { QuoteData } from '../../src/types';

interface Props { data: QuoteData; svgRef?: RefObject<SVGSVGElement | null> }

export default function Template({ data, svgRef }: Props) {
  const [n] = useState(3);
  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 1123">
      <text x="10" y="10">{data.quoteNumber}-{n}</text>
    </svg>
  );
}

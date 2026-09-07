import React from 'react';
import { QuoteData } from '../types';
import { resolveTemplate } from '../templates';

interface Props {
  data: QuoteData;
  svgRef?: React.RefObject<SVGSVGElement | null>;
}

export default function QuoteSVG({ data, svgRef }: Props) {
  const Template = resolveTemplate(data.templateId);
  return <Template data={data} svgRef={svgRef} />;
}

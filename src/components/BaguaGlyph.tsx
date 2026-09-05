import React from 'react';
import { BAGUA_DIMENSIONS, type CognitiveFunctionCode } from '@/lib/baguaPersonality';

interface BaguaGlyphProps {
  code: CognitiveFunctionCode;
  className?: string;
  decorative?: boolean;
}

export function BaguaGlyph({ code, className = 'h-8 w-8', decorative = false }: BaguaGlyphProps) {
  const dimension = BAGUA_DIMENSIONS[code];

  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      className={className}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${dimension.trigram}卦，${dimension.name}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {!decorative && <title>{`${dimension.trigram}卦 · ${dimension.name}`}</title>}
      {dimension.lines.map((isYang, index) => {
        const y = 16 + index * 30;
        return isYang ? (
          <rect key={y} x="8" y={y} width="84" height="12" rx="1.5" />
        ) : (
          <React.Fragment key={y}>
            <rect x="8" y={y} width="35" height="12" rx="1.5" />
            <rect x="57" y={y} width="35" height="12" rx="1.5" />
          </React.Fragment>
        );
      })}
    </svg>
  );
}


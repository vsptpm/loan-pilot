// src/components/illustrations/FinancialPlanningIllustration.tsx
import type { SVGProps } from 'react';

export function FinancialPlanningIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 200"
      width={props.width || 300}
      height={props.height || 200}
      aria-labelledby="financialPlanningTitle"
      role="img"
      {...props}
    >
      <title id="financialPlanningTitle">Illustration of a person managing financial charts and graphs</title>
      {/* Background elements */}
      <rect width="300" height="200" fill="hsl(var(--background))" />

      {/* Larger background chart (line graph) */}
      <path d="M20 150 Q 60 100, 100 120 T 180 90" stroke="hsl(var(--muted-foreground))" strokeWidth="2" fill="none" opacity="0.7" />
      <rect x="30" y="70" width="10" height="30" fill="hsl(var(--primary))" opacity="0.5" />
      <rect x="45" y="55" width="10" height="45" fill="hsl(var(--primary))" opacity="0.5" />
      <rect x="60" y="40" width="10" height="60" fill="hsl(var(--primary))" opacity="0.5" />
      
      {/* Circle with arrow */}
      <circle cx="230" cy="70" r="30" fill="hsl(var(--destructive) / 0.6)" />
      <line x1="210" y1="90" x2="250" y2="50" stroke="hsl(var(--foreground))" strokeWidth="2.5" markerEnd="url(#arrowhead)" />
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--foreground))" />
        </marker>
      </defs>

      {/* Person */}
      {/* Body */}
      <path d="M150 100 Q 150 120 135 130 L 130 170 L 170 170 L 165 130 Q 150 120 150 100 Z" fill="hsl(var(--foreground))" /> {/* Dark pants */}
      <path d="M140 65 L 160 65 L 165 105 L 135 105 Z" fill="hsl(var(--card))" /> {/* Light shirt */}
      {/* Head */}
      <circle cx="150" cy="50" r="15" fill="hsl(var(--muted))" /> {/* Skin tone */}
      {/* Hair */}
      <circle cx="150" cy="40" r="10" fill="hsl(var(--foreground))" /> {/* Bun */}
      <path d="M138 45 Q 150 33 162 45" fill="hsl(var(--foreground))" /> {/* Hair top */}
      {/* Arms */}
      <rect x="125" y="70" width="10" height="30" rx="3" fill="hsl(var(--muted))" transform="rotate(-20 130 85)" />
      <rect x="165" y="70" width="10" height="45" rx="3" fill="hsl(var(--muted))" transform="rotate(10 170 85)" />

      {/* Small chart in hand */}
      <rect x="170" y="100" width="50" height="35" rx="3" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />
      <rect x="178" y="118" width="7" height="10" fill="hsl(var(--primary))" />
      <rect x="190" y="112" width="7" height="16" fill="hsl(var(--primary))" />
      <rect x="202" y="106" width="7" height="22" fill="hsl(var(--primary))" />
      <line x1="175" y1="130" x2="215" y2="130" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />
      <line x1="175" y1="105" x2="215" y2="105" stroke="hsl(var(--muted-foreground))" strokeWidth="1" />
    </svg>
  );
}

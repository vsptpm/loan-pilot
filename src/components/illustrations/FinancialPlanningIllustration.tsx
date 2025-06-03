// src/components/illustrations/FinancialPlanningIllustration.tsx
import type { SVGProps } from 'react';

export function FinancialPlanningIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 200"
      width={props.width || 300}
      height={props.height || 200}
      aria-labelledby="financialPlanningTitleAltV3"
      role="img"
      {...props}
    >
      <title id="financialPlanningTitleAltV3">Illustration representing financial planning with a growing plant, coins, and a document</title>
      
      {/* Document Icon */}
      <rect x="50" y="70" width="80" height="100" rx="5" fill="hsl(var(--card))" stroke="hsl(var(--primary) / 0.7)" strokeWidth="2"/>
      <line x1="60" y1="90" x2="120" y2="90" stroke="hsl(var(--muted-foreground) / 0.5)" strokeWidth="2"/>
      <line x1="60" y1="105" x2="120" y2="105" stroke="hsl(var(--muted-foreground) / 0.5)" strokeWidth="2"/>
      <line x1="60" y1="120" x2="100" y2="120" stroke="hsl(var(--muted-foreground) / 0.5)" strokeWidth="2"/>
      <line x1="60" y1="135" x2="120" y2="135" stroke="hsl(var(--muted-foreground) / 0.5)" strokeWidth="2"/>
      <line x1="60" y1="150" x2="90" y2="150" stroke="hsl(var(--muted-foreground) / 0.5)" strokeWidth="2"/>
      <circle cx="75" cy="80" r="3" fill="hsl(var(--primary) / 0.5)" />
      <circle cx="95" cy="80" r="3" fill="hsl(var(--primary) / 0.5)" />

      {/* Growing Plant */}
      {/* Pot */}
      <path d="M170 160 Q170 170 180 170 L220 170 Q230 170 230 160 L225 140 L175 140 Z" fill="hsl(var(--secondary) / 0.3)" stroke="hsl(var(--secondary))" strokeWidth="2" />
      {/* Stem */}
      <line x1="200" y1="140" x2="200" y2="90" stroke="hsl(var(--primary))" strokeWidth="3" />
      {/* Leaves */}
      <ellipse cx="185" cy="100" rx="15" ry="8" fill="hsl(var(--primary) / 0.8)" transform="rotate(-30 185 100)" />
      <ellipse cx="215" cy="100" rx="15" ry="8" fill="hsl(var(--primary) / 0.8)" transform="rotate(30 215 100)" />
      <ellipse cx="195" cy="80" rx="12" ry="7" fill="hsl(var(--primary) / 0.9)" transform="rotate(-15 195 80)" />
      <ellipse cx="205" cy="80" rx="12" ry="7" fill="hsl(var(--primary) / 0.9)" transform="rotate(15 205 80)" />
      <circle cx="200" cy="65" r="10" fill="hsl(var(--primary))" />

      {/* Coins */}
      <circle cx="230" y="120" r="12" fill="hsl(var(--accent))" stroke="hsl(var(--accent-foreground) / 0.7)" strokeWidth="1.5" />
      <text x="230" y="124" textAnchor="middle" fill="hsl(var(--accent-foreground))" fontSize="10" fontWeight="bold">₹</text>
      
      <circle cx="245" y="105" r="10" fill="hsl(var(--accent) / 0.8)" stroke="hsl(var(--accent-foreground) / 0.6)" strokeWidth="1.5" />
      <text x="245" y="109" textAnchor="middle" fill="hsl(var(--accent-foreground))" fontSize="8" fontWeight="bold">₹</text>

      <circle cx="220" y="95" r="8" fill="hsl(var(--accent) / 0.6)" stroke="hsl(var(--accent-foreground) / 0.5)" strokeWidth="1.5" />
      <text x="220" y="98" textAnchor="middle" fill="hsl(var(--accent-foreground))" fontSize="7" fontWeight="bold">₹</text>
      
      {/* Decorative ground lines - subtle */}
      <line x1="30" y1="180" x2="270" y2="180" stroke="hsl(var(--border) / 0.5)" strokeWidth="1.5" strokeDasharray="5,5" />

    </svg>
  );
}

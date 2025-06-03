// src/components/illustrations/FinancialPlanningIllustration.tsx
import type { SVGProps } from 'react';

export function FinancialPlanningIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 200"
      width={props.width || 300}
      height={props.height || 200}
      aria-labelledby="minimalFinancialPlanningTitleV2"
      role="img"
      {...props}
    >
      <title id="minimalFinancialPlanningTitleV2">Minimal illustration representing financial planning with abstract chart bars, a sprout, and a coin</title>
      
      {/* Element 1: Abstract Chart Bars */}
      <rect x="70" y="100" width="20" height="60" rx="3" fill="hsl(var(--primary) / 0.6)" />
      <rect x="100" y="80" width="20" height="80" rx="3" fill="hsl(var(--primary) / 0.8)" />
      <rect x="130" y="110" width="20" height="50" rx="3" fill="hsl(var(--primary) / 0.4)" />

      {/* Element 2: Minimal Sprout */}
      {/* Stem */}
      <path d="M190 150 Q190 120 200 110" stroke="hsl(var(--accent))" strokeWidth="4" fill="none" strokeLinecap="round"/>
      {/* Leaves */}
      <ellipse cx="190" cy="105" rx="12" ry="7" fill="hsl(var(--accent) / 0.7)" transform="rotate(-30 190 105)" />
      <ellipse cx="210" cy="100" rx="12" ry="7" fill="hsl(var(--accent) / 0.7)" transform="rotate(20 210 100)" />

      {/* Element 3: Single Coin */}
      <circle cx="230" cy="140" r="15" fill="hsl(var(--secondary))" stroke="hsl(var(--secondary-foreground) / 0.3)" strokeWidth="1.5" />
      {/* Simple detail on coin */}
      <path d="M226 140 A 6 6 0 0 0 234 140" fill="none" stroke="hsl(var(--secondary-foreground) / 0.5)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M226 135 A 6 6 0 0 1 234 135" fill="none" stroke="hsl(var(--secondary-foreground) / 0.5)" strokeWidth="1.5" strokeLinecap="round" />
       <path d="M226 145 A 6 6 0 0 1 234 145" fill="none" stroke="hsl(var(--secondary-foreground) / 0.5)" strokeWidth="1.5" strokeLinecap="round" />


    </svg>
  );
}

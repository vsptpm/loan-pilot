// src/components/illustrations/FinancialPlanningIllustration.tsx
import type { SVGProps } from 'react';

export function FinancialPlanningIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 200"
      width={props.width || 300}
      height={props.height || 200}
      aria-labelledby="getStartedLoanPilotTitle"
      role="img"
      {...props}
    >
      <title id="getStartedLoanPilotTitle">Minimal illustration for getting started with LoanPilot, showing abstract steps and a target.</title>
      
      {/* Background shapes for subtle texture - optional */}
      {/* <rect width="300" height="200" fill="hsl(var(--background))" /> */}

      {/* Element 1: Abstract Steps / Blocks */}
      <rect x="70" y="120" width="40" height="40" rx="5" fill="hsl(var(--primary) / 0.3)" />
      <rect x="120" y="100" width="40" height="60" rx="5" fill="hsl(var(--primary) / 0.5)" />
      <rect x="170" y="80" width="40" height="80" rx="5" fill="hsl(var(--primary) / 0.7)" />

      {/* Element 2: Target/Goal Icon (simple) */}
      <circle cx="230" cy="70" r="18" fill="none" stroke="hsl(var(--accent))" strokeWidth="3" />
      <circle cx="230" cy="70" r="8" fill="hsl(var(--accent))" />
      
      {/* Element 3: Small stylized arrow pointing towards target/steps */}
      <path d="M60 70 L80 70 M70 60 L80 70 L70 80" 
            stroke="hsl(var(--muted-foreground) / 0.6)" 
            strokeWidth="3" 
            fill="none" 
            strokeLinecap="round" 
            strokeLinejoin="round" />

    </svg>
  );
}

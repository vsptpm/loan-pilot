// src/components/illustrations/FinancialPlanningIllustration.tsx
import type { SVGProps } from 'react';

export function FinancialPlanningIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 200"
      width={props.width || 300}
      height={props.height || 200}
      aria-labelledby="financialPlanningTitleAlt"
      role="img"
      {...props}
    >
      <title id="financialPlanningTitleAlt">Illustration representing financial growth with a piggy bank, coins, and an upward arrow</title>
      {/* Background */}
      <rect width="300" height="200" fill="hsl(var(--background))" />

      {/* Subtle background pattern (optional, e.g., light grid) */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--muted) / 0.3)" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="300" height="200" fill="url(#grid)" opacity="0.5" />

      {/* Piggy Bank */}
      <path 
        d="M100,150 
           C80,150 70,140 70,120 
           C70,100 80,90 100,90 
           C120,90 130,80 150,80 
           C170,80 180,90 200,90 
           C220,90 230,100 230,120 
           C230,140 220,150 200,150 
           Z" 
        fill="hsl(var(--primary) / 0.2)" 
        stroke="hsl(var(--primary))" 
        strokeWidth="2"
      />
      {/* Snout */}
      <ellipse cx="65" cy="118" rx="10" ry="15" fill="hsl(var(--primary) / 0.3)" stroke="hsl(var(--primary))" strokeWidth="1.5" transform="rotate(-10 65 118)" />
      <ellipse cx="63" cy="115" rx="3" ry="2" fill="hsl(var(--primary))" transform="rotate(-10 63 115)" />
      <ellipse cx="68" cy="120" rx="3" ry="2" fill="hsl(var(--primary))" transform="rotate(-10 68 120)" />
      {/* Ear */}
      <path d="M95,85 Q100,70 115,80 L105,95 Z" fill="hsl(var(--primary) / 0.3)" stroke="hsl(var(--primary))" strokeWidth="1.5"/>
      {/* Tail */}
      <path d="M230,115 Q240,100 235,90 C 245,95 240,110 230,115" fill="hsl(var(--primary) / 0.3)" stroke="hsl(var(--primary))" strokeWidth="1.5"/>
      {/* Slot */}
      <rect x="140" y="70" width="20" height="5" rx="2" fill="hsl(var(--primary) / 0.7)" />
      {/* Feet */}
      <rect x="95" y="148" width="15" height="10" rx="3" fill="hsl(var(--primary) / 0.5)" />
      <rect x="185" y="148" width="15" height="10" rx="3" fill="hsl(var(--primary) / 0.5)" />

      {/* Coins */}
      <circle cx="150" cy="60" r="12" fill="hsl(var(--accent))" stroke="hsl(var(--accent-foreground) / 0.7)" strokeWidth="1.5" />
      <text x="150" y="65" textAnchor="middle" fill="hsl(var(--accent-foreground))" fontSize="10" fontWeight="bold">₹</text>
      
      <circle cx="175" cy="50" r="10" fill="hsl(var(--accent) / 0.8)" stroke="hsl(var(--accent-foreground) / 0.6)" strokeWidth="1.5" />
      <text x="175" y="54" textAnchor="middle" fill="hsl(var(--accent-foreground))" fontSize="8" fontWeight="bold">₹</text>

      <circle cx="130" cy="45" r="8" fill="hsl(var(--accent) / 0.6)" stroke="hsl(var(--accent-foreground) / 0.5)" strokeWidth="1.5" />
      <text x="130" y="48" textAnchor="middle" fill="hsl(var(--accent-foreground))" fontSize="7" fontWeight="bold">₹</text>

      {/* Upward Arrow / Growth */}
      <path d="M220,70 L220,40 L210,50 M220,40 L230,50" stroke="hsl(var(--destructive))" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="220" y1="70" x2="220" y2="85" stroke="hsl(var(--destructive))" strokeWidth="3" />

      {/* Small decorative bar chart elements */}
      <rect x="40" y="160" width="10" height="20" fill="hsl(var(--secondary) / 0.7)" rx="2"/>
      <rect x="55" y="145" width="10" height="35" fill="hsl(var(--secondary) / 0.7)" rx="2"/>
      <rect x="245" y="155" width="10" height="25" fill="hsl(var(--secondary) / 0.7)" rx="2"/>
      <rect x="260" y="135" width="10" height="45" fill="hsl(var(--secondary) / 0.7)" rx="2"/>

    </svg>
  );
}

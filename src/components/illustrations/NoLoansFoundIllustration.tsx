
// src/components/illustrations/NoLoansFoundIllustration.tsx
import type { SVGProps } from 'react';

export function NoLoansFoundIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 200"
      width={props.width || 300}
      height={props.height || 200}
      aria-labelledby="noLoansFoundTitle"
      role="img"
      {...props}
    >
      <title id="noLoansFoundTitle">Illustration of an empty open folder</title>
      
      {/* Main folder body - back part */}
      <rect x="70" y="60" width="160" height="100" rx="8" ry="8" fill="hsl(var(--muted))" />
      
      {/* Folder Tab */}
      <path d="M80 60 Q85 50 100 50 L 140 50 Q 145 60 150 60" fill="hsl(var(--muted))" />
      
      {/* Front part of the folder - slightly lighter and offset */}
      <rect x="75" y="70" width="150" height="95" rx="8" ry="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
      
      {/* Representation of emptiness - subtle lines or a question mark */}
      <line x1="100" y1="110" x2="200" y2="110" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="100" y1="130" x2="200" y2="130" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="2" strokeDasharray="4 4" />
      
      {/* Optional: A subtle question mark or icon inside */}
      <text 
        x="150" 
        y="125" 
        fontFamily="sans-serif" 
        fontSize="30" 
        fill="hsl(var(--muted-foreground) / 0.2)" 
        textAnchor="middle" 
        dominantBaseline="middle"
        fontWeight="bold"
      >
        ?
      </text>

    </svg>
  );
}

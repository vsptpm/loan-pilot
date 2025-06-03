import Link from 'next/link';
import { Target } from 'lucide-react'; // Using Target as a placeholder icon

export function SiteLogo() {
  return (
    <Link href="/" className="flex items-center gap-2" prefetch={false}>
      <Target className="h-7 w-7 text-primary" />
      <span className="text-2xl font-headline font-semibold text-primary">LoanPilot</span>
    </Link>
  )}

import Link from 'next/link';
import { TrendingUp } from 'lucide-react'; // Or any other relevant icon

export function SiteLogo() {
  return (
    <Link href="/" className="flex items-center gap-2" prefetch={false}>
      <TrendingUp className="h-7 w-7 text-primary" />
      <span className="text-2xl font-headline font-semibold text-primary">LoanPilot</span>
    </Link>
  
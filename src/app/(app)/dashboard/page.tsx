'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, TrendingUp, ListChecks } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';


// Mock data for now - replace with Firestore data fetching
const mockLoans = [
  { id: '1', name: 'Home Renovation Loan', currentPrincipal: 18500, interestRate: 7.5, remainingTermMonths: 48, monthlyEMI: 450.20, totalPaid: 1500, completedPercentage: 15, nextDueDate: '2024-08-01' },
  { id: '2', name: 'Car Loan', currentPrincipal: 9500, interestRate: 5.2, remainingTermMonths: 30, monthlyEMI: 330.50, totalPaid: 2500, completedPercentage: 40, nextDueDate: '2024-08-15' },
];


export default function DashboardPage() {
  const { user } = useAuth();
  // TODO: Fetch loans from Firestore for the current user

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline tracking-tight">Welcome, {user?.displayName || user?.email?.split('@')[0] || 'User'}!</h1>
          <p className="text-muted-foreground">Here&apos;s an overview of your loans.</p>
        </div>
        <Link href="/loans/add" legacyBehavior>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Loan
          </Button>
        </Link>
      </div>

      {mockLoans.length === 0 && (
         <Card className="w-full shadow-lg">
         <CardHeader>
           <CardTitle className="font-headline text-2xl">Get Started with LoanPilot</CardTitle>
           <CardDescription>Add your first loan to begin tracking your progress.</CardDescription>
         </CardHeader>
         <CardContent className="flex flex-col items-center text-center">
            <Image src="https://placehold.co/300x200.png" alt="Empty state illustration" width={300} height={200} className="mb-6 rounded-md" data-ai-hint="financial planning illustration" />
           <p className="mb-4 text-muted-foreground">
             It looks like you haven&apos;t added any loans yet. Click the button below to add your first loan and take control of your finances.
           </p>
           <Link href="/loans/add" legacyBehavior>
             <Button size="lg">
               <PlusCircle className="mr-2 h-5 w-5" /> Add Your First Loan
             </Button>
           </Link>
         </CardContent>
       </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockLoans.map((loan) => (
          <Card key={loan.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="font-headline text-xl">{loan.name}</CardTitle>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {loan.interestRate}% APR
                </span>
              </div>
              <CardDescription>Next payment due: {new Date(loan.nextDueDate).toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Balance:</span>
                <span className="font-semibold">${loan.currentPrincipal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monthly EMI:</span>
                <span className="font-semibold">${loan.monthlyEMI.toLocaleString()}</span>
              </div>
              <div>
                <Progress value={loan.completedPercentage} className="h-3 mt-1" />
                <p className="text-xs text-muted-foreground mt-1 text-right">{loan.completedPercentage}% paid</p>
              </div>
            </CardContent>
            <CardFooter>
              <Link href={`/loans/${loan.id}`} legacyBehavior passHref>
                <Button variant="outline" className="w-full">
                  View Details
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      {mockLoans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><TrendingUp className="mr-2 h-5 w-5 text-accent" />Overall Progress</CardTitle>
              <CardDescription>A summary of your combined loan repayment.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Placeholder for combined progress chart or stats */}
              <p className="text-muted-foreground">Total Outstanding: $28,000</p>
              <p className="text-muted-foreground">Overall % Paid: 25%</p>
              <Progress value={25} className="h-4 mt-2" />
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center"><ListChecks className="mr-2 h-5 w-5 text-accent" />Next Actions</CardTitle>
              <CardDescription>Upcoming due dates and important tasks.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Placeholder for next actions */}
              <ul className="space-y-2 text-sm">
                <li className="flex items-center"><span className="mr-2 h-2 w-2 rounded-full bg-primary"></span>Pay Car Loan EMI by Aug 15, 2024</li>
                <li className="flex items-center"><span className="mr-2 h-2 w-2 rounded-full bg-primary"></span>Consider prepayment for Home Renovation Loan</li>
              </ul>
            </CardContent>

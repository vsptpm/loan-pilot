
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, Info, User as UserIcon, TrendingDown, TrendingUp as TrendingUpIcon, Percent, ListChecks, Activity, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEffect, useState, useMemo } from 'react';
import type { Loan, AmortizationEntry } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import {
  calculateEMI,
  generateAmortizationSchedule,
  getLoanStatus,
  getInitialPaidEMIsCount,
  type LoanStatus,
} from '@/lib/loanUtils';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FinancialPlanningIllustration } from '@/components/illustrations/FinancialPlanningIllustration';
import { parseISO } from 'date-fns';


interface DashboardLoanSummary {
  id: string;
  name: string;
  currentPrincipal: number;
  interestRate: number;
  monthlyEMI: number;
  completedPercentage: number;
  nextDueDate: string | null;
  originalLoan: Loan;
  status: LoanStatus;
  schedule: AmortizationEntry[];
}


export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      setLoans([]);
      return;
    }

    setIsLoading(true);
    const loansCol = collection(db, `users/${user.uid}/loans`);
    const q = query(loansCol, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userLoans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
      setLoans(userLoans);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching loans for dashboard: ", error);
      toast({ title: "Error", description: "Could not fetch loans.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const loanSummaries: DashboardLoanSummary[] = useMemo(() => {
    if (!loans || loans.length === 0) return [];
    return loans.map(loan => {
      const monthlyEMI = calculateEMI(loan.principalAmount, loan.interestRate, loan.durationMonths);
      const initialPaidEMIs = getInitialPaidEMIsCount(loan.amountAlreadyPaid, monthlyEMI);
      const schedule = generateAmortizationSchedule(
        loan.principalAmount,
        loan.interestRate,
        loan.durationMonths,
        loan.startDate,
        initialPaidEMIs
      );
      const status = getLoanStatus(loan, schedule);
      
      return {
        id: loan.id,
        name: loan.name,
        currentPrincipal: status.currentBalance,
        interestRate: loan.interestRate,
        monthlyEMI: monthlyEMI,
        completedPercentage: status.completedPercentage,
        nextDueDate: status.nextDueDate,
        originalLoan: loan,
        status: status,
        schedule: schedule,
      };
    });
  }, [loans]);

  const dashboardStats = useMemo(() => {
    if (loanSummaries.length === 0) {
      return {
        totalBorrowed: 0,
        totalRepaidSoFar: 0,
        averageInterestRate: 0,
        overallProgressPercentage: 0,
        nextActionMessage: "Add your first loan to see next actions.",
      };
    }

    const totalBorrowed = loanSummaries.reduce((sum, s) => sum + s.originalLoan.principalAmount, 0);
    const totalRepaidSoFar = loanSummaries.reduce((sum,s) => sum + s.status.totalPrincipalPaid, 0); // Uses totalPrincipalPaid from status
    const totalInterestRateSum = loanSummaries.reduce((sum, s) => sum + s.interestRate, 0);
    const averageInterestRate = loanSummaries.length > 0 ? totalInterestRateSum / loanSummaries.length : 0;
    const overallProgressPercentage = totalBorrowed > 0 ? (totalRepaidSoFar / totalBorrowed) * 100 : 0;

    const activeLoansWithDueDates = loanSummaries
      .filter(s => s.nextDueDate && s.currentPrincipal > 0)
      .sort((a, b) => parseISO(a.nextDueDate!).getTime() - parseISO(b.nextDueDate!).getTime());

    let nextActionMessage;
    if (activeLoansWithDueDates.length > 0) {
      const nextLoanAction = activeLoansWithDueDates[0];
      nextActionMessage = `Next EMI for '${nextLoanAction.name}' due ${formatDate(nextLoanAction.nextDueDate!)}.`;
    } else if (loanSummaries.every(s => s.currentPrincipal === 0)) {
      nextActionMessage = "All loans are paid off! 🎉";
    } else {
      nextActionMessage = "No upcoming EMIs found for active loans. Check loan details.";
    }
    
    return {
      totalBorrowed,
      totalRepaidSoFar,
      averageInterestRate: parseFloat(averageInterestRate.toFixed(2)),
      overallProgressPercentage: parseFloat(overallProgressPercentage.toFixed(2)),
      nextActionMessage,
    };
  }, [loanSummaries]);

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
    return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline tracking-tight">
            Welcome, {user?.displayName || user?.email?.split('@')[0] || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s an overview of your loans.
          </p>
        </div>
        <Link href="/loans/add" legacyBehavior>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Loan
          </Button>
        </Link>
      </div>

      {/* New Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <Card className="lg:col-span-1 shadow-lg bg-card flex flex-col items-center p-6 rounded-xl">
          <Avatar className="w-24 h-24 mb-3 ring-2 ring-primary/50 ring-offset-2 ring-offset-card">
            <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} data-ai-hint="profile person" />
            <AvatarFallback className="text-3xl bg-muted">
              {user?.displayName ? getInitials(user.displayName) : (user?.email ? user.email.substring(0,2).toUpperCase() : <UserIcon />)}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-semibold text-card-foreground">{user?.displayName || 'User Name'}</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </Card>

        {/* Stats Cards Container */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card className="shadow-md rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <TrendingDown className="mr-2 h-4 w-4 text-destructive" /> Borrowed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(dashboardStats.totalBorrowed)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-md rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <TrendingUpIcon className="mr-2 h-4 w-4 text-green-500" /> Repaid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(dashboardStats.totalRepaidSoFar)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-md rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Percent className="mr-2 h-4 w-4 text-blue-500" /> Average Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{dashboardStats.averageInterestRate}%</p>
            </CardContent>
          </Card>
           <Card className="shadow-md rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Activity className="mr-2 h-4 w-4 text-purple-500" /> Overall Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
                <Progress value={dashboardStats.overallProgressPercentage} className="h-3 mb-2" />
                <p className="text-sm font-semibold text-center">{dashboardStats.overallProgressPercentage.toFixed(2)}% <span className="text-xs text-muted-foreground">repaid</span></p>
            </CardContent>
          </Card>
          <Card className="sm:col-span-2 shadow-md rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                 <ListChecks className="mr-2 h-4 w-4 text-orange-500" /> Next Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm">{dashboardStats.nextActionMessage}</p>
            </CardContent>
          </Card>
        </div>
      </div>


      {loanSummaries.length > 0 && (
        <Alert className="mb-6 shadow-md">
          <Info className="h-4 w-4" />
          <AlertTitle>Loan Summary Information</AlertTitle>
          <AlertDescription>
            The loan summaries and overall statistics displayed on this dashboard are based on original loan terms and any &apos;amount already paid&apos; at the start.
            They do not yet reflect individually recorded prepayments. For the most up-to-date figures including all prepayments,
            please view the specific loan&apos;s detail page.
          </AlertDescription>
        </Alert>
      )}
      
      {loanSummaries.length === 0 && !isLoading && (
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">
              Get Started with LoanPilot
            </CardTitle>
            <CardDescription>
              Add your first loan to begin tracking your progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <FinancialPlanningIllustration className="mb-6 rounded-md" width={300} height={200} />
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
      
      {loanSummaries.length > 0 && (
        <>
          <h2 className="text-2xl font-headline tracking-tight mt-10">Active Loans ({loanSummaries.length})</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {loanSummaries.map((summary) => (
              <Link key={summary.id} href={`/loans/${summary.id}`} legacyBehavior passHref>
                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer h-full flex flex-col rounded-xl">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className="font-headline text-xl">{summary.name}</CardTitle>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {summary.interestRate}% APR
                      </span>
                    </div>
                    <CardDescription>
                      Next payment due: {summary.nextDueDate ? formatDate(summary.nextDueDate) : (summary.status.currentBalance === 0 ? 'Paid Off' : 'N/A')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 flex-grow">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pending Balance:</span>
                      <span className="font-semibold">{formatCurrency(summary.currentPrincipal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monthly EMI:</span>
                      <span className="font-semibold">{formatCurrency(summary.monthlyEMI)}</span>
                    </div>
                    <div>
                      <Progress value={summary.completedPercentage} className="h-3 mt-1" />
                      <p className="text-xs text-muted-foreground mt-1 text-right">
                        {summary.completedPercentage.toFixed(2)}% paid
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

    </div>
  );
}
    

    

    

    

    

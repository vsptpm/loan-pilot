
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, TrendingUp, ListChecks, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import type { Loan } from '@/types';
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
import { parseISO, addMonths } from 'date-fns';

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
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // chartData and kpis state remain for the "Fetch Latest Data" button, not implemented in this change.
  const [chartData, setChartData] = useState(null); 
  const [kpisData, setKpisData] = useState(null);

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
      };
    });
  }, [loans]);

  const overallStats = useMemo(() => {
    if (loanSummaries.length === 0) {
      return {
        totalOutstanding: 0,
        overallPercentagePaid: 0,
        nextActionDueDate: null,
        nextActionLoanName: null,
      };
    }

    const totalOriginalPrincipal = loanSummaries.reduce((sum, s) => sum + s.originalLoan.principalAmount, 0);
    const totalOutstanding = loanSummaries.reduce((sum, s) => sum + s.currentPrincipal, 0);
    const totalPaid = totalOriginalPrincipal - totalOutstanding;
    const overallPercentagePaid = totalOriginalPrincipal > 0 ? (totalPaid / totalOriginalPrincipal) * 100 : 0;

    let earliestDueDate: Date | null = null;
    let nextActionLoanName: string | null = null;

    loanSummaries.forEach(summary => {
      if (summary.nextDueDate) {
        const dueDate = parseISO(summary.nextDueDate);
        if (!earliestDueDate || dueDate < earliestDueDate) {
          earliestDueDate = dueDate;
          nextActionLoanName = summary.name;
        }
      }
    });

    return {
      totalOutstanding,
      overallPercentagePaid: parseFloat(overallPercentagePaid.toFixed(2)),
      nextActionDueDate: earliestDueDate ? formatDate(earliestDueDate) : null,
      nextActionLoanName: nextActionLoanName,
    };
  }, [loanSummaries]);


  const fetchAnalyticsData = () => {
    // Placeholder for fetching detailed analytics data, not part of this change
    toast({ title: "Analytics", description: "Fetching latest analytics data (Not yet implemented)." });
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
          <h1 className="text-3xl font-headline tracking-tight">
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
            <Image
              src="https://placehold.co/300x200.png"
              alt="Empty state illustration"
              width={300}
              height={200}
              className="mb-6 rounded-md"
              data-ai-hint="financial planning illustration"
            />
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
        {loanSummaries.map((summary) => (
          <Card key={summary.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="font-headline text-xl">{summary.name}</CardTitle>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {summary.interestRate}% APR
                </span>
              </div>
              <CardDescription>
                Next payment due: {summary.nextDueDate ? formatDate(summary.nextDueDate) : 'N/A'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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
                  {summary.completedPercentage}% paid
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Link href={`/loans/${summary.id}`} legacyBehavior passHref>
                <Button variant="outline" className="w-full">
                  View Details
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      {loanSummaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <TrendingUp className="mr-2 h-5 w-5 text-accent" />
                Overall Progress
              </CardTitle>
              <CardDescription>
                A summary of your combined loan repayment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Total Outstanding: {formatCurrency(overallStats.totalOutstanding)}</p>
              <p className="text-muted-foreground">Overall % Paid: {overallStats.overallPercentagePaid}%</p>
              <Progress value={overallStats.overallPercentagePaid} className="h-4 mt-2" />
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <ListChecks className="mr-2 h-5 w-5 text-accent" />
                Next Actions
              </CardTitle>
              <CardDescription>
                Upcoming due dates and important tasks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {overallStats.nextActionDueDate && overallStats.nextActionLoanName ? (
                  <li className="flex items-center">
                    <span className="mr-2 h-2 w-2 rounded-full bg-primary"></span>
                    Pay {overallStats.nextActionLoanName} EMI by {overallStats.nextActionDueDate}
                  </li>
                ) : (
                   <li className="flex items-center text-muted-foreground">
                     No upcoming payments or all loans paid off.
                   </li>
                )}
                 <li className="flex items-center">
                    <span className="mr-2 h-2 w-2 rounded-full bg-primary/50"></span>
                    Review loan details for prepayment opportunities.
                  </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Section - remains as placeholder for now */}
      {loanSummaries.length > 0 && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl font-headline tracking-tight">
              Loan Analytics
            </h2>
            <Button onClick={fetchAnalyticsData} variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" /> Fetch Latest Data
            </Button>
          </div>

          {/* KPIs Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Total Loans</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{loanSummaries.length}</p>
              </CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Total Outstanding Principal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{formatCurrency(overallStats.totalOutstanding)}</p>
              </CardContent>
            </Card>
            {/* Add more KPI cards as needed */}
          </div>

          {/* Charts Section */}
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-xl font-headline">Loan Balance Over Time</CardTitle></CardHeader>
            <CardContent><div className="h-64 bg-muted/30 dark:bg-muted/20 rounded-md flex items-center justify-center text-muted-foreground">Line Chart Placeholder</div></CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader><CardTitle className="text-xl font-headline">Loan Distribution by Type</CardTitle></CardHeader>
              <CardContent><div className="h-64 bg-muted/30 dark:bg-muted/20 rounded-md flex items-center justify-center text-muted-foreground">Pie Chart Placeholder</div></CardContent>
            </Card>
            <Card className="shadow-lg">
              <CardHeader><CardTitle className="text-xl font-headline">Monthly Payments Overview</CardTitle></CardHeader>
              <CardContent><div className="h-64 bg-muted/30 dark:bg-muted/20 rounded-md flex items-center justify-center text-muted-foreground">Bar Chart Placeholder</div></CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
    
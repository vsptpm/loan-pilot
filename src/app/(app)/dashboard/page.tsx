
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, TrendingUp, ListChecks, Loader2, PieChart as PieChartIcon, BarChart2, LineChart as LineChartIcon } from 'lucide-react';
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
import { parseISO, addMonths, differenceInMonths, format, getYear, getMonth } from 'date-fns';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend as RechartsLegend,
  LabelList
} from 'recharts';


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

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#A8DADC', '#457B9D'
];


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
    const totalOutstanding = loanSummaries.reduce((sum, s) => sum + s.status.currentBalance, 0); // Use currentBalance from status
    const totalPaid = totalOriginalPrincipal - totalOutstanding; // This might be an oversimplification if amountAlreadyPaid reduces principal before schedule generation
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

  const loanBalanceOverTimeData = useMemo(() => {
    if (loanSummaries.length === 0) return [];
    const data: { month: string; totalBalance: number }[] = [];
    const today = new Date();
    const startDate = addMonths(today, -12); // 12 months in the past
    const endDate = addMonths(today, 24); // 24 months in the future
    const numMonths = differenceInMonths(endDate, startDate) + 1;

    for (let i = 0; i < numMonths; i++) {
      const currentDate = addMonths(startDate, i);
      let monthBalance = 0;
      loanSummaries.forEach(summary => {
        const paidEMIsSoFar = summary.schedule.filter(e => e.isPaid || (e.paymentDate && parseISO(e.paymentDate) <= currentDate)).length;
        const entry = summary.schedule[paidEMIsSoFar -1];
        if (entry && entry.paymentDate && parseISO(entry.paymentDate) <= currentDate) {
             monthBalance += entry.remainingBalance;
        } else if (summary.schedule.length > 0 && parseISO(summary.schedule[0].paymentDate) > currentDate) {
            // If current date is before the first payment date of the loan
            monthBalance += summary.originalLoan.principalAmount - summary.originalLoan.amountAlreadyPaid;
        } else if(summary.status.currentBalance > 0 && paidEMIsSoFar === 0) {
            monthBalance += summary.status.currentBalance; // If no EMIs are paid yet, use current balance
        }
      });
      data.push({
        month: format(currentDate, 'MMM yy'),
        totalBalance: parseFloat(monthBalance.toFixed(2)),
      });
    }
    return data.filter(d => d.totalBalance > 0 || data.some(other => other.totalBalance > 0)); // Only show if there's some balance
  }, [loanSummaries]);

  const loanPrincipalDistributionData = useMemo(() => {
    if (loanSummaries.length === 0 || overallStats.totalOutstanding === 0) return [];
    return loanSummaries
      .filter(summary => summary.status.currentBalance > 0)
      .map((summary, index) => ({
        name: summary.name,
        value: parseFloat(summary.status.currentBalance.toFixed(2)),
        fill: CHART_COLORS[index % CHART_COLORS.length],
      }));
  }, [loanSummaries, overallStats.totalOutstanding]);

  const upcomingMonthlyPaymentsData = useMemo(() => {
    if (loanSummaries.length === 0) return [];
    const data: { month: string; totalEMI: number }[] = [];
    const today = new Date();
    const numMonths = 12;

    for (let i = 0; i < numMonths; i++) {
      const targetMonthDate = addMonths(today, i);
      const targetYear = getYear(targetMonthDate);
      const targetMonth = getMonth(targetMonthDate);
      let monthEMI = 0;

      loanSummaries.forEach(summary => {
        if (summary.status.currentBalance > 0) {
          const nextPayment = summary.schedule.find(
            e => !e.isPaid && e.paymentDate && parseISO(e.paymentDate) >= today && getYear(parseISO(e.paymentDate)) === targetYear && getMonth(parseISO(e.paymentDate)) === targetMonth
          );
          if (nextPayment) {
            monthEMI += nextPayment.payment;
          }
        }
      });
      if (monthEMI > 0) {
        data.push({
          month: format(targetMonthDate, 'MMM yy'),
          totalEMI: parseFloat(monthEMI.toFixed(2)),
        });
      }
    }
    return data;
  }, [loanSummaries]);


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

      {loanSummaries.length > 0 && (
        <div className="mt-8 space-y-8">
          <h2 className="text-2xl font-headline tracking-tight">Loan Analytics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline flex items-center">
                  <LineChartIcon className="mr-2 h-5 w-5 text-accent" />
                  Loan Balance Over Time
                </CardTitle>
                <CardDescription>Projected total outstanding balance.</CardDescription>
              </CardHeader>
              <CardContent>
                {loanBalanceOverTimeData.length > 0 ? (
                  <ChartContainer config={{totalBalance: {label: "Total Balance", color: "hsl(var(--chart-1))"}}} className="h-[300px] w-full">
                    <LineChart data={loanBalanceOverTimeData} margin={{left: 12, right: 12, top:5, bottom: 5}}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickFormatter={(value) => `₹${value/1000}k`} />
                      <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                      <Line dataKey="totalBalance" type="monotone" stroke="var(--color-totalBalance)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-10">Not enough data to display balance over time.</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="font-headline flex items-center">
                  <PieChartIcon className="mr-2 h-5 w-5 text-accent" />
                  Loan Principal Distribution
                </CardTitle>
                <CardDescription>Breakdown of current outstanding principal by loan.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                {loanPrincipalDistributionData.length > 0 ? (
                   <ChartContainer config={loanPrincipalDistributionData.reduce((acc, cur) => {acc[cur.name] = {label: cur.name, color: cur.fill}; return acc;}, {} as any)} className="h-[300px] w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" hideIndicator />} />
                      <Pie data={loanPrincipalDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false}>
                        {loanPrincipalDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                         <LabelList
                            dataKey="name"
                            className="fill-background text-xs"
                            stroke="none"
                            formatter={(value: string) => value.length > 10 ? `${value.substring(0,10)}...` : value}
                          />
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-10">No outstanding loans to display distribution.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <BarChart2 className="mr-2 h-5 w-5 text-accent" />
                Upcoming Monthly Payments
              </CardTitle>
              <CardDescription>Total EMI payments due in the upcoming months.</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingMonthlyPaymentsData.length > 0 ? (
                <ChartContainer config={{totalEMI: {label: "Total EMI", color: "hsl(var(--chart-2))"}}} className="h-[300px] w-full">
                  <BarChart data={upcomingMonthlyPaymentsData} margin={{left: 12, right: 12, top:5, bottom: 5}}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickFormatter={(value) => `₹${value/1000}k`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="totalEMI" fill="var(--color-totalEMI)" radius={4} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-muted-foreground text-center py-10">No upcoming payments or data available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

    
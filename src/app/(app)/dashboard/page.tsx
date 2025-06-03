
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, TrendingUp, ListChecks, Loader2, LineChartIcon, PieChartIcon, BarChartIcon } from 'lucide-react';
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
import { parseISO, addMonths, format, subMonths, getMonth, getYear, startOfMonth, isBefore, isAfter, isEqual } from 'date-fns';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts"

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

const defaultChartConfig = {
  totalBalance: {
    label: "Total Balance",
    color: "hsl(var(--chart-1))",
  },
  totalEMI: {
    label: "Total EMI",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const pieChartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
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

  const loanBalanceOverTimeData = useMemo(() => {
    if (loans.length === 0) return [];
    const dataPoints: { month: string, totalBalance: number }[] = [];
    const currentDate = new Date();
    const startDate = subMonths(startOfMonth(currentDate), 12); // 12 months in past
    const endDate = addMonths(startOfMonth(currentDate), 24); // 24 months in future

    let iterDate = startDate;
    while (isBefore(iterDate, endDate) || isEqual(iterDate, endDate)) {
      let monthTotalBalance = 0;
      loans.forEach(loan => {
        const loanStartDate = parseISO(loan.startDate);
        const loanEndDate = addMonths(loanStartDate, loan.durationMonths);
        
        if (isAfter(iterDate, loanEndDate) || isBefore(iterDate, startOfMonth(loanStartDate))) {
          // Loan not active in this month or ended
           if (isBefore(iterDate, startOfMonth(loanStartDate))) {
             // If iterDate is before the loan even starts, consider its full principal if it wasn't paid down by amountAlreadyPaid
             // This logic might need refinement if amountAlreadyPaid significantly reduces principal before first EMI
             const emiForInitialCalc = calculateEMI(loan.principalAmount, loan.interestRate, loan.durationMonths);
             const initialPaidEMIs = getInitialPaidEMIsCount(loan.amountAlreadyPaid, emiForInitialCalc);
             if(initialPaidEMIs === 0) monthTotalBalance += (loan.principalAmount - loan.amountAlreadyPaid);

           } else {
             // Loan ended, balance is 0
           }
        } else {
          const emi = calculateEMI(loan.principalAmount, loan.interestRate, loan.durationMonths);
          const initialPaidEMIs = getInitialPaidEMIsCount(loan.amountAlreadyPaid, emi);
          const schedule = generateAmortizationSchedule(loan.principalAmount, loan.interestRate, loan.durationMonths, loan.startDate, initialPaidEMIs);
          
          // Find the latest schedule entry on or before iterDate for this loan
          let applicableEntry = null;
          for (let i = schedule.length - 1; i >= 0; i--) {
            const entryPaymentDate = parseISO(schedule[i].paymentDate);
            if (isBefore(entryPaymentDate, iterDate) || isEqual(entryPaymentDate, iterDate)) {
              applicableEntry = schedule[i];
              break;
            }
          }
          if (applicableEntry) {
            monthTotalBalance += applicableEntry.remainingBalance;
          } else {
             // Before first payment, but after loan start, consider principal less amountAlreadyPaid if not covered by EMIs
            const emiForInitialCalc = calculateEMI(loan.principalAmount, loan.interestRate, loan.durationMonths);
            const initialPaidEMIsForThisLoan = getInitialPaidEMIsCount(loan.amountAlreadyPaid, emiForInitialCalc);
            if(initialPaidEMIsForThisLoan === 0) {
                 monthTotalBalance += (loan.principalAmount - loan.amountAlreadyPaid);
            } else {
                // If amountAlreadyPaid covers some EMIs, and we are before the first *actual* payment date
                // but after loan start, the balance is from the schedule before any payment is made.
                // This edge case might need very precise handling if first payment is far from startDate.
                // For simplicity, we assume the schedule's first entry or principal - amountAlreadyPaid.
                if(schedule.length > 0) {
                    const firstBalance = schedule[0].remainingBalance; // this is after first EMI
                    // Need balance *before* first EMI.
                    monthTotalBalance += (loan.principalAmount - loan.amountAlreadyPaid); 
                } else {
                    monthTotalBalance += (loan.principalAmount - loan.amountAlreadyPaid);
                }
            }

          }
        }
      });
      dataPoints.push({ month: format(iterDate, 'MMM yy'), totalBalance: monthTotalBalance });
      iterDate = addMonths(iterDate, 1);
    }
    return dataPoints.filter(dp => dp.totalBalance > 0 || dataPoints.some(p => p.totalBalance > 0) ); // Only show if there's some balance
  }, [loans]);

  const loanPrincipalDistributionData = useMemo(() => {
    if (loanSummaries.length === 0) return [];
    return loanSummaries.map((summary, index) => ({
      name: summary.name,
      value: summary.currentPrincipal,
      fill: pieChartColors[index % pieChartColors.length],
    })).filter(item => item.value > 0); // Only include loans with outstanding principal
  }, [loanSummaries]);

  const pieChartCustomConfig = useMemo(() => {
    const config: ChartConfig = {};
    loanPrincipalDistributionData.forEach((item) => {
      config[item.name] = { // Use item.name which is unique loan name
        label: item.name,
        color: item.fill,
      };
    });
    return config;
  }, [loanPrincipalDistributionData]);


  const upcomingMonthlyPaymentsData = useMemo(() => {
    if (loans.length === 0) return [];
    const data: { month: string, totalEMI: number }[] = [];
    const currentDate = new Date();

    for (let i = 0; i < 12; i++) { // Next 12 months
      const targetMonthDate = addMonths(currentDate, i);
      const monthKey = format(targetMonthDate, 'MMM yy');
      let monthTotalEMI = 0;

      loans.forEach(loan => {
        const emi = calculateEMI(loan.principalAmount, loan.interestRate, loan.durationMonths);
        const initialPaidEMIs = getInitialPaidEMIsCount(loan.amountAlreadyPaid, emi);
        const schedule = generateAmortizationSchedule(loan.principalAmount, loan.interestRate, loan.durationMonths, loan.startDate, initialPaidEMIs);

        const paymentInMonth = schedule.find(entry => {
          const paymentDate = parseISO(entry.paymentDate);
          // Check if paymentDate falls within the target month
          return getYear(paymentDate) === getYear(targetMonthDate) && getMonth(paymentDate) === getMonth(targetMonthDate);
        });

        if (paymentInMonth && !paymentInMonth.isPaid) {
             // Check if this EMI is after amountAlreadyPaid coverage
            if (paymentInMonth.month > initialPaidEMIs) {
                 monthTotalEMI += paymentInMonth.payment;
            }
        }
      });
      if (monthTotalEMI > 0) { // Only add month if there's an EMI
        data.push({ month: monthKey, totalEMI: monthTotalEMI });
      }
    }
    return data;
  }, [loans]);


  const fetchAnalyticsData = () => {
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

      {loanSummaries.length > 0 && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-2xl font-headline tracking-tight">
              Loan Analytics
            </h2>
            {/* <Button onClick={fetchAnalyticsData} variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" /> Fetch Latest Data
            </Button> */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
             <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Overall Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{overallStats.overallPercentagePaid}%</p>
                 <Progress value={overallStats.overallPercentagePaid} className="h-3 mt-2" />
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center">
                    <LineChartIcon className="mr-2 h-5 w-5 text-accent" /> Loan Balance Over Time
                </CardTitle>
                <CardDescription>Projected total outstanding balance over the next 24 months and past 12 months.</CardDescription>
            </CardHeader>
            <CardContent>
              {loanBalanceOverTimeData.length > 0 ? (
                <ChartContainer config={defaultChartConfig} className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={loanBalanceOverTimeData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickFormatter={(value) => formatCurrency(value).replace('₹','')} tickLine={false} axisLine={false} width={80} />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent 
                                  formatter={(value) => formatCurrency(value as number)} 
                                  indicator="line" />}
                      />
                      <Line dataKey="totalBalance" type="monotone" stroke="var(--color-totalBalance)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <div className="h-64 bg-muted/30 dark:bg-muted/20 rounded-md flex items-center justify-center text-muted-foreground">No data available for balance projection.</div>
              )}
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center">
                    <PieChartIcon className="mr-2 h-5 w-5 text-accent" /> Loan Principal Distribution
                </CardTitle>
                <CardDescription>Current outstanding principal distribution by loan.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                {loanPrincipalDistributionData.length > 0 ? (
                  <ChartContainer config={pieChartCustomConfig} className="h-[300px] w-full max-w-[400px]">
                     <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent 
                                    hideLabel 
                                    formatter={(value, name) => `${name}: ${formatCurrency(value as number)}`}
                                    />}
                        />
                        <Pie data={loanPrincipalDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} 
                             label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                                const RADIAN = Math.PI / 180;
                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                return (percent * 100) > 5 ? ( // Only show label if percent is > 5%
                                  <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10px">
                                    {`${(percent * 100).toFixed(0)}%`}
                                  </text>
                                ) : null;
                              }}>
                          {loanPrincipalDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                         <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-64 bg-muted/30 dark:bg-muted/20 rounded-md flex items-center justify-center text-muted-foreground w-full">No loans with outstanding balance.</div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-headline flex items-center">
                    <BarChartIcon className="mr-2 h-5 w-5 text-accent" /> Upcoming Monthly Payments
                </CardTitle>
                <CardDescription>Total EMIs due in the upcoming months.</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingMonthlyPaymentsData.length > 0 ? (
                  <ChartContainer config={defaultChartConfig} className="h-[300px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={upcomingMonthlyPaymentsData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8}/>
                        <YAxis tickFormatter={(value) => formatCurrency(value).replace('₹','')} tickLine={false} axisLine={false} width={80} />
                         <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent 
                                      formatter={(value) => formatCurrency(value as number)} 
                                      indicator="dashed" />}
                          />
                        <Bar dataKey="totalEMI" fill="var(--color-totalEMI)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-64 bg-muted/30 dark:bg-muted/20 rounded-md flex items-center justify-center text-muted-foreground">No upcoming EMIs or all loans paid off.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

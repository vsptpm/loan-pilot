
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import type { Loan, AmortizationEntry } from '@/types';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
} from 'firebase/firestore';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { generateAmortizationSchedule as generateRepaymentSchedule } from '@/lib/loanUtils';
import { LineChart as LineChartIcon, BarChart3 as BarChartIcon, Loader2 } from 'lucide-react';
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from 'recharts';

export default function LoanDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLoan = async (loanId: string) => {
    if (!user) return;
    try {
      const loanDocRef = doc(db, `users/${user.uid}/loans`, loanId);
      const loanDocSnap = await getDoc(loanDocRef);

      if (loanDocSnap.exists()) {
        setLoan({ id: loanDocSnap.id, ...loanDocSnap.data() } as Loan);
      } else {
        toast({
          title: 'Error',
          description: 'Loan not found.',
          variant: 'destructive',
        });
        router.push('/loans');
      }
    } catch (error) {
      console.error('Error fetching loan:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch loan details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && user) {
      const loanId = Array.isArray(id) ? id[0] : id;
      fetchLoan(loanId);
    }
  }, [id, user, router, toast]); // Removed toast from here if fetchLoan handles it. Re-added as fetchLoan uses it.

  const originalSchedule: AmortizationEntry[] = useMemo(() => {
    if (!loan) return [];
    return generateRepaymentSchedule(
      loan.principalAmount,
      loan.interestRate,
      loan.durationMonths,
      loan.startDate,
    );
  }, [loan]);

  const remainingBalanceChartData = useMemo(() => {
    if (!originalSchedule || originalSchedule.length === 0) return [];
    return originalSchedule.map(entry => ({
      month: `Month ${entry.month}`,
      balance: entry.remainingBalance,
    }));
  }, [originalSchedule]);

  const principalInterestChartData = useMemo(() => {
    if (!originalSchedule || originalSchedule.length === 0) return [];
    return originalSchedule.map(entry => ({
      month: `Month ${entry.month}`,
      principal: entry.principalPaid,
      interest: entry.interestPaid,
    }));
  }, [originalSchedule]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading loan details...</p>
      </div>
    );
  }

  if (!loan) {
    return null;
  }
  
  const chartConfigBalance = {
    balance: {
      label: "Balance",
      color: "hsl(var(--chart-1))",
    },
  };

  const chartConfigPrincipalInterest = {
    principal: {
      label: "Principal",
      color: "hsl(var(--chart-1))",
    },
    interest: {
      label: "Interest",
      color: "hsl(var(--chart-2))",
    },
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">{loan.name}</CardTitle>
          <CardDescription>Detailed overview of your loan.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
                <div className="flex justify-between">
                <span className="text-muted-foreground">Principal Amount:</span>
                <span className="font-medium">{formatCurrency(loan.principalAmount)}</span>
                </div>
                <div className="flex justify-between">
                <span className="text-muted-foreground">Annual Interest Rate:</span>
                <span className="font-medium">{loan.interestRate}%</span>
                </div>
                <div className="flex justify-between">
                <span className="text-muted-foreground">Loan Term:</span>
                <span className="font-medium">{loan.durationMonths} months</span>
                </div>
            </div>
            <div className="space-y-3">
                <div className="flex justify-between">
                <span className="text-muted-foreground">Start Date:</span>
                <span className="font-medium">{formatDate(loan.startDate)}</span>
                </div>
                <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Initially Paid:</span>
                <span className="font-medium">{formatCurrency(loan.amountAlreadyPaid)}</span>
                </div>
                {/* Add more relevant loan details here if needed */}
            </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Original Repayment Schedule</CardTitle>
          <CardDescription>The projected repayment plan for this loan based on its original terms.</CardDescription>
        </CardHeader>
        <CardContent>
          {originalSchedule.length > 0 ? (
            <div className="max-h-[calc(theme(spacing.96)_+_theme(spacing.12))] overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Month</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {originalSchedule.map((entry) => (
                    <TableRow key={entry.month} className={entry.isPaid ? 'bg-primary/5' : ''}>
                      <TableCell>{entry.month}</TableCell>
                      <TableCell>{formatDate(entry.paymentDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.payment)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.principalPaid)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.interestPaid)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.remainingBalance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">No repayment schedule available for this loan.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Loan Visualizations</CardTitle>
          <CardDescription>Visual breakdown of your loan repayment.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-3 sm:pt-4 md:pt-6">
          <div className="space-y-2">
            <h3 className="text-lg font-headline flex items-center justify-center">
              <LineChartIcon className="mr-2 h-5 w-5 text-accent" />
              Remaining Balance Over Time
            </h3>
            {remainingBalanceChartData.length > 0 ? (
              <ChartContainer config={chartConfigBalance} className="h-[250px] sm:h-[300px] w-full">
                <LineChart data={remainingBalanceChartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `₹${value/1000}k`} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <Line type="monotone" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">Not enough data for balance chart.</p>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-headline flex items-center justify-center">
              <BarChartIcon className="mr-2 h-5 w-5 text-accent" />
              Principal vs. Interest per EMI
            </h3>
            {principalInterestChartData.length > 0 ? (
              <ChartContainer config={chartConfigPrincipalInterest} className="h-[250px] sm:h-[300px] w-full">
                <BarChart data={principalInterestChartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `₹${value/1000}k`} tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="principal" stackId="a" fill="var(--color-principal)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="interest" stackId="a" fill="var(--color-interest)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">Not enough data for principal/interest chart.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

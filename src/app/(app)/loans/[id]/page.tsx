
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import type { Loan, AmortizationEntry } from '@/types';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
} from 'firebase/firestore';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  generateAmortizationSchedule as generateRepaymentSchedule,
  simulatePrepayment,
  calculateTotalInterest,
  getInitialPaidEMIsCount,
} from '@/lib/loanUtils';
import { LineChart as LineChartIcon, BarChart3 as BarChartIcon, Loader2, TrendingUp, Calculator } from 'lucide-react';
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
import { parseISO } from 'date-fns';


interface SimulationResults {
  newClosureDate: string | null;
  interestSaved: number;
  originalTotalInterest: number;
  newTotalInterest: number;
  simulatedSchedule: AmortizationEntry[];
  oldClosureDate: string | null;
}


export default function LoanDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [prepaymentPercentage, setPrepaymentPercentage] = useState('');
  const [prepaymentAfterMonth, setPrepaymentAfterMonth] = useState('');
  const [simulationResults, setSimulationResults] = useState<SimulationResults | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);


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
  }, [id, user]);

  const originalSchedule: AmortizationEntry[] = useMemo(() => {
    if (!loan) return [];
    const initialPaidEMIs = getInitialPaidEMIsCount(loan.amountAlreadyPaid, 0); // EMI will be calc inside
    return generateRepaymentSchedule(
      loan.principalAmount - (initialPaidEMIs > 0 ? 0 : loan.amountAlreadyPaid), // Reduce principal if amountAlreadyPaid is not N EMIs
      loan.interestRate,
      loan.durationMonths,
      loan.startDate,
      initialPaidEMIs
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

  const handleSimulatePrepayment = () => {
    if (!loan || originalSchedule.length === 0) {
      toast({ title: "Error", description: "Loan data not available for simulation.", variant: "destructive" });
      return;
    }

    const percentage = parseFloat(prepaymentPercentage);
    const afterMonth = parseInt(prepaymentAfterMonth, 10);

    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      toast({ title: "Invalid Input", description: "Please enter a valid prepayment percentage (1-100).", variant: "destructive" });
      return;
    }
    if (isNaN(afterMonth) || afterMonth < 0 || afterMonth > originalSchedule.length) {
      // allow 0 for prepayment before any EMI
      toast({ title: "Invalid Input", description: `Prepayment month must be between 0 and ${originalSchedule.length}.`, variant: "destructive" });
      return;
    }

    setIsSimulating(true);

    let principalAtPrepaymentTime: number;
    if (afterMonth === 0) {
        principalAtPrepaymentTime = loan.principalAmount - loan.amountAlreadyPaid;
    } else {
        const entryBeforePrepayment = originalSchedule[afterMonth -1];
        if(!entryBeforePrepayment) {
            toast({title: "Error", description: "Invalid month for prepayment.", variant: "destructive"});
            setIsSimulating(false);
            return;
        }
        principalAtPrepaymentTime = entryBeforePrepayment.remainingBalance;
    }

    if (principalAtPrepaymentTime <= 0) {
        toast({ title: "Loan Cleared", description: "Loan balance is already zero or negative at the selected point.", variant: "default" });
        setIsSimulating(false);
        setSimulationResults({
            newClosureDate: originalSchedule[afterMonth-1]?.paymentDate || loan.startDate,
            interestSaved: 0,
            originalTotalInterest: calculateTotalInterest(originalSchedule),
            newTotalInterest: calculateTotalInterest(originalSchedule.slice(0, afterMonth)),
            simulatedSchedule: originalSchedule.slice(0, afterMonth),
            oldClosureDate: originalSchedule[originalSchedule.length-1]?.paymentDate || null,
        });
        return;
    }

    const prepaymentAmountValue = parseFloat(((percentage / 100) * principalAtPrepaymentTime).toFixed(2));
    
    if (prepaymentAmountValue <=0) {
        toast({ title: "Invalid Prepayment", description: "Calculated prepayment amount is zero or less.", variant: "destructive" });
        setIsSimulating(false);
        return;
    }


    const simulatedSchedule = simulatePrepayment(
      loan, // Pass the full loan object for context if needed by simulatePrepayment
      originalSchedule,
      prepaymentAmountValue,
      afterMonth
    );

    const originalTotalInterest = calculateTotalInterest(originalSchedule);
    const newTotalInterest = calculateTotalInterest(simulatedSchedule);
    const interestSaved = parseFloat((originalTotalInterest - newTotalInterest).toFixed(2));
    
    const newClosureDate = simulatedSchedule.length > 0 ? simulatedSchedule[simulatedSchedule.length - 1].paymentDate : null;
    const oldClosureDate = originalSchedule.length > 0 ? originalSchedule[originalSchedule.length - 1].paymentDate : null;

    setSimulationResults({
      newClosureDate,
      interestSaved,
      originalTotalInterest,
      newTotalInterest,
      simulatedSchedule,
      oldClosureDate,
    });
    setIsSimulating(false);
    toast({ title: "Simulation Complete", description: "Prepayment impact calculated." });
  };


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
            </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center">
             <Calculator className="mr-2 h-5 w-5 text-accent" />
            Prepayment Simulator
          </CardTitle>
          <CardDescription>See how a prepayment could affect your loan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prepaymentPercentage">Prepayment Percentage (%)</Label>
              <Input
                id="prepaymentPercentage"
                type="number"
                placeholder="e.g., 10"
                value={prepaymentPercentage}
                onChange={(e) => setPrepaymentPercentage(e.target.value)}
                disabled={isSimulating}
              />
              <p className="text-xs text-muted-foreground">Enter percentage of outstanding balance to prepay.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prepaymentAfterMonth">Prepayment After EMI Number</Label>
              <Input
                id="prepaymentAfterMonth"
                type="number"
                placeholder="e.g., 6 (or 0 for start)"
                value={prepaymentAfterMonth}
                onChange={(e) => setPrepaymentAfterMonth(e.target.value)}
                disabled={isSimulating}
              />
              <p className="text-xs text-muted-foreground">Enter 0 to simulate prepayment before any EMIs.</p>
            </div>
          </div>
          <Button onClick={handleSimulatePrepayment} disabled={isSimulating || !loan} className="w-full sm:w-auto">
            {isSimulating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
            Simulate Prepayment
          </Button>

          {simulationResults && (
            <div className="mt-6 p-4 border rounded-md bg-muted/50 space-y-3">
              <h3 className="text-lg font-semibold font-headline">Simulation Results:</h3>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Estimated Closure Date:</span>
                <span className="font-medium">{simulationResults.oldClosureDate ? formatDate(simulationResults.oldClosureDate) : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Estimated Closure Date:</span>
                <span className="font-medium text-primary">{simulationResults.newClosureDate ? formatDate(simulationResults.newClosureDate) : 'N/A'}</span>
              </div>
               <div className="flex justify-between">
                <span className="text-muted-foreground">Original Total Interest:</span>
                <span className="font-medium">{formatCurrency(simulationResults.originalTotalInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Total Interest:</span>
                <span className="font-medium">{formatCurrency(simulationResults.newTotalInterest)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-muted-foreground">Total Interest Saved:</span>
                <span className="font-semibold text-green-600 dark:text-green-500">{formatCurrency(simulationResults.interestSaved)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                Note: This simulation assumes your monthly EMI payment remains the same, and the loan term is reduced by the prepayment.
              </p>
            </div>
          )}
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


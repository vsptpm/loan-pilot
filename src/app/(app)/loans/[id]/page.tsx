
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/hooks/useAuth';
import type { Loan, AmortizationEntry } from '@/types';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
} from 'firebase/firestore';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  generateAmortizationSchedule as generateRepaymentSchedule,
  simulatePrepayment,
  calculateTotalInterest,
  getInitialPaidEMIsCount,
} from '@/lib/loanUtils';
import { LineChart as LineChartIcon, BarChart3 as BarChartIcon, Loader2, TrendingUp, Calculator, ChevronsUpDown, Check } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { parseISO, format } from 'date-fns';


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

  const [prepaymentInputType, setPrepaymentInputType] = useState<'percentage' | 'amount'>('percentage');
  const [prepaymentPercentage, setPrepaymentPercentage] = useState('');
  const [prepaymentCustomAmount, setPrepaymentCustomAmount] = useState('');
  const [prepaymentAfterMonth, setPrepaymentAfterMonth] = useState('');
  const [simulationResults, setSimulationResults] = useState<SimulationResults | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [openMonthSelector, setOpenMonthSelector] = useState(false);


  const fetchLoan = useCallback(async (loanId: string) => {
    if (!user) return;
    // setLoading(true); // Not needed here as it's set true initially and false in finally
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
  }, [user, toast, router, setLoan, setLoading]); // Added setLoan, setLoading to dependencies

  useEffect(() => {
    if (id && user) {
      const loanId = Array.isArray(id) ? id[0] : id;
      fetchLoan(loanId);
    } else if (!user && id) {
      // If user is not yet available but id is, we might be waiting for auth.
      // setLoading(true) might be appropriate here if not handled by a global loader.
      // However, the main AuthProvider handles global loading states.
    } else {
      setLoading(false); // If no ID, or no user and no ID, stop loading.
    }
  }, [id, user, fetchLoan]); // Added fetchLoan to dependencies

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

  const prepaymentMonthOptions = useMemo(() => {
    const options = [
      { value: "0", label: "Before any EMIs (Start of Loan)" }
    ];
    if (originalSchedule) {
      originalSchedule.forEach(entry => {
        try {
          options.push({
            value: entry.month.toString(),
            label: `After EMI ${entry.month} (${format(parseISO(entry.paymentDate), 'MMM yyyy')})`
          });
        } catch (e) {
          console.error("Error formatting date for prepayment option:", entry.paymentDate, e);
          options.push({
            value: entry.month.toString(),
            label: `After EMI ${entry.month} (Invalid Date)`
          });
        }
      });
    }
    return options;
  }, [originalSchedule]);

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

    if (prepaymentAfterMonth === '') {
      toast({ title: "Invalid Input", description: "Please select when the prepayment should occur.", variant: "destructive" });
      return;
    }
    const afterMonth = parseInt(prepaymentAfterMonth, 10);


    let parsedPercentage: number | undefined;
    let parsedCustomAmount: number | undefined;
    let prepaymentAmountValue: number;

    if (prepaymentInputType === 'percentage') {
      parsedPercentage = parseFloat(prepaymentPercentage);
      if (isNaN(parsedPercentage) || parsedPercentage <= 0 || parsedPercentage > 100) {
        toast({ title: "Invalid Input", description: "Please enter a valid prepayment percentage (1-100).", variant: "destructive" });
        return;
      }
    } else { // 'amount'
      parsedCustomAmount = parseFloat(prepaymentCustomAmount);
      if (isNaN(parsedCustomAmount) || parsedCustomAmount <= 0) {
        toast({ title: "Invalid Input", description: "Please enter a valid positive prepayment amount.", variant: "destructive" });
        return;
      }
    }

    if (isNaN(afterMonth) || afterMonth < 0 || afterMonth > originalSchedule.length) {
      toast({ title: "Invalid Input", description: `Selected prepayment timing is invalid.`, variant: "destructive" });
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
        setSimulationResults({
            newClosureDate: originalSchedule[afterMonth-1]?.paymentDate || loan.startDate,
            interestSaved: 0,
            originalTotalInterest: calculateTotalInterest(originalSchedule),
            newTotalInterest: calculateTotalInterest(originalSchedule.slice(0, afterMonth)),
            simulatedSchedule: originalSchedule.slice(0, afterMonth),
            oldClosureDate: originalSchedule[originalSchedule.length-1]?.paymentDate || null,
        });
        setIsSimulating(false);
        return;
    }

    if (prepaymentInputType === 'percentage' && parsedPercentage !== undefined) {
      prepaymentAmountValue = parseFloat(((parsedPercentage / 100) * principalAtPrepaymentTime).toFixed(2));
    } else if (parsedCustomAmount !== undefined) {
      prepaymentAmountValue = parsedCustomAmount;
    } else {
      toast({ title: "Error", description: "Prepayment value could not be determined.", variant: "destructive" });
      setIsSimulating(false);
      return;
    }
    
    if (prepaymentAmountValue <=0) {
        toast({ title: "Invalid Prepayment", description: "Calculated or entered prepayment amount is zero or less for a non-zero balance.", variant: "destructive" });
        setIsSimulating(false);
        return;
    }

    const simulatedSchedule = simulatePrepayment(
      loan,
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
    return (
       <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <p className="text-lg text-muted-foreground">Loan data not available or still loading.</p>
      </div>
    );
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
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-2 block font-medium">Prepayment Type</Label>
            <RadioGroup
                defaultValue="percentage"
                value={prepaymentInputType}
                onValueChange={(value: 'percentage' | 'amount') => {
                    setPrepaymentInputType(value);
                    if (value === 'percentage') setPrepaymentCustomAmount('');
                    else setPrepaymentPercentage('');
                }}
                className="flex gap-x-4 gap-y-2 flex-wrap"
            >
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="type-percentage" />
                    <Label htmlFor="type-percentage" className="font-normal cursor-pointer">By Percentage</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="amount" id="type-amount" />
                    <Label htmlFor="type-amount" className="font-normal cursor-pointer">By Custom Amount</Label>
                </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prepaymentInputType === 'percentage' ? (
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
                <p className="text-xs text-muted-foreground">Percentage of current outstanding balance to prepay.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="prepaymentCustomAmount">Custom Prepayment Amount ({formatCurrency(0).charAt(0)})</Label>
                <Input
                  id="prepaymentCustomAmount"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 5000"
                  value={prepaymentCustomAmount}
                  onChange={(e) => setPrepaymentCustomAmount(e.target.value)}
                  disabled={isSimulating}
                />
                <p className="text-xs text-muted-foreground">Fixed amount to be prepaid.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="prepaymentAfterMonth">Prepayment Timing</Label>
              <Popover open={openMonthSelector} onOpenChange={setOpenMonthSelector}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openMonthSelector}
                    className="w-full justify-between font-normal"
                    disabled={isSimulating}
                  >
                    {prepaymentAfterMonth
                      ? prepaymentMonthOptions.find(option => option.value === prepaymentAfterMonth)?.label
                      : "Select EMI timing..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search EMI timing..." />
                    <CommandList>
                      <CommandEmpty>No timing found.</CommandEmpty>
                      <CommandGroup>
                        {prepaymentMonthOptions.map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.label} 
                            onSelect={() => {
                              setPrepaymentAfterMonth(option.value);
                              setOpenMonthSelector(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                prepaymentAfterMonth === option.value ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Select when the prepayment should occur.</p>
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

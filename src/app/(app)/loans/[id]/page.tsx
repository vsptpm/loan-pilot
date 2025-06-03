
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
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
import type { Loan, AmortizationEntry, LoanStatus, RecordedPrepayment, RecordedPrepaymentFormData } from '@/types';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  increment,
  deleteDoc,
} from 'firebase/firestore';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  generateAmortizationSchedule as generateRepaymentSchedule,
  simulatePrepayment,
  calculateTotalInterest,
  getInitialPaidEMIsCount,
  calculateEMI,
  getLoanStatus
} from '@/lib/loanUtils';
import { LineChart as LineChartIcon, BarChart3 as BarChartIcon, Loader2, TrendingUp, Calculator, ChevronsUpDown, Check, Edit3, Landmark as RecordIcon, ListChecks, Trash2, CircleDollarSign, Repeat, Wallet } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RecordPrepaymentForm } from '@/components/loans/RecordPrepaymentForm';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { parseISO, format, formatISO, isBefore, isEqual, isAfter } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';


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
  const loanIdString = Array.isArray(id) ? id[0] : id;
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

  const [isRecordPrepaymentDialogOpen, setIsRecordPrepaymentDialogOpen] = useState(false);
  const [isRecordingPrepayment, setIsRecordingPrepayment] = useState(false);
  const [recordedPrepayments, setRecordedPrepayments] = useState<RecordedPrepayment[]>([]);
  const [loadingPrepayments, setLoadingPrepayments] = useState(true);
  const [deletingPrepaymentId, setDeletingPrepaymentId] = useState<string | null>(null);


  useEffect(() => {
    if (loanIdString && user) {
      const loanDocRef = doc(db, `users/${user.uid}/loans`, loanIdString);
      const unsubscribeLoan = onSnapshot(loanDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setLoan({ id: docSnap.id, ...docSnap.data() } as Loan);
        } else {
          toast({ title: 'Error', description: 'Loan not found or was deleted.', variant: 'destructive' });
          router.push('/loans');
        }
        setLoading(false);
      }, (error) => {
        console.error('Error fetching loan snapshot:', error);
        toast({ title: 'Error', description: 'Failed to listen for loan updates.', variant: 'destructive' });
        setLoading(false);
      });
      
      return () => unsubscribeLoan();

    } else if (!user && loanIdString) {
       setLoading(true);
    } else {
      setLoading(false);
    }
  }, [loanIdString, user, toast, router]); 

  useEffect(() => {
    if (!user || !loanIdString) {
      setRecordedPrepayments([]);
      setLoadingPrepayments(false);
      return;
    }
    setLoadingPrepayments(true);
    const prepaymentsCol = collection(db, `users/${user.uid}/loans/${loanIdString}/prepayments`);
    const q = query(prepaymentsCol, orderBy('date', 'desc')); 

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prepayments = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as RecordedPrepayment));
      setRecordedPrepayments(prepayments); 
      setLoadingPrepayments(false);
    }, (error) => {
      console.error("Error fetching recorded prepayments: ", error);
      toast({ title: "Error", description: "Could not fetch recorded prepayments.", variant: "destructive" });
      setLoadingPrepayments(false);
    });
    return () => unsubscribe();
  }, [user, loanIdString, toast]);


  const monthlyEMI = useMemo(() => {
    if (!loan) return 0;
    return calculateEMI(loan.principalAmount, loan.interestRate, loan.durationMonths);
  }, [loan]);

  const initialPaidEMIsCount = useMemo(() => {
      if (!loan || monthlyEMI === 0) return 0;
      return getInitialPaidEMIsCount(loan.amountAlreadyPaid, monthlyEMI);
  }, [loan, monthlyEMI]);

  const currentAmortizationSchedule: AmortizationEntry[] = useMemo(() => {
    if (!loan) return [];
    const sortedPrepaymentsForSchedule = [...recordedPrepayments].sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    return generateRepaymentSchedule(
      loan.principalAmount,
      loan.interestRate,
      loan.durationMonths,
      loan.startDate,
      initialPaidEMIsCount,
      sortedPrepaymentsForSchedule 
    );
  }, [loan, initialPaidEMIsCount, recordedPrepayments]);
  
  const loanStatus: LoanStatus | null = useMemo(() => {
    if (!loan || !currentAmortizationSchedule) return null; 
    return getLoanStatus(loan, currentAmortizationSchedule, false); // false for detail view (accurate calculation)
  }, [loan, currentAmortizationSchedule]);


  const prepaymentMonthOptions = useMemo(() => {
    const options = [
      { value: "0", label: "Before any scheduled EMIs (Start of Loan)" }
    ];
    if (currentAmortizationSchedule) { 
      currentAmortizationSchedule.forEach(entry => {
        try {
          if(entry.paymentDate && typeof entry.paymentDate === 'string'){
            options.push({
              value: entry.month.toString(),
              label: `After EMI ${entry.month} (${format(parseISO(entry.paymentDate), 'MMM yyyy')})`
            });
          } else {
             options.push({
              value: entry.month.toString(),
              label: `After EMI ${entry.month} (Invalid Date)`
            });
          }
        } catch (e) {
          console.error("Error formatting date for prepayment option:", entry.paymentDate, e);
          options.push({
            value: entry.month.toString(),
            label: `After EMI ${entry.month} (Error in Date)`
          });
        }
      });
    }
    return options;
  }, [currentAmortizationSchedule]);

  const handleRecordPrepaymentSubmit = async (data: RecordedPrepaymentFormData) => {
    if (!user || !loanIdString || !loan) {
      toast({ title: 'Error', description: 'Cannot record prepayment. User or loan data missing.', variant: 'destructive' });
      return;
    }
    setIsRecordingPrepayment(true);
    try {
      const prepaymentsCol = collection(db, `users/${user.uid}/loans/${loanIdString}/prepayments`);
      await addDoc(prepaymentsCol, {
        amount: data.amount,
        date: formatISO(data.date, { representation: 'date' }),
        notes: data.notes || '',
        createdAt: serverTimestamp(),
      });

      const loanDocRef = doc(db, `users/${user.uid}/loans`, loanIdString);
      await updateDoc(loanDocRef, {
        totalPrepaymentAmount: increment(data.amount)
      });

      toast({ title: 'Success', description: 'Prepayment recorded successfully!' });
      setIsRecordPrepaymentDialogOpen(false);
    } catch (error) {
      console.error('Error recording prepayment: ', error);
      toast({ title: 'Error', description: 'Could not record prepayment. Please try again.', variant: 'destructive' });
    } finally {
      setIsRecordingPrepayment(false);
    }
  };

  const handleDeletePrepayment = async (prepaymentId: string, prepaymentAmount: number) => {
    if (!user || !loanIdString) {
      toast({ title: 'Error', description: 'User or loan data missing.', variant: 'destructive' });
      return;
    }
    setDeletingPrepaymentId(prepaymentId);
    try {
      const prepaymentDocRef = doc(db, `users/${user.uid}/loans/${loanIdString}/prepayments`, prepaymentId);
      await deleteDoc(prepaymentDocRef);

      const loanDocRef = doc(db, `users/${user.uid}/loans`, loanIdString);
      await updateDoc(loanDocRef, {
        totalPrepaymentAmount: increment(-prepaymentAmount)
      });

      toast({ title: 'Success', description: 'Prepayment deleted successfully.' });
    } catch (error) {
      console.error('Error deleting prepayment:', error);
      toast({ title: 'Error', description: 'Could not delete prepayment. Please try again.', variant: 'destructive' });
    } finally {
      setDeletingPrepaymentId(null);
    }
  };


  const remainingBalanceChartData = useMemo(() => {
    if (!currentAmortizationSchedule || currentAmortizationSchedule.length === 0) return [];
    return currentAmortizationSchedule.map(entry => ({
      month: `Month ${entry.month}`,
      balance: entry.remainingBalance,
    }));
  }, [currentAmortizationSchedule]);

  const principalInterestChartData = useMemo(() => {
    if (!currentAmortizationSchedule || currentAmortizationSchedule.length === 0) return [];
    return currentAmortizationSchedule.map(entry => ({
      month: `Month ${entry.month}`,
      principal: entry.principalPaid,
      interest: entry.interestPaid,
    }));
  }, [currentAmortizationSchedule]);

  const handleSimulatePrepayment = () => {
    if (!loan || currentAmortizationSchedule.length === 0) {
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
    } else { 
      parsedCustomAmount = parseFloat(prepaymentCustomAmount);
      if (isNaN(parsedCustomAmount) || parsedCustomAmount <= 0) {
        toast({ title: "Invalid Input", description: "Please enter a valid positive prepayment amount.", variant: "destructive" });
        return;
      }
    }
    if (isNaN(afterMonth) || afterMonth < 0 || afterMonth > currentAmortizationSchedule.length) {
      toast({ title: "Invalid Input", description: `Selected prepayment timing is invalid for the current schedule. Max month: ${currentAmortizationSchedule.length}.`, variant: "destructive" });
      return;
    }
    
    setIsSimulating(true);

    let principalAtPrepaymentTime: number;
    if (afterMonth === 0) {
        if (currentAmortizationSchedule.length > 0) {
            const firstEntry = currentAmortizationSchedule[0];
            principalAtPrepaymentTime = firstEntry.remainingBalance + firstEntry.principalPaid; 
        } else { 
            principalAtPrepaymentTime = 0;
        }
    } else {
        const entryBeforePrepayment = currentAmortizationSchedule[afterMonth -1];
        if(!entryBeforePrepayment) {
            toast({title: "Error", description: "Invalid month for prepayment in current schedule.", variant: "destructive"});
            setIsSimulating(false);
            return;
        }
        principalAtPrepaymentTime = entryBeforePrepayment.remainingBalance;
    }

    if (principalAtPrepaymentTime <= 0) { 
        toast({ title: "Loan Cleared", description: "Loan balance is already zero or negative at the selected point in the current schedule.", variant: "default" });
        const scheduleToUse = afterMonth === 0 ? [] : currentAmortizationSchedule.slice(0, afterMonth);
        setSimulationResults({
            newClosureDate: scheduleToUse.length > 0 && scheduleToUse[scheduleToUse.length-1]?.paymentDate ? scheduleToUse[scheduleToUse.length-1]?.paymentDate : loan.startDate,
            interestSaved: 0,
            originalTotalInterest: calculateTotalInterest(currentAmortizationSchedule),
            newTotalInterest: calculateTotalInterest(scheduleToUse),
            simulatedSchedule: scheduleToUse,
            oldClosureDate: currentAmortizationSchedule.length > 0 && currentAmortizationSchedule[currentAmortizationSchedule.length-1]?.paymentDate ? currentAmortizationSchedule[currentAmortizationSchedule.length-1]?.paymentDate : null,
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
      currentAmortizationSchedule,
      prepaymentAmountValue,
      afterMonth
    );

    const originalTotalInterest = calculateTotalInterest(currentAmortizationSchedule);
    const newTotalInterest = calculateTotalInterest(simulatedSchedule);
    const interestSaved = parseFloat((originalTotalInterest - newTotalInterest).toFixed(2));
    
    const newClosureDate = simulatedSchedule.length > 0 && simulatedSchedule[simulatedSchedule.length - 1].paymentDate ? simulatedSchedule[simulatedSchedule.length - 1].paymentDate : (currentAmortizationSchedule.length > 0 && currentAmortizationSchedule[0]?.paymentDate ? currentAmortizationSchedule[0]?.paymentDate : null) ;
    const oldClosureDate = currentAmortizationSchedule.length > 0 && currentAmortizationSchedule[currentAmortizationSchedule.length - 1].paymentDate ? currentAmortizationSchedule[currentAmortizationSchedule.length - 1].paymentDate : null;

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


  if (loading || loadingPrepayments) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading loan details...</p>
      </div>
    );
  }

  if (!loan || !loanStatus) { 
    return (
       <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <p className="text-lg text-muted-foreground">Loan data not available.</p>
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
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-3xl font-headline flex-grow">{loan.name}</CardTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              {loanIdString && (
                <Link href={`/loans/edit/${loanIdString}`} legacyBehavior passHref>
                  <Button variant="outline" size="sm" asChild className="h-9">
                    <a><Edit3 className="mr-2 h-4 w-4" />Edit</a>
                  </Button>
                </Link>
              )}
              <Dialog open={isRecordPrepaymentDialogOpen} onOpenChange={setIsRecordPrepaymentDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <RecordIcon className="mr-2 h-4 w-4" /> Record Prepayment
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle>Record Prepayment for {loan.name}</DialogTitle>
                    <DialogDescription>
                      Enter the details of your prepayment. This will be saved and reflected in loan calculations.
                    </DialogDescription>
                  </DialogHeader>
                  <RecordPrepaymentForm
                    onSubmit={handleRecordPrepaymentSubmit}
                    isLoading={isRecordingPrepayment}
                    loanStartDate={parseISO(loan.startDate)}
                    onCancel={() => setIsRecordPrepaymentDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <CardDescription>Detailed overview of your loan, reflecting all recorded prepayments. Assumes on-time EMI payments up to today.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              <Card className="shadow-md rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Original Principal</CardTitle>
                  <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold leading-tight">{formatCurrency(loan.principalAmount)}</div>
                </CardContent>
              </Card>
              <Card className="shadow-md rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Scheduled Monthly EMI</CardTitle>
                  <Repeat className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold leading-tight">{formatCurrency(monthlyEMI)}</div>
                </CardContent>
              </Card>
              <Card className="shadow-md rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold leading-tight">{formatCurrency(loanStatus.currentBalance)}</div>
                </CardContent>
              </Card>
              <Card className="shadow-md rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">EMIs Paid</CardTitle>
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold leading-tight">{loanStatus.paidEMIsCount} / {currentAmortizationSchedule.length || loan.durationMonths}</div>
                   <p className="text-xs text-muted-foreground">
                    out of {currentAmortizationSchedule.length || loan.durationMonths} total EMIs
                  </p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual Interest Rate:</span>
                  <span className="font-medium">{loan.interestRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Loan Term:</span>
                  <span className="font-medium">{loan.durationMonths} months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Initially Paid (Lumpsum):</span>
                  <span className="font-medium">{formatCurrency(loan.amountAlreadyPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Loan Start Date:</span>
                  <span className="font-medium">{formatDate(loan.startDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Principal Paid (to date):</span>
                  <span className="font-medium">{formatCurrency(loanStatus.totalPrincipalPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Interest Paid (to date):</span>
                  <span className="font-medium">{formatCurrency(loanStatus.totalInterestPaid)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Next Scheduled Payment:</span>
                    <span className="font-medium">{loanStatus.nextDueDate ? formatDate(loanStatus.nextDueDate) : (loanStatus.currentBalance <= 0.01 ? 'Paid Off' : 'N/A')}</span>
                </div>
                 <div className="md:col-span-2"> {/* Progress bar spans full width on medium and up */}
                    <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Overall Progress (to date):</span>
                        <span className="font-medium">{loanStatus.completedPercentage.toFixed(2)}%</span>
                    </div>
                    <Progress value={loanStatus.completedPercentage} className="h-2.5" />
                </div>
            </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center">
             <ListChecks className="mr-2 h-5 w-5 text-accent" />
            Recorded Prepayments
          </CardTitle>
          <CardDescription>History of prepayments made for this loan. These are factored into the loan details and schedule above. Total: {formatCurrency(loan.totalPrepaymentAmount || 0)}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPrepayments ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading prepayments...
            </div>
          ) : recordedPrepayments.length > 0 ? (
            <div className="max-h-96 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordedPrepayments.map((pp) => (
                    <TableRow key={pp.id}>
                      <TableCell>{formatDate(pp.date)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(pp.amount)}</TableCell>
                      <TableCell>{pp.notes || '-'}</TableCell>
                      <TableCell className="text-center">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" disabled={deletingPrepaymentId === pp.id}>
                              {deletingPrepaymentId === pp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the prepayment of {formatCurrency(pp.amount)} made on {formatDate(pp.date)}.
                                The loan's total prepayment amount will be updated accordingly.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePrepayment(pp.id, pp.amount)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete Prepayment
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">No prepayments recorded for this loan yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-headline flex items-center">
             <Calculator className="mr-2 h-5 w-5 text-accent" />
            Prepayment Simulator
          </CardTitle>
          <CardDescription>See how an additional hypothetical prepayment could affect your loan. This simulation is based on the current loan status including all recorded prepayments and assuming on-time EMI payments.</CardDescription>
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
                    <Label htmlFor="type-percentage" className="font-normal cursor-pointer">By Percentage of Current Balance</Label>
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
              <Label htmlFor="prepaymentAfterMonth">Prepayment Timing (in current schedule)</Label>
              <Popover open={openMonthSelector} onOpenChange={setOpenMonthSelector}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openMonthSelector}
                    className="w-full justify-between font-normal"
                    disabled={isSimulating}
                  >
                    {prepaymentAfterMonth && prepaymentMonthOptions.find(option => option.value === prepaymentAfterMonth)
                      ? prepaymentMonthOptions.find(option => option.value === prepaymentAfterMonth)?.label
                      : "Select EMI timing..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 max-h-60 overflow-y-auto">
                  <Command>
                    <CommandInput placeholder="Search EMI timing..." />
                    <CommandList>
                      <CommandEmpty>No timing found in current schedule.</CommandEmpty>
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
              <p className="text-xs text-muted-foreground">Select when the prepayment should occur in the current (possibly prepayment-adjusted) schedule.</p>
            </div>
          </div>
          <Button onClick={handleSimulatePrepayment} disabled={isSimulating || !loan} className="w-full sm:w-auto">
            {isSimulating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
            Simulate Prepayment
          </Button>

          {simulationResults && (
            <div className="mt-6 p-4 border rounded-md bg-muted/50 space-y-3">
              <h3 className="text-lg font-semibold font-headline">Simulation Results (on top of current state):</h3>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Estimated Closure Date:</span>
                <span className="font-medium">{simulationResults.oldClosureDate ? formatDate(simulationResults.oldClosureDate) : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New Estimated Closure Date (with this simulation):</span>
                <span className="font-medium text-primary">{simulationResults.newClosureDate ? formatDate(simulationResults.newClosureDate) : 'N/A'}</span>
              </div>
               <div className="flex justify-between">
                <span className="text-muted-foreground">Total Interest (current schedule):</span>
                <span className="font-medium">{formatCurrency(simulationResults.originalTotalInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Interest (with this simulation):</span>
                <span className="font-medium">{formatCurrency(simulationResults.newTotalInterest)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-muted-foreground">Further Interest Saved (by this simulation):</span>
                <span className="font-semibold text-green-600 dark:text-green-500">{formatCurrency(simulationResults.interestSaved)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                Note: This simulation assumes your monthly EMI payment remains the same, and the loan term is further reduced by this hypothetical prepayment.
              </p>
            </div>
          )}
        </CardContent>
      </Card>


      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Current Repayment Schedule</CardTitle>
          <CardDescription>
            The projected repayment plan, reflecting all recorded prepayments and assuming on-time EMI payments up to today. 
            {initialPaidEMIsCount > 0 ? ` ${initialPaidEMIsCount} initial EMI(s) marked as paid from 'Amount Initially Paid'.` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentAmortizationSchedule.length > 0 ? (
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
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentAmortizationSchedule.map((entry) => (
                    <TableRow key={entry.month} className={cn(entry.isPaid ? 'bg-primary/5' : '')}>
                      <TableCell>{entry.month}</TableCell>
                      <TableCell>{formatDate(entry.paymentDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.payment)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.principalPaid)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.interestPaid)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.remainingBalance)}</TableCell>
                       <TableCell className="text-center">
                        {entry.isPaid ? (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-700/20 dark:text-green-400">Paid</span>
                        ) : (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700/20 dark:text-gray-400">Upcoming</span>
                        )}
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">No repayment schedule available. Loan might be fully paid off or has zero duration.</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-primary">Loan Visualizations</CardTitle>
          <CardDescription>Visual breakdown of your loan repayment, reflecting all recorded prepayments and assumed on-time payments.</CardDescription>
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

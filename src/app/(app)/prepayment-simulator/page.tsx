
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Loan, AmortizationEntry, RecordedPrepayment, SimulationResults } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  generateAmortizationSchedule as generateRepaymentSchedule,
  simulatePrepayment,
  calculateTotalInterest,
  getInitialPaidEMIsCount,
  calculateEMI,
  getLoanStatus
} from '@/lib/loanUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader2, TrendingUp, ChevronsUpDown, Check, Info } from 'lucide-react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { parseISO, format, addMonths } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SimResults extends SimulationResults { // Renaming to avoid conflict if imported later
  newClosureDate: string | null;
  interestSaved: number;
  originalTotalInterest: number;
  newTotalInterest: number;
  simulatedSchedule: AmortizationEntry[];
  oldClosureDate: string | null;
}


export default function PrepaymentSimulatorPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [recordedPrepayments, setRecordedPrepayments] = useState<RecordedPrepayment[]>([]);
  
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);
  const [isLoadingSelectedLoanData, setIsLoadingSelectedLoanData] = useState(false);

  const [prepaymentInputType, setPrepaymentInputType] = useState<'percentage' | 'amount'>('percentage');
  const [prepaymentPercentage, setPrepaymentPercentage] = useState('');
  const [prepaymentCustomAmount, setPrepaymentCustomAmount] = useState('');
  const [prepaymentAfterMonth, setPrepaymentAfterMonth] = useState('');
  const [simulationResults, setSimulationResults] = useState<SimResults | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [openMonthSelector, setOpenMonthSelector] = useState(false);

  // Fetch all loans for the dropdown
  useEffect(() => {
    if (!user) {
      setAllLoans([]);
      setIsLoadingLoans(false);
      return;
    }
    setIsLoadingLoans(true);
    const loansCol = collection(db, `users/${user.uid}/loans`);
    const q = query(loansCol, orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userLoans = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Loan));
      setAllLoans(userLoans);
      setIsLoadingLoans(false);
    }, (error) => {
      console.error("Error fetching loans: ", error);
      toast({ title: "Error", description: "Could not fetch loans.", variant: "destructive" });
      setIsLoadingLoans(false);
    });
    return () => unsubscribe();
  }, [user, toast]);

  // Fetch details and prepayments for the selected loan
  useEffect(() => {
    if (!user || !selectedLoanId) {
      setSelectedLoan(null);
      setRecordedPrepayments([]);
      setSimulationResults(null); // Clear previous simulation
      setPrepaymentAfterMonth(''); // Reset timing
      return;
    }

    setIsLoadingSelectedLoanData(true);
    setSimulationResults(null); // Clear previous simulation on loan change
    setPrepaymentAfterMonth(''); // Reset timing on loan change


    const fetchLoanData = async () => {
      try {
        const loanDocRef = doc(db, `users/${user.uid}/loans`, selectedLoanId);
        const loanSnap = await getDoc(loanDocRef);
        if (loanSnap.exists()) {
          setSelectedLoan({ id: loanSnap.id, ...loanSnap.data() } as Loan);
        } else {
          toast({ title: "Error", description: "Selected loan not found.", variant: "destructive" });
          setSelectedLoan(null);
        }
      } catch (e) {
        toast({ title: "Error", description: "Failed to fetch loan details.", variant: "destructive" });
        setSelectedLoan(null);
      }

      try {
        const prepaymentsCol = collection(db, `users/${user.uid}/loans/${selectedLoanId}/prepayments`);
        const qPrepayments = query(prepaymentsCol, orderBy('date', 'desc'));
        const unsubPrepayments = onSnapshot(qPrepayments, (snapshot) => {
          const prepayments = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as RecordedPrepayment));
          setRecordedPrepayments(prepayments);
          setIsLoadingSelectedLoanData(false); 
        }, (error) => {
            console.error("Error fetching prepayments for selected loan: ", error);
            toast({ title: "Error", description: "Could not fetch prepayments for the selected loan.", variant: "destructive" });
            setRecordedPrepayments([]);
            setIsLoadingSelectedLoanData(false);
        });
        return unsubPrepayments; // This will be called by the outer effect's cleanup
      } catch (e) {
         toast({ title: "Error", description: "Failed to initiate prepayment fetching.", variant: "destructive" });
         setRecordedPrepayments([]);
         setIsLoadingSelectedLoanData(false);
      }
    };
    
    const unsubscribePrepayments = fetchLoanData();
    
    return () => {
        if (unsubscribePrepayments && typeof unsubscribePrepayments === 'function') {
            unsubscribePrepayments();
        }
    }

  }, [user, selectedLoanId, toast]);


  const monthlyEMIForSelectedLoan = useMemo(() => {
    if (!selectedLoan) return 0;
    return calculateEMI(selectedLoan.principalAmount, selectedLoan.interestRate, selectedLoan.durationMonths);
  }, [selectedLoan]);

  const initialPaidEMIsCountForSelectedLoan = useMemo(() => {
      if (!selectedLoan || monthlyEMIForSelectedLoan === 0) return 0;
      return getInitialPaidEMIsCount(selectedLoan.amountAlreadyPaid, monthlyEMIForSelectedLoan);
  }, [selectedLoan, monthlyEMIForSelectedLoan]);


  const currentAmortizationScheduleForSelectedLoan: AmortizationEntry[] = useMemo(() => {
    if (!selectedLoan) return [];
    const sortedPrepayments = [...recordedPrepayments].sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    return generateRepaymentSchedule(
      selectedLoan.principalAmount,
      selectedLoan.interestRate,
      selectedLoan.durationMonths,
      selectedLoan.startDate,
      initialPaidEMIsCountForSelectedLoan,
      sortedPrepayments
    );
  }, [selectedLoan, initialPaidEMIsCountForSelectedLoan, recordedPrepayments]);
  
  const loanStatusForSelectedLoan: ReturnType<typeof getLoanStatus> | null = useMemo(() => {
    if (!selectedLoan || !currentAmortizationScheduleForSelectedLoan) return null;
    // False for detail view (accurate calculation), appropriate here for simulation base
    return getLoanStatus(selectedLoan, currentAmortizationScheduleForSelectedLoan, false); 
  }, [selectedLoan, currentAmortizationScheduleForSelectedLoan]);


  const prepaymentMonthOptions = useMemo(() => {
    const options = [
      { value: "0", label: "Before any scheduled EMIs (Start of Loan)" }
    ];
    if (currentAmortizationScheduleForSelectedLoan && currentAmortizationScheduleForSelectedLoan.length > 0) { 
      currentAmortizationScheduleForSelectedLoan.forEach(entry => {
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
  }, [currentAmortizationScheduleForSelectedLoan]);


  const handleSimulatePrepayment = () => {
    if (!selectedLoan || currentAmortizationScheduleForSelectedLoan.length === 0) {
      toast({ title: "Error", description: "Selected loan data not available for simulation.", variant: "destructive" });
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
    
    if (isNaN(afterMonth) || afterMonth < 0 || afterMonth > currentAmortizationScheduleForSelectedLoan.length) {
        toast({ title: "Invalid Input", description: `Selected prepayment timing is invalid. Max month: ${currentAmortizationScheduleForSelectedLoan.length}.`, variant: "destructive" });
        return;
    }
    
    setIsSimulating(true);

    let principalAtPrepaymentTime: number;
     if (afterMonth === 0) {
        if (currentAmortizationScheduleForSelectedLoan.length > 0) {
            const firstEntry = currentAmortizationScheduleForSelectedLoan[0];
            principalAtPrepaymentTime = firstEntry.remainingBalance + firstEntry.principalPaid; 
        } else { 
            principalAtPrepaymentTime = 0; // Or selectedLoan.principalAmount if schedule is truly empty due to full pre-payment.
        }
    } else {
        const entryBeforePrepayment = currentAmortizationScheduleForSelectedLoan[afterMonth -1];
        if(!entryBeforePrepayment) {
            toast({title: "Error", description: "Invalid month for prepayment in current schedule.", variant: "destructive"});
            setIsSimulating(false);
            return;
        }
        principalAtPrepaymentTime = entryBeforePrepayment.remainingBalance;
    }

    if (principalAtPrepaymentTime <= 0) { 
        toast({ title: "Loan Cleared", description: "Loan balance is already zero or negative at the selected point in the current schedule.", variant: "default" });
        const scheduleToUse = afterMonth === 0 ? [] : currentAmortizationScheduleForSelectedLoan.slice(0, afterMonth);
        setSimulationResults({
            newClosureDate: scheduleToUse.length > 0 && scheduleToUse[scheduleToUse.length-1]?.paymentDate ? scheduleToUse[scheduleToUse.length-1]?.paymentDate : selectedLoan.startDate,
            interestSaved: 0,
            originalTotalInterest: calculateTotalInterest(currentAmortizationScheduleForSelectedLoan),
            newTotalInterest: calculateTotalInterest(scheduleToUse),
            simulatedSchedule: scheduleToUse,
            oldClosureDate: currentAmortizationScheduleForSelectedLoan.length > 0 && currentAmortizationScheduleForSelectedLoan[currentAmortizationScheduleForSelectedLoan.length-1]?.paymentDate ? currentAmortizationScheduleForSelectedLoan[currentAmortizationScheduleForSelectedLoan.length-1]?.paymentDate : null,
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
      selectedLoan, 
      currentAmortizationScheduleForSelectedLoan,
      prepaymentAmountValue,
      afterMonth
    );

    const originalTotalInterest = calculateTotalInterest(currentAmortizationScheduleForSelectedLoan);
    const newTotalInterest = calculateTotalInterest(simulatedSchedule);
    const interestSaved = parseFloat((originalTotalInterest - newTotalInterest).toFixed(2));
    
    const newClosureDate = simulatedSchedule.length > 0 && simulatedSchedule[simulatedSchedule.length - 1].paymentDate ? simulatedSchedule[simulatedSchedule.length - 1].paymentDate : (currentAmortizationScheduleForSelectedLoan.length > 0 && currentAmortizationScheduleForSelectedLoan[0]?.paymentDate ? currentAmortizationScheduleForSelectedLoan[0]?.paymentDate : null) ;
    const oldClosureDate = currentAmortizationScheduleForSelectedLoan.length > 0 && currentAmortizationScheduleForSelectedLoan[currentAmortizationScheduleForSelectedLoan.length - 1].paymentDate ? currentAmortizationScheduleForSelectedLoan[currentAmortizationScheduleForSelectedLoan.length - 1].paymentDate : null;

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

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-headline tracking-tight">Prepayment Simulator</h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Select Loan</CardTitle>
          <CardDescription>Choose a loan from your list to simulate a prepayment.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLoans ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading your loans...</span>
            </div>
          ) : allLoans.length === 0 ? (
            <p className="text-muted-foreground">You don't have any loans added yet. Please add a loan first.</p>
          ) : (
            <Select
              value={selectedLoanId || undefined}
              onValueChange={(value) => {
                setSelectedLoanId(value);
              }}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select a loan..." />
              </SelectTrigger>
              <SelectContent>
                {allLoans.map(loan => (
                  <SelectItem key={loan.id} value={loan.id}>
                    {loan.name} ({formatCurrency(loan.principalAmount)} @ {loan.interestRate}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {isLoadingSelectedLoanData && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading selected loan data...</p>
        </div>
      )}

      {selectedLoan && !isLoadingSelectedLoanData && (
        <>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Current Loan Status for: {selectedLoan.name}</AlertTitle>
            <AlertDescription>
              <div className="text-sm space-y-1 mt-2">
                  <p>Outstanding Balance: <span className="font-semibold">{formatCurrency(loanStatusForSelectedLoan?.currentBalance)}</span></p>
                  <p>Scheduled EMI: <span className="font-semibold">{formatCurrency(monthlyEMIForSelectedLoan)}</span></p>
                  <p>Next Due Date: <span className="font-semibold">{loanStatusForSelectedLoan?.nextDueDate ? formatDate(loanStatusForSelectedLoan.nextDueDate) : 'N/A'}</span></p>
                  <p className="text-xs pt-1">Simulation will be based on this current state. Total recorded prepayments for this loan: {formatCurrency(selectedLoan.totalPrepaymentAmount || 0)}</p>
              </div>
            </AlertDescription>
          </Alert>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Simulate Additional Prepayment for: {selectedLoan.name}</CardTitle>
              <CardDescription>Enter details for a hypothetical prepayment on the selected loan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block font-medium">Prepayment Type</Label>
                <RadioGroup
                  value={prepaymentInputType}
                  onValueChange={(value: 'percentage' | 'amount') => {
                    setPrepaymentInputType(value);
                    if (value === 'percentage') setPrepaymentCustomAmount('');
                    else setPrepaymentPercentage('');
                  }}
                  className="flex gap-x-4 gap-y-2 flex-wrap"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="sim-type-percentage" />
                    <Label htmlFor="sim-type-percentage" className="font-normal cursor-pointer">By Percentage of Current Balance</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="amount" id="sim-type-amount" />
                    <Label htmlFor="sim-type-amount" className="font-normal cursor-pointer">By Custom Amount</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {prepaymentInputType === 'percentage' ? (
                  <div className="space-y-2">
                    <Label htmlFor="sim-prepaymentPercentage">Prepayment Percentage (%)</Label>
                    <Input
                      id="sim-prepaymentPercentage"
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
                    <Label htmlFor="sim-prepaymentCustomAmount">Custom Prepayment Amount ({formatCurrency(0).charAt(0)})</Label>
                    <Input
                      id="sim-prepaymentCustomAmount"
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
                  <Label htmlFor="sim-prepaymentAfterMonth">Prepayment Timing (in current schedule)</Label>
                  <Popover open={openMonthSelector} onOpenChange={setOpenMonthSelector}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openMonthSelector}
                        className="w-full justify-between font-normal"
                        disabled={isSimulating || prepaymentMonthOptions.length <= 1}
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
                          <CommandEmpty>No timing found for selected loan.</CommandEmpty>
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
                  <p className="text-xs text-muted-foreground">Select when this hypothetical prepayment should occur in the loan's current schedule.</p>
                </div>
              </div>
              <Button onClick={handleSimulatePrepayment} disabled={isSimulating || !selectedLoan} className="w-full sm:w-auto">
                {isSimulating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                Simulate Prepayment
              </Button>

              {simulationResults && (
                <div className="mt-6 p-4 border rounded-md bg-muted/50 space-y-3">
                  <h3 className="text-lg font-semibold font-headline">Simulation Results:</h3>
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
                    It is based on the selected loan's current state, including all previously recorded prepayments.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {!selectedLoan && !isLoadingLoans && !isLoadingSelectedLoanData && allLoans.length > 0 &&(
         <Card className="shadow-lg">
            <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">Please select a loan above to start simulating prepayments.</p>
            </CardContent>
         </Card>
      )}
    </div>
  );
}


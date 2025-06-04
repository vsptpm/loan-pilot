
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Loan, AmortizationEntry, RecordedPrepayment, SimulationResults } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, getDoc, orderBy, Unsubscribe } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  generateAmortizationSchedule as generateCurrentRepaymentSchedule, // Renamed for clarity
  generateSimulatedSchedule, // Was simulatePrepayment, now enhanced
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
import { Loader2, TrendingUp, ChevronsUpDown, Check, Info, Repeat } from 'lucide-react'; // Added Repeat icon
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { parseISO, format, addMonths } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SimResults extends SimulationResults {
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

  const [simulationMode, setSimulationMode] = useState<'one-time' | 'recurring'>('one-time');
  const [prepaymentInputType, setPrepaymentInputType] = useState<'percentage' | 'amount'>('amount');
  const [prepaymentPercentage, setPrepaymentPercentage] = useState('');
  const [prepaymentCustomAmount, setPrepaymentCustomAmount] = useState('');
  const [prepaymentAfterMonth, setPrepaymentAfterMonth] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState<string>('12'); // Default to Annually (12 months)

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
      setSimulationResults(null);
      setPrepaymentAfterMonth('');
      setIsLoadingSelectedLoanData(false); // Ensure loading is false if no selection
      return;
    }

    setIsLoadingSelectedLoanData(true);
    setSimulationResults(null);
    setPrepaymentAfterMonth('');

    let unsubscribeFromSnapshots: Unsubscribe | null = null;

    const fetchLoanAndPrepayments = async () => {
      try {
        const loanDocRef = doc(db, `users/${user.uid}/loans`, selectedLoanId);
        const loanSnap = await getDoc(loanDocRef);

        if (loanSnap.exists()) {
          setSelectedLoan({ id: loanSnap.id, ...loanSnap.data() } as Loan);
        } else {
          toast({ title: "Error", description: "Selected loan not found.", variant: "destructive" });
          setSelectedLoan(null);
          setIsLoadingSelectedLoanData(false);
          return; 
        }

        const prepaymentsCol = collection(db, `users/${user.uid}/loans/${selectedLoanId}/prepayments`);
        const qPrepayments = query(prepaymentsCol, orderBy('date', 'desc'));
        
        unsubscribeFromSnapshots = onSnapshot(qPrepayments, (snapshot) => {
          const prepayments = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as RecordedPrepayment));
          setRecordedPrepayments(prepayments);
          // Only set loading to false after prepayments are also loaded (or attempted)
          setIsLoadingSelectedLoanData(false); 
        }, (error) => {
            console.error("Error fetching prepayments for selected loan: ", error);
            toast({ title: "Error", description: "Could not fetch prepayments for the selected loan.", variant: "destructive" });
            setRecordedPrepayments([]);
            setIsLoadingSelectedLoanData(false);
        });

      } catch (e) {
         toast({ title: "Error", description: "Failed to fetch loan data.", variant: "destructive" });
         setSelectedLoan(null);
         setRecordedPrepayments([]);
         setIsLoadingSelectedLoanData(false);
      }
    };
    
    fetchLoanAndPrepayments();
    
    return () => { 
        if (unsubscribeFromSnapshots) {
            unsubscribeFromSnapshots();
        }
    };
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
    return generateCurrentRepaymentSchedule(
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
    return getLoanStatus(selectedLoan, currentAmortizationScheduleForSelectedLoan, false); 
  }, [selectedLoan, currentAmortizationScheduleForSelectedLoan]);


  const prepaymentMonthOptions = useMemo(() => {
    const options = [
      { value: "0", label: "Before any scheduled EMIs (Start of Current Schedule)" }
    ];
    if (currentAmortizationScheduleForSelectedLoan && currentAmortizationScheduleForSelectedLoan.length > 0) { 
      currentAmortizationScheduleForSelectedLoan.forEach(entry => {
        if (!entry.isPaid || entry.remainingBalance > 0.01) {
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
        }
      });
    }
    return options;
  }, [currentAmortizationScheduleForSelectedLoan]);


  const handleSimulatePrepayment = () => {
    if (!selectedLoan || currentAmortizationScheduleForSelectedLoan.length === 0 || !loanStatusForSelectedLoan) {
      toast({ title: "Error", description: "Selected loan data not available for simulation.", variant: "destructive" });
      return;
    }
     if (loanStatusForSelectedLoan.currentBalance <= 0.01) {
      toast({ title: "Loan Paid Off", description: "This loan is already fully paid off.", variant: "default" });
      setSimulationResults(null);
      return;
    }
    if (prepaymentAfterMonth === '') {
      toast({ title: "Invalid Input", description: "Please select when the prepayment should occur.", variant: "destructive" });
      return;
    }
    const applyAfterMonthNum = parseInt(prepaymentAfterMonth, 10);

    let prepaymentAmountValue: number;
    if (prepaymentInputType === 'percentage') {
      const parsedPercentage = parseFloat(prepaymentPercentage);
      if (isNaN(parsedPercentage) || parsedPercentage <= 0 || parsedPercentage > 100) {
        toast({ title: "Invalid Input", description: "Please enter a valid prepayment percentage (1-100).", variant: "destructive" });
        return;
      }
      let balanceForPercentageCalc: number;
      if (applyAfterMonthNum === 0) {
        balanceForPercentageCalc = currentAmortizationScheduleForSelectedLoan.length > 0 ? currentAmortizationScheduleForSelectedLoan[0].remainingBalance + currentAmortizationScheduleForSelectedLoan[0].principalPaid : selectedLoan.principalAmount;
      } else {
        const entry = currentAmortizationScheduleForSelectedLoan[applyAfterMonthNum - 1];
        balanceForPercentageCalc = entry ? entry.remainingBalance : 0;
      }
      prepaymentAmountValue = parseFloat(((parsedPercentage / 100) * balanceForPercentageCalc).toFixed(2));

    } else { 
      const parsedCustomAmount = parseFloat(prepaymentCustomAmount);
      if (isNaN(parsedCustomAmount) || parsedCustomAmount <= 0) {
        toast({ title: "Invalid Input", description: "Please enter a valid positive prepayment amount.", variant: "destructive" });
        return;
      }
      prepaymentAmountValue = parsedCustomAmount;
    }
    
    if (prepaymentAmountValue <= 0) {
        toast({ title: "Invalid Prepayment", description: "Calculated or entered prepayment amount is zero or less.", variant: "destructive" });
        return;
    }
    
    if (isNaN(applyAfterMonthNum) || applyAfterMonthNum < 0 || (applyAfterMonthNum > 0 && applyAfterMonthNum > currentAmortizationScheduleForSelectedLoan.length)) {
        toast({ title: "Invalid Input", description: `Selected prepayment timing is invalid. Max month: ${currentAmortizationScheduleForSelectedLoan.length}.`, variant: "destructive" });
        return;
    }
    
    setIsSimulating(true);

    const simulationParams = {
      type: simulationMode,
      amount: prepaymentAmountValue,
      applyAfterMonth: applyAfterMonthNum,
      recurringFrequencyMonths: simulationMode === 'recurring' ? parseInt(recurringFrequency, 10) : undefined,
    };
    
    const simulatedSchedule = generateSimulatedSchedule(
      selectedLoan, 
      currentAmortizationScheduleForSelectedLoan,
      simulationParams
    );

    const originalTotalInterest = calculateTotalInterest(currentAmortizationScheduleForSelectedLoan);
    const newTotalInterest = calculateTotalInterest(simulatedSchedule);
    const interestSaved = parseFloat((originalTotalInterest - newTotalInterest).toFixed(2));
    
    const newClosureDate = simulatedSchedule.length > 0 && simulatedSchedule[simulatedSchedule.length - 1].paymentDate ? simulatedSchedule[simulatedSchedule.length - 1].paymentDate : (currentAmortizationScheduleForSelectedLoan.length > 0 && currentAmortizationScheduleForSelectedLoan[0]?.paymentDate ? currentAmortizationScheduleForSelectedLoan[0]?.paymentDate : null) ;
    const oldClosureDate = currentAmortizationScheduleForSelectedLoan.length > 0 && currentAmortizationScheduleForSelectedLoan[currentAmortizationScheduleForSelectedLoan.length - 1].paymentDate ? currentAmortizationScheduleForSelectedLoan[currentAmortizationScheduleForSelectedLoan.length - 1].paymentDate : null;

    setSimulationResults({
      newClosureDate,
      interestSaved: interestSaved < 0 ? 0 : interestSaved, 
      originalTotalInterest,
      newTotalInterest: newTotalInterest < 0 ? originalTotalInterest : newTotalInterest, 
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

      {isLoadingSelectedLoanData && selectedLoanId && (
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
                  <p>Next Due Date: <span className="font-semibold">{loanStatusForSelectedLoan?.nextDueDate ? formatDate(loanStatusForSelectedLoan.nextDueDate) : (loanStatusForSelectedLoan?.currentBalance === 0 ? 'Paid Off' : 'N/A')}</span></p>
                  <p className="text-xs pt-1">Simulation will be based on this current state. Total recorded prepayments for this loan: {formatCurrency(selectedLoan.totalPrepaymentAmount || 0)}</p>
              </div>
            </AlertDescription>
          </Alert>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Simulate Additional Prepayment for: {selectedLoan.name}</CardTitle>
              <CardDescription>Enter details for a hypothetical prepayment on the selected loan. Current outstanding balance: {formatCurrency(loanStatusForSelectedLoan?.currentBalance)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-2 block font-medium">Prepayment Mode</Label>
                <RadioGroup
                  value={simulationMode}
                  onValueChange={(value: 'one-time' | 'recurring') => setSimulationMode(value)}
                  className="flex gap-x-4 gap-y-2 flex-wrap"
                  disabled={isSimulating || loanStatusForSelectedLoan?.currentBalance <= 0.01}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="one-time" id="sim-mode-onetime" />
                    <Label htmlFor="sim-mode-onetime" className="font-normal cursor-pointer">One-Time</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="recurring" id="sim-mode-recurring" />
                    <Label htmlFor="sim-mode-recurring" className="font-normal cursor-pointer">Recurring</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="mb-2 block font-medium">Prepayment Value Type</Label>
                <RadioGroup
                  value={prepaymentInputType}
                  onValueChange={(value: 'percentage' | 'amount') => {
                    setPrepaymentInputType(value);
                    if (value === 'percentage') setPrepaymentCustomAmount('');
                    else setPrepaymentPercentage('');
                  }}
                  className="flex gap-x-4 gap-y-2 flex-wrap"
                  disabled={isSimulating || loanStatusForSelectedLoan?.currentBalance <= 0.01}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="percentage" id="sim-type-percentage" />
                    <Label htmlFor="sim-type-percentage" className="font-normal cursor-pointer">By Percentage of Balance at Prepayment Time</Label>
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
                      disabled={isSimulating || loanStatusForSelectedLoan?.currentBalance <= 0.01}
                    />
                     <p className="text-xs text-muted-foreground">
                       {simulationMode === 'one-time' 
                         ? "Percentage of current outstanding balance to prepay."
                         : "Percentage of balance at the time of *each* recurring prepayment."}
                     </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="sim-prepaymentCustomAmount">
                      {simulationMode === 'one-time' ? 'One-Time' : 'Recurring'} Prepayment Amount ({formatCurrency(0).charAt(0)})
                    </Label>
                    <Input
                      id="sim-prepaymentCustomAmount"
                      type="number"
                      step="0.01"
                      placeholder="e.g., 5000"
                      value={prepaymentCustomAmount}
                      onChange={(e) => setPrepaymentCustomAmount(e.target.value)}
                      disabled={isSimulating || loanStatusForSelectedLoan?.currentBalance <= 0.01}
                    />
                    <p className="text-xs text-muted-foreground">Fixed amount to be prepaid {simulationMode === 'recurring' ? 'at each interval.' : 'once.'}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="sim-prepaymentAfterMonth">
                    {simulationMode === 'one-time' ? 'Prepayment Timing' : 'First Prepayment Timing'}
                  </Label>
                  <Popover open={openMonthSelector} onOpenChange={setOpenMonthSelector}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openMonthSelector}
                        className="w-full justify-between font-normal"
                        disabled={isSimulating || prepaymentMonthOptions.length <= 1 || loanStatusForSelectedLoan?.currentBalance <= 0.01}
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
                  <p className="text-xs text-muted-foreground">Select when this hypothetical prepayment occurs in the loan's current schedule.</p>
                </div>
              </div>

              {simulationMode === 'recurring' && (
                <div className="space-y-2">
                  <Label htmlFor="sim-recurringFrequency">Recurring Frequency</Label>
                  <Select 
                    value={recurringFrequency} 
                    onValueChange={setRecurringFrequency}
                    disabled={isSimulating || loanStatusForSelectedLoan?.currentBalance <= 0.01}
                  >
                    <SelectTrigger id="sim-recurringFrequency" className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">Every 6 Months</SelectItem>
                      <SelectItem value="12">Annually (12 Months)</SelectItem>
                      <SelectItem value="3">Every 3 Months</SelectItem>
                    </SelectContent>
                  </Select>
                   <p className="text-xs text-muted-foreground">How often the recurring prepayment will be made, starting after the first prepayment timing.</p>
                </div>
              )}
              
              {loanStatusForSelectedLoan?.currentBalance <= 0.01 && (
                <p className="text-sm font-medium text-green-600">This loan is already paid off. No further simulation possible.</p>
              )}

              <Button onClick={handleSimulatePrepayment} disabled={isSimulating || !selectedLoan || loanStatusForSelectedLoan?.currentBalance <= 0.01} className="w-full sm:w-auto">
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
                    <span className="text-muted-foreground">New Estimated Closure Date (with simulation):</span>
                    <span className="font-medium text-primary">{simulationResults.newClosureDate ? formatDate(simulationResults.newClosureDate) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Interest (current schedule):</span>
                    <span className="font-medium">{formatCurrency(simulationResults.originalTotalInterest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Interest (with simulation):</span>
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
      {!selectedLoanId && !isLoadingLoans && !isLoadingSelectedLoanData && allLoans.length > 0 &&(
         <Card className="shadow-lg">
            <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">Please select a loan above to start simulating prepayments.</p>
            </CardContent>
         </Card>
      )}
    </div>
  );
}


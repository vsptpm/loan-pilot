
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Loan, AmortizationEntry, RecordedPrepayment, LoanStatus, WhatIfAnalysisResults } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, getDoc, orderBy, Unsubscribe } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  generateAmortizationSchedule,
  getLoanStatus,
  calculateEMI,
  getInitialPaidEMIsCount,
  simulateNewEMI,
  calculateTotalInterest,
} from '@/lib/loanUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Lightbulb, TrendingDown, TrendingUp, AlertCircle, CalendarDays, Sparkles } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { parseISO, differenceInMonths, isEqual } from 'date-fns';


export default function WhatIfAnalyzerPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [recordedPrepayments, setRecordedPrepayments] = useState<RecordedPrepayment[]>([]);
  
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);
  const [isLoadingSelectedLoanData, setIsLoadingSelectedLoanData] = useState(false);

  const [newEmiAmountInput, setNewEmiAmountInput] = useState<string>('');
  const [analysisResults, setAnalysisResults] = useState<WhatIfAnalysisResults | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
      setAnalysisResults(null);
      setNewEmiAmountInput('');
      setIsLoadingSelectedLoanData(false);
      return;
    }

    setIsLoadingSelectedLoanData(true);
    setAnalysisResults(null);
    setNewEmiAmountInput('');

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
          setIsLoadingSelectedLoanData(false); 
        }, (error) => {
            console.error("Error fetching prepayments for selected loan: ", error);
            toast({ title: "Error", description: "Could not fetch prepayments for the selected loan.", variant: "destructive" });
            setRecordedPrepayments([]);
            setIsLoadingSelectedLoanData(false);
        });
      } catch (e) {
         toast({ title: "Error", description: "Failed to initiate prepayment fetching.", variant: "destructive" });
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

  const initialPaidEMIsCountForSelectedLoan = useMemo(() => {
    if (!selectedLoan) return 0;
    const currentEMI = calculateEMI(selectedLoan.principalAmount, selectedLoan.interestRate, selectedLoan.durationMonths);
    if (currentEMI === 0) return 0;
    return getInitialPaidEMIsCount(selectedLoan.amountAlreadyPaid, currentEMI);
  }, [selectedLoan]);

  const currentAmortizationScheduleForSelectedLoan: AmortizationEntry[] = useMemo(() => {
    if (!selectedLoan) return [];
    const sortedPrepayments = [...recordedPrepayments].sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    return generateAmortizationSchedule(
      selectedLoan.principalAmount,
      selectedLoan.interestRate,
      selectedLoan.durationMonths,
      selectedLoan.startDate,
      initialPaidEMIsCountForSelectedLoan,
      sortedPrepayments
    );
  }, [selectedLoan, initialPaidEMIsCountForSelectedLoan, recordedPrepayments]);
  
  const currentLoanStatusForDisplay: LoanStatus | null = useMemo(() => {
    if (!selectedLoan || currentAmortizationScheduleForSelectedLoan.length === 0) return null;
    return getLoanStatus(selectedLoan, currentAmortizationScheduleForSelectedLoan, false); 
  }, [selectedLoan, currentAmortizationScheduleForSelectedLoan]);

  const originalMonthlyEMIForSelectedLoan = useMemo(() => {
    if (!selectedLoan) return 0;
    return calculateEMI(selectedLoan.principalAmount, selectedLoan.interestRate, selectedLoan.durationMonths);
  }, [selectedLoan]);


  const handleAnalyzeWhatIf = () => {
    if (!selectedLoan || !currentLoanStatusForDisplay || !currentLoanStatusForDisplay.nextDueDate) {
      toast({ title: "Error", description: "Loan data or next due date is missing for analysis.", variant: "destructive" });
      return;
    }

    const newEmi = parseFloat(newEmiAmountInput);
    if (isNaN(newEmi) || newEmi <= 0) {
      toast({ title: "Invalid Input", description: "Please enter a valid new EMI amount.", variant: "destructive" });
      return;
    }
    
    if (newEmi <= originalMonthlyEMIForSelectedLoan && currentLoanStatusForDisplay.currentBalance > 0) {
        toast({ title: "Info", description: "New EMI should ideally be greater than the current EMI to see payoff acceleration.", variant: "default" });
    }
     if (currentLoanStatusForDisplay.currentBalance <= 0){
        toast({ title: "Loan Paid Off", description: "This loan is already paid off. No 'what-if' analysis needed.", variant: "default" });
        return;
    }

    setIsAnalyzing(true);

    const analysisStartDate = currentLoanStatusForDisplay.nextDueDate;
    const analysisStartBalance = currentLoanStatusForDisplay.currentBalance;

    const simulation = simulateNewEMI(
      analysisStartBalance,
      selectedLoan.interestRate,
      newEmi,
      analysisStartDate
    );

    if (simulation.newProjectedClosureDate === null || simulation.monthsToRepay === Infinity) {
        toast({title: "Analysis Issue", description: "The new EMI is too low to cover interest. The loan would not be repaid with this amount.", variant: "destructive"});
        setIsAnalyzing(false);
        setAnalysisResults(null);
        return;
    }

    const originalTotalInterestFromSchedule = calculateTotalInterest(currentAmortizationScheduleForSelectedLoan);
    
    let interestPaidBeforeChange = 0;
    for (const entry of currentAmortizationScheduleForSelectedLoan) {
        if (parseISO(entry.paymentDate) < parseISO(analysisStartDate) && entry.isPaid) { // Consider only EMIs strictly before the change point that were paid
            interestPaidBeforeChange += entry.interestPaid;
        }
    }
    
    const newTotalLoanInterest = interestPaidBeforeChange + simulation.newTotalInterestPaid;
    const interestSaved = originalTotalInterestFromSchedule - newTotalLoanInterest;

    let timeSavedInMonths = 0;
    if (currentLoanStatusForDisplay.estimatedClosureDate && simulation.newProjectedClosureDate) {
        timeSavedInMonths = differenceInMonths(
            parseISO(currentLoanStatusForDisplay.estimatedClosureDate),
            parseISO(simulation.newProjectedClosureDate)
        );
    }
    
    setAnalysisResults({
      originalProjectedClosureDate: currentLoanStatusForDisplay.estimatedClosureDate,
      originalTotalInterest: originalTotalInterestFromSchedule,
      originalMonthlyEMI: originalMonthlyEMIForSelectedLoan,
      newProjectedClosureDate: simulation.newProjectedClosureDate,
      newTotalInterestPaid: newTotalLoanInterest,
      newSchedule: simulation.newSchedule,
      totalInterestSaved: interestSaved,
      timeSavedInMonths: timeSavedInMonths > 0 ? timeSavedInMonths : 0, // Ensure non-negative
    });

    setIsAnalyzing(false);
    toast({ title: "Analysis Complete", description: "Impact of new EMI calculated." });
  };


  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3">
        <Lightbulb className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-headline tracking-tight">What-if Loan Analyzer</h1>
      </div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Select Loan</CardTitle>
          <CardDescription>Choose a loan to analyze the impact of changing your EMI.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingLoans ? (
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading your loans...</span>
            </div>
          ) : allLoans.length === 0 ? (
            <p className="text-muted-foreground">You don't have any loans. Add a loan first to use the analyzer.</p>
          ) : (
            <Select
              value={selectedLoanId || undefined}
              onValueChange={(value) => setSelectedLoanId(value)}
            >
              <SelectTrigger className="w-full md:w-[350px]">
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

      {selectedLoan && !isLoadingSelectedLoanData && currentLoanStatusForDisplay && (
        <>
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-xl">Current Status: {selectedLoan.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Outstanding Balance:</span> <span className="font-semibold">{formatCurrency(currentLoanStatusForDisplay.currentBalance)}</span></div>
              <div className="flex justify-between"><span>Current Scheduled EMI:</span> <span className="font-semibold">{formatCurrency(originalMonthlyEMIForSelectedLoan)}</span></div>
              <div className="flex justify-between"><span>Projected Closure Date:</span> <span className="font-semibold">{currentLoanStatusForDisplay.estimatedClosureDate ? formatDate(currentLoanStatusForDisplay.estimatedClosureDate) : 'N/A'}</span></div>
              <div className="flex justify-between"><span>Projected Total Interest:</span> <span className="font-semibold">{formatCurrency(calculateTotalInterest(currentAmortizationScheduleForSelectedLoan))}</span></div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Analyze New EMI</CardTitle>
              <CardDescription>Enter a new monthly EMI amount you are considering paying for "{selectedLoan.name}". Analysis will start from the next due date ({currentLoanStatusForDisplay.nextDueDate ? formatDate(currentLoanStatusForDisplay.nextDueDate) : 'N/A'}).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="newEmiAmount">New Monthly EMI Amount ({formatCurrency(0).charAt(0)})</Label>
                <Input
                  id="newEmiAmount"
                  type="number"
                  step="0.01"
                  placeholder={`e.g., ${originalMonthlyEMIForSelectedLoan + 500}`}
                  value={newEmiAmountInput}
                  onChange={(e) => setNewEmiAmountInput(e.target.value)}
                  disabled={isAnalyzing || currentLoanStatusForDisplay.currentBalance <= 0}
                />
                 {currentLoanStatusForDisplay.currentBalance <= 0 && <p className="text-sm text-green-600">This loan is already paid off!</p>}
              </div>
              <Button onClick={handleAnalyzeWhatIf} disabled={isAnalyzing || !selectedLoan || !newEmiAmountInput || currentLoanStatusForDisplay.currentBalance <= 0} className="w-full sm:w-auto">
                {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Analyze Impact
              </Button>

              {analysisResults && (
                <Alert variant={analysisResults.totalInterestSaved > 0 ? "default" : "default"} className="mt-6 bg-muted/30">
                   {analysisResults.totalInterestSaved > 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
                  <AlertTitle className="font-headline text-lg">
                    {analysisResults.totalInterestSaved > 0 ? "Potential Savings Found!" : "Analysis Results"}
                  </AlertTitle>
                  <AlertDescription className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                            <p className="font-medium text-foreground">With New EMI of {formatCurrency(parseFloat(newEmiAmountInput))}:</p>
                            <ul className="list-disc list-inside text-muted-foreground pl-1">
                                <li>New Projected Closure: <span className="font-semibold text-foreground">{analysisResults.newProjectedClosureDate ? formatDate(analysisResults.newProjectedClosureDate) : 'N/A'}</span></li>
                                <li>New Total Interest: <span className="font-semibold text-foreground">{formatCurrency(analysisResults.newTotalInterestPaid)}</span></li>
                            </ul>
                        </div>
                         <div>
                            <p className="font-medium text-foreground">Compared to Current EMI of {formatCurrency(analysisResults.originalMonthlyEMI)}:</p>
                            <ul className="list-disc list-inside text-muted-foreground pl-1">
                                <li>Original Projected Closure: <span className="font-semibold text-foreground">{analysisResults.originalProjectedClosureDate ? formatDate(analysisResults.originalProjectedClosureDate) : 'N/A'}</span></li>
                                <li>Original Total Interest: <span className="font-semibold text-foreground">{formatCurrency(analysisResults.originalTotalInterest)}</span></li>
                            </ul>
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-1">
                        <p className="text-base font-semibold text-primary flex items-center">
                            <CalendarDays className="mr-2 h-5 w-5" /> Time Saved: {analysisResults.timeSavedInMonths > 0 ? `${analysisResults.timeSavedInMonths} month(s)` : "No time saved (or extends tenure)"}
                        </p>
                        <p className="text-base font-semibold text-green-600 dark:text-green-500 flex items-center">
                           <TrendingDown className="mr-2 h-5 w-5" /> Interest Saved: {formatCurrency(analysisResults.totalInterestSaved > 0 ? analysisResults.totalInterestSaved : 0)}
                        </p>
                         {analysisResults.totalInterestSaved < 0 && (
                            <p className="text-sm text-destructive">Paying a lower EMI than required to cover interest would increase total interest and extend the loan indefinitely.</p>
                        )}
                    </div>
                     <p className="text-xs text-muted-foreground pt-2">
                        Note: This analysis assumes the new EMI is paid consistently starting from the next due date. It considers all previously recorded prepayments.
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </>
      )}
       {!selectedLoanId && !isLoadingLoans && !isLoadingSelectedLoanData && allLoans.length > 0 &&(
         <Card className="shadow-lg">
            <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">Please select a loan above to start your "what-if" analysis.</p>
            </CardContent>
         </Card>
      )}
       {!isLoadingLoans && allLoans.length === 0 && (
            <Alert variant="default">
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>No Loans Available for Analysis</AlertTitle>
                <AlertDescription>
                You currently have no loans added to your account. Please add a loan first to use the What-if Analyzer.
                <Button asChild variant="link" className="px-1">
                    <a href="/loans/add">Add a Loan</a>
                </Button>
                </AlertDescription>
            </Alert>
        )}
    </div>
  );
}


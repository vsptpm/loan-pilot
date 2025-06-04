
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
  calculateEMI,
  getInitialPaidEMIsCount,
  getLoanStatus
} from '@/lib/loanUtils';
import { Loader2, Edit3, Landmark as RecordIcon, ListChecks, Trash2, CircleDollarSign, Repeat, Wallet, Download } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RecordPrepaymentForm } from '@/components/loans/RecordPrepaymentForm';
import { parseISO, formatISO } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';


export default function LoanDetailPage() {
  const { id } = useParams();
  const loanIdString = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { user } = useAuth();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
    return getLoanStatus(loan, currentAmortizationSchedule, false); 
  }, [loan, currentAmortizationSchedule]);


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

  const handleExportToCSV = useCallback(() => {
    if (!loan || !currentAmortizationSchedule || !loanStatus) {
      toast({ title: "Error", description: "Loan data not available for export.", variant: "destructive" });
      return;
    }

    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return '""';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = [
      "Loan Name:", escapeCSV(loan.name),
      "\nOriginal Principal:", escapeCSV(formatCurrency(loan.principalAmount)),
      "\nInterest Rate:", escapeCSV(`${loan.interestRate}%`),
      "\nStart Date:", escapeCSV(formatDate(loan.startDate)),
      "\nTotal Prepayments Made:", escapeCSV(formatCurrency(loan.totalPrepaymentAmount || 0)),
      "\nOutstanding Balance (as of today):", escapeCSV(formatCurrency(loanStatus.currentBalance)),
      "\n" // Empty line
    ];
    
    const scheduleHeaders = ["Month", "Payment Date", "Payment", "Principal Paid", "Interest Paid", "Remaining Balance", "Status"];
    const scheduleRows = currentAmortizationSchedule.map(entry => [
      escapeCSV(entry.month),
      escapeCSV(formatDate(entry.paymentDate)),
      escapeCSV(formatCurrency(entry.payment)),
      escapeCSV(formatCurrency(entry.principalPaid)),
      escapeCSV(formatCurrency(entry.interestPaid)),
      escapeCSV(formatCurrency(entry.remainingBalance)),
      escapeCSV(entry.isPaid ? "Paid" : "Upcoming")
    ].join(','));

    const csvContent = headers.join('') + scheduleHeaders.join(',') + '\n' + scheduleRows.join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const safeLoanName = loan.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.setAttribute("download", `loan_schedule_${safeLoanName}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Loan schedule exported to CSV."});
    } else {
      toast({ title: "Error", description: "CSV export not supported by your browser.", variant: "destructive"});
    }
  }, [loan, currentAmortizationSchedule, loanStatus, toast]);


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
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-2xl sm:text-3xl font-headline flex-grow">{loan.name}</CardTitle>
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
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
              <Button variant="outline" size="sm" className="h-9" onClick={handleExportToCSV}>
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>
          <CardDescription>Detailed overview of your loan, reflecting all recorded prepayments. Assumes on-time EMI payments up to today.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                 <div className="md:col-span-2"> 
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

    </div>
  );
}


    
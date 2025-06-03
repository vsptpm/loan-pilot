
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth';
import type { Loan, AmortizationEntry } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { PlusCircle, Edit3, Trash2, MoreVertical, Loader2, SearchX, Info } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as UIDialogTitle, // Renamed to avoid conflict with CardTitle
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { NoLoansFoundIllustration } from '@/components/illustrations/NoLoansFoundIllustration';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  calculateEMI,
  generateAmortizationSchedule,
  getLoanStatus,
  getInitialPaidEMIsCount,
  type LoanStatus,
} from '@/lib/loanUtils';

interface LoanDisplaySummary {
  id: string;
  name: string;
  interestRate: number;
  monthlyEMI: number;
  currentPrincipal: number;
  completedPercentage: number;
  nextDueDate: string | null;
}

export default function LoansPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    if (!user) {
      setLoans([]);
      setIsLoading(false);
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
      console.error("Error fetching loans: ", error);
      toast({ title: "Error", description: "Could not fetch loans.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const loanDisplayData = useMemo((): LoanDisplaySummary[] => {
    const loansToProcess = searchQuery
      ? loans.filter(loan => loan.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : loans;

    return loansToProcess.map(loan => {
      const monthlyEMI = calculateEMI(loan.principalAmount, loan.interestRate, loan.durationMonths);
      const initialPaidEMIs = getInitialPaidEMIsCount(loan.amountAlreadyPaid, monthlyEMI);
      // IMPORTANT: Loan list summaries DO NOT fetch/use recordedPrepayments for individual loans here for performance.
      // The schedule generated here is based on original terms + amountAlreadyPaid only.
      const schedule = generateAmortizationSchedule(
        loan.principalAmount,
        loan.interestRate,
        loan.durationMonths,
        loan.startDate,
        initialPaidEMIs
        // No recordedPrepayments passed here
      );
      const status = getLoanStatus(loan, schedule);

      return {
        id: loan.id,
        name: loan.name,
        interestRate: loan.interestRate,
        monthlyEMI: monthlyEMI,
        currentPrincipal: status.currentBalance,
        completedPercentage: status.completedPercentage,
        nextDueDate: status.nextDueDate,
      };
    });
  }, [loans, searchQuery]);

  const handleDeleteLoan = async (loanId: string) => {
    if (!user) return;
    try {
      // Optional: Delete subcollections like 'prepayments' if they exist and you want a full cleanup
      // This needs to be handled carefully, possibly with a Firebase Function for robustness.
      // For now, just deleting the loan document.
      await deleteDoc(doc(db, `users/${user.uid}/loans`, loanId));
      toast({ title: "Success", description: "Loan deleted successfully." });
    } catch (error) {
      console.error("Error deleting loan: ", error);
      toast({ title: "Error", description: "Could not delete loan.", variant: "destructive" });
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading loans...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-headline tracking-tight">Your Loans {searchQuery && `(Results for "${searchQuery}")`}</h1>
        <Link href="/loans/add" legacyBehavior>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Loan
          </Button>
        </Link>
      </div>

      {loanDisplayData.length > 0 && !searchQuery && (
         <Alert className="mb-6 shadow-md">
          <Info className="h-4 w-4" />
          <AlertTitle>Loan Card Information</AlertTitle>
          <AlertDescription>
            The loan summaries displayed on this page are based on original loan terms and any &apos;amount already paid&apos; at the start.
            They do not yet reflect individually recorded prepayments. For the most up-to-date figures including all prepayments,
            please click on a loan card to view its specific detail page.
          </AlertDescription>
        </Alert>
      )}

      {loans.length === 0 && !searchQuery ? (
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">No Loans Found</CardTitle>
            <CardDescription>Start managing your finances by adding your first loan.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
             <NoLoansFoundIllustration className="mb-6 rounded-md" width={300} height={200} />
            <p className="mb-4 text-muted-foreground">
              You haven&apos;t added any loans yet. Click the button above to get started.
            </p>
            <Link href="/loans/add" legacyBehavior>
              <Button size="lg">
                <PlusCircle className="mr-2 h-5 w-5" /> Add Your First Loan
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : loanDisplayData.length === 0 && searchQuery ? (
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">No Loans Match Your Search</CardTitle>
            <CardDescription>No loans found for &quot;{searchQuery}&quot;. Try a different search term or clear the search.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
             <SearchX className="h-24 w-24 text-muted-foreground mb-6" />
            <p className="mb-4 text-muted-foreground">
              Please try searching with different keywords or <Link href="/loans" className="text-primary hover:underline">clear the search</Link> to see all loans.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {loanDisplayData.map((loanSummary) => (
            <Link key={loanSummary.id} href={`/loans/${loanSummary.id}`} legacyBehavior passHref>
              <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer h-full flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-xl hover:underline mr-2">
                      {loanSummary.name}
                    </CardTitle>
                    <div className="flex items-center flex-shrink-0">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary mr-2 whitespace-nowrap">
                        {loanSummary.interestRate}% APR
                      </span>
                      <AlertDialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8" 
                              onClick={(e) => { 
                                e.preventDefault(); 
                                e.stopPropagation(); 
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              asChild 
                              onClick={(e) => { 
                                e.preventDefault(); 
                                e.stopPropagation(); 
                              }}
                            >
                              <Link href={`/loans/edit/${loanSummary.id}`} legacyBehavior passHref>
                                <a><Edit3 className="mr-2 h-4 w-4" />Edit</a>
                              </Link>
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={(e) => { 
                                  e.preventDefault(); 
                                  e.stopPropagation(); 
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <UIDialogTitle>Are you sure?</UIDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the loan &quot;{loanSummary.name}&quot; and all its associated data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={(e) => { e.stopPropagation(); }}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={(e) => { e.stopPropagation(); handleDeleteLoan(loanSummary.id); }} className="bg-destructive hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardDescription>
                    Next payment due: {loanSummary.nextDueDate ? formatDate(loanSummary.nextDueDate) : (loanSummary.currentPrincipal === 0 ? 'Paid Off' : 'N/A')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 flex-grow">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pending Balance:</span>
                    <span className="font-semibold">{formatCurrency(loanSummary.currentPrincipal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Monthly EMI:</span>
                    <span className="font-semibold">{formatCurrency(loanSummary.monthlyEMI)}</span>
                  </div>
                  <div>
                    <Progress value={loanSummary.completedPercentage} className="h-3 mt-1" />
                    <p className="text-xs text-muted-foreground mt-1 text-right">
                      {loanSummary.completedPercentage.toFixed(2)}% paid
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


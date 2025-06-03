
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import type { Loan } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { PlusCircle, Edit3, Trash2, Eye, Landmark, Percent, CalendarDays, CircleDollarSign, MoreVertical, Loader2, SearchX } from 'lucide-react';
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
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { NoLoansFoundIllustration } from '@/components/illustrations/NoLoansFoundIllustration';
import { formatCurrency, formatDate } from '@/lib/utils';

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

  const filteredLoans = useMemo(() => {
    if (!searchQuery) {
      return loans;
    }
    return loans.filter(loan =>
      loan.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [loans, searchQuery]);

  const handleDeleteLoan = async (loanId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/loans`, loanId));
      toast({ title: "Success", description: "Loan deleted successfully." });
    } catch (error) {
      console.error("Error deleting loan: ", error);
      toast({ title: "Error", description: "Could not delete loan.", variant: "destructive" });
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
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
      ) : filteredLoans.length === 0 && searchQuery ? (
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">No Loans Match Your Search</CardTitle>
            <CardDescription>No loans found for "{searchQuery}". Try a different search term or clear the search.</CardDescription>
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
          {filteredLoans.map((loan) => (
            <Card key={loan.id} className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="font-headline text-xl">{loan.name}</CardTitle>
                  <AlertDialog>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Link href={`/loans/${loan.id}`} passHref legacyBehavior>
                          <DropdownMenuItem><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                        </Link>
                        <Link href={`/loans/edit/${loan.id}`} passHref legacyBehavior>
                         <DropdownMenuItem><Edit3 className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                        </Link>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the loan "{loan.name}" and all its associated data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteLoan(loan.id)} className="bg-destructive hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 flex-grow">
                <div className="flex items-center text-sm text-muted-foreground">
                  <CircleDollarSign className="mr-2 h-4 w-4 text-primary" />
                  Principal: <span className="ml-1 font-medium text-foreground">{formatCurrency(loan.principalAmount)}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Percent className="mr-2 h-4 w-4 text-primary" />
                  Interest Rate: <span className="ml-1 font-medium text-foreground">{loan.interestRate}%</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <CalendarDays className="mr-2 h-4 w-4 text-primary" />
                  Term: <span className="ml-1 font-medium text-foreground">{loan.durationMonths} months</span>
                </div>
                 <div className="flex items-center text-sm text-muted-foreground">
                  <Landmark className="mr-2 h-4 w-4 text-primary" />
                  Start Date: <span className="ml-1 font-medium text-foreground">{formatDate(loan.startDate)}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Link href={`/loans/${loan.id}`} legacyBehavior passHref>
                  <Button variant="outline" className="w-full">
                    <Eye className="mr-2 h-4 w-4" /> View Details
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

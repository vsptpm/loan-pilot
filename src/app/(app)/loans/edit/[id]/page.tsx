
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LoanForm } from '@/components/loans/LoanForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { processLoanFormData } from '@/lib/loanUtils';
import type { Loan, LoanFormData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function EditLoanPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const loanId = params.id as string;

  const [initialLoanData, setInitialLoanData] = useState<LoanFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submission
  const [isFetching, setIsFetching] = useState(true); // For fetching initial loan data

  useEffect(() => {
    if (!user || !loanId) {
      // If user or loanId is not available, we cannot fetch.
      // isFetching should be set to false if we determine fetching is not possible.
      // If user is still loading, the AuthProvider's loading state handles global loading.
      setIsFetching(false); 
      return;
    }

    const fetchLoan = async () => {
      setIsFetching(true); // Indicate fetching has started
      try {
        const loanDocRef = doc(db, `users/${user.uid}/loans`, loanId);
        const loanDocSnap = await getDoc(loanDocRef);

        if (loanDocSnap.exists()) {
          const loanData = loanDocSnap.data() as Loan;
          
          let durationValue: number;
          let durationUnit: 'months' | 'years';

          if (loanData.durationMonths % 12 === 0) {
            durationValue = loanData.durationMonths / 12;
            durationUnit = 'years';
          } else {
            durationValue = loanData.durationMonths;
            durationUnit = 'months';
          }

          setInitialLoanData({
            name: loanData.name,
            principalAmount: loanData.principalAmount,
            interestRate: loanData.interestRate,
            duration: durationValue,
            durationType: durationUnit,
            startDate: new Date(loanData.startDate), // Convert ISO string to Date object
            amountAlreadyPaid: loanData.amountAlreadyPaid,
          });
        } else {
          toast({ title: 'Error', description: 'Loan not found.', variant: 'destructive' });
          router.push('/loans');
        }
      } catch (error) {
        console.error('Error fetching loan: ', error);
        toast({ title: 'Error', description: 'Could not fetch loan details.', variant: 'destructive' });
        router.push('/loans');
      } finally {
        setIsFetching(false); // Indicate fetching has completed (successfully or not)
      }
    };

    fetchLoan();
  }, [user, loanId, toast, router]);

  const handleEditLoan = async (data: LoanFormData) => {
    if (!user || !loanId) {
      toast({ title: 'Error', description: 'User or loan ID missing.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const processedData = processLoanFormData(data); // This converts durationType to durationMonths
      const loanUpdatePayload = {
        ...processedData, 
        updatedAt: serverTimestamp(),
      };
      
      delete (loanUpdatePayload as any).userId;
      delete (loanUpdatePayload as any).createdAt;

      const loanDocRef = doc(db, `users/${user.uid}/loans`, loanId);
      await updateDoc(loanDocRef, loanUpdatePayload);

      toast({ title: 'Success', description: 'Loan updated successfully!' });
      router.push(`/loans/${loanId}`); 
    } catch (error) {
      console.error('Error updating loan: ', error);
      toast({ title: 'Error', description: 'Could not update loan. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Loading loan data...</p>
      </div>
    );
  }

  if (!initialLoanData && !isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)]">
        <p className="text-lg text-muted-foreground">Unable to load loan data. You may have been redirected.</p>
      </div>
    );
  }
  
  return (
    initialLoanData && (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl font-headline">Edit Loan</CardTitle>
            <CardDescription>Update the details of your loan below.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoanForm 
              onSubmit={handleEditLoan} 
              initialData={initialLoanData} 
              isLoading={isSubmitting} 
              submitButtonText="Save Changes" 
            />
          </CardContent>
        </Card>
      </div>
    )
  );
}

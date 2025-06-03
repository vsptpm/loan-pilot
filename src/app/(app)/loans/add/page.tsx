'use client';

import { LoanForm } from '@/components/loans/LoanForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { processLoanFormData } from '@/lib/loanUtils';
import type { LoanFormData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function AddLoanPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleAddLoan = async (data: LoanFormData) => {
    if (!user) {
      toast({ title: 'Error', description: 'You must be logged in to add a loan.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const processedData = processLoanFormData(data);
      const loanPayload = {
        ...processedData,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const loansCol = collection(db, `users/${user.uid}/loans`);
      await addDoc(loansCol, loanPayload);

      toast({ title: 'Success', description: 'Loan added successfully!' });
      router.push('/loans');
    } catch (error) {
      console.error('Error adding loan: ', error);
      toast({ title: 'Error', description: 'Could not add loan. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">Add New Loan</CardTitle>
          <CardDescription>Fill in the details below to add a new loan to your tracker.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoanForm onSubmit={handleAddLoan} isLoading={isLoading} submitButtonText="Add Loan" />
        </CardContent>
      </Card>
    </div>
  );
}
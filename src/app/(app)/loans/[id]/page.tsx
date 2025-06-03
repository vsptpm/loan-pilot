
'use client';

import { useEffect, useState } from 'react';
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
import { useAuth } from '@/hooks/useAuth';
import type { Loan, AmortizationEntry } from '@/types';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
} from 'firebase/firestore';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { generateAmortizationSchedule as generateRepaymentSchedule } from '@/lib/loanUtils';


export default function LoanDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();


  const fetchLoan = async (loanId: string) => {
    if (!user) return;
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
        router.push('/dashboard'); 
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
  };


  useEffect(() => {
    if (id && user) {
      const loanId = Array.isArray(id) ? id[0] : id;
      fetchLoan(loanId);
    }
  }, [id, user, router, toast]);


  if (loading) {
    return <div>Loading loan details...</div>;
  }

  if (!loan) {
    return null; 
  }

  const originalSchedule: AmortizationEntry[] = generateRepaymentSchedule(
    loan.principalAmount,
    loan.interestRate,
    loan.durationMonths,
    loan.startDate,
    // Calculate initial paid EMIs based on amountAlreadyPaid if needed for 'isPaid' status
    // This example assumes amountAlreadyPaid reduces principal before schedule generation
    // or schedule is already aware of it. For 'isPaid' flags, explicit logic may be needed here.
  );

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-headline">{loan.name}</CardTitle>
          <CardDescription>Detailed overview of your loan and its repayment schedule.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-primary mb-2">Loan Information</h3>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date:</span>
              <span className="font-medium">{formatDate(loan.startDate)}</span>
            </div>
             <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Initially Paid:</span>
              <span className="font-medium">{formatCurrency(loan.amountAlreadyPaid)}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-primary mb-2">Original Repayment Schedule</h3>
            {originalSchedule.length > 0 ? (
              <div className="max-h-[calc(theme(spacing.96)_+_theme(spacing.12))] overflow-y-auto border rounded-md"> {/* Increased max height & added border */}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { calculateEMI } from '@/lib/loanUtils';
import { formatCurrency } from '@/lib/utils';
import { Loader2, CalculatorIcon } from 'lucide-react'; // Using CalculatorIcon here for variety
import { Separator } from '@/components/ui/separator';

const emiCalculatorSchema = z.object({
  principalAmount: z.coerce
    .number({ invalid_type_error: 'Principal must be a number.' })
    .positive({ message: 'Principal amount must be positive.' }),
  annualInterestRate: z.coerce
    .number({ invalid_type_error: 'Interest rate must be a number.' })
    .min(0, { message: 'Interest rate cannot be negative.' })
    .max(100, { message: 'Interest rate seems too high (max 100%).' }),
  loanTenure: z.coerce
    .number({ invalid_type_error: 'Tenure must be a number.' })
    .positive({ message: 'Loan tenure must be positive.' })
    .int({ message: 'Loan tenure must be a whole number.' }),
  tenureType: z.enum(['months', 'years'], { required_error: 'Tenure type is required.' }),
});

type EmiCalculatorFormValues = z.infer<typeof emiCalculatorSchema>;

interface EmiResults {
  monthlyEMI: number;
  totalInterest: number;
  totalAmountPayable: number;
  principalAmount: number;
  annualInterestRate: number;
  loanTenureMonths: number;
}

export default function EmiCalculatorPage() {
  const [emiResults, setEmiResults] = useState<EmiResults | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const form = useForm<EmiCalculatorFormValues>({
    resolver: zodResolver(emiCalculatorSchema),
    defaultValues: {
      principalAmount: undefined,
      annualInterestRate: undefined,
      loanTenure: undefined,
      tenureType: 'years',
    },
  });

  const onSubmit: SubmitHandler<EmiCalculatorFormValues> = (data) => {
    setIsCalculating(true);
    setEmiResults(null);

    const { principalAmount, annualInterestRate, loanTenure, tenureType } = data;
    const tenureInMonths = tenureType === 'years' ? loanTenure * 12 : loanTenure;

    if (tenureInMonths <= 0) {
        form.setError("loanTenure", { type: "manual", message: "Total tenure in months must be positive."});
        setIsCalculating(false);
        return;
    }
    
    const monthlyEMI = calculateEMI(principalAmount, annualInterestRate, tenureInMonths);

    if (monthlyEMI === 0 && principalAmount > 0) {
        // This case might indicate an issue or zero interest loan over very long term, handle appropriately
         if (annualInterestRate === 0) {
            // For zero interest, total interest is 0
            setEmiResults({
                monthlyEMI,
                totalInterest: 0,
                totalAmountPayable: principalAmount,
                principalAmount,
                annualInterestRate,
                loanTenureMonths: tenureInMonths,
            });
        } else {
            // Could be an edge case where EMI is effectively zero due to very small principal/rate over long term
            // Or an error in inputs.
            form.setError("root", { message: "Could not calculate a valid EMI. Please check inputs, especially for very long tenures or low principal/rate combinations."});
        }

    } else {
        const totalAmountPayable = monthlyEMI * tenureInMonths;
        const totalInterest = totalAmountPayable - principalAmount;
        setEmiResults({
            monthlyEMI,
            totalInterest,
            totalAmountPayable,
            principalAmount,
            annualInterestRate,
            loanTenureMonths: tenureInMonths,
        });
    }
    
    setIsCalculating(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center">
            <CalculatorIcon className="mr-3 h-7 w-7 text-primary" /> EMI Calculator
          </CardTitle>
          <CardDescription>
            Calculate your Equated Monthly Installment (EMI) for loans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="principalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Principal Loan Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 500000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="annualInterestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annual Interest Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g., 8.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="loanTenure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Tenure</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 5 or 60" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tenureType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tenure Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tenure type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="years">Years</SelectItem>
                          <SelectItem value="months">Months</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {form.formState.errors.root && (
                <FormMessage>{form.formState.errors.root.message}</FormMessage>
              )}
              <Button type="submit" className="w-full md:w-auto" disabled={isCalculating}>
                {isCalculating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CalculatorIcon className="mr-2 h-4 w-4" />
                )}
                Calculate EMI
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {emiResults && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Calculation Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-primary/10 p-6 rounded-lg text-center">
              <Label className="text-sm text-primary font-medium">Monthly EMI</Label>
              <p className="text-4xl font-bold text-primary">{formatCurrency(emiResults.monthlyEMI)}</p>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Principal Amount:</span>
                <span className="font-medium">{formatCurrency(emiResults.principalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Annual Interest Rate:</span>
                <span className="font-medium">{emiResults.annualInterestRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loan Tenure:</span>
                <span className="font-medium">{emiResults.loanTenureMonths} months</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Interest Payable:</span>
                <span className="font-medium">{formatCurrency(emiResults.totalInterest)}</span>
              </div>
              <div className="flex justify-between col-span-1 md:col-span-2 text-base pt-2">
                <span className="text-muted-foreground font-semibold">Total Amount Payable:</span>
                <span className="font-bold text-foreground">{formatCurrency(emiResults.totalAmountPayable)}</span>
              </div>
            </div>
             <p className="text-xs text-muted-foreground pt-2">
                Note: This calculation is an estimate. Actual EMI may vary based on the lender's policies.
              </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

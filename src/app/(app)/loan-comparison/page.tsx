
'use client';

import { useState, useEffect, useMemo } from 'react'; // Added useMemo here
import { useForm, useFieldArray, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { calculateEMI } from '@/lib/loanUtils';
import { formatCurrency } from '@/lib/utils';
import { Loader2, PlusCircle, Trash2, Scale, TrendingDown, TrendingUp, BadgeCheck, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const loanOfferSchema = z.object({
  name: z.string().optional(),
  principalAmount: z.coerce
    .number({ invalid_type_error: 'Principal must be a number.' })
    .positive({ message: 'Principal must be positive.' }),
  annualInterestRate: z.coerce
    .number({ invalid_type_error: 'Rate must be a number.' })
    .min(0, { message: 'Rate cannot be negative.' })
    .max(100, { message: 'Rate seems too high (max 100%).' }),
  loanTenure: z.coerce
    .number({ invalid_type_error: 'Tenure must be a number.' })
    .positive({ message: 'Tenure must be positive.' })
    .int({ message: 'Tenure must be a whole number.' }),
  tenureType: z.enum(['months', 'years'], { required_error: 'Tenure type is required.' }),
});

const comparisonFormSchema = z.object({
  loanOffers: z.array(loanOfferSchema).min(1, "Add at least one loan offer.").max(3, "You can compare up to 3 loans."),
});

type ComparisonFormValues = z.infer<typeof comparisonFormSchema>;

interface LoanComparisonResult extends z.infer<typeof loanOfferSchema> {
  id: string;
  monthlyEMI?: number;
  totalInterestPayable?: number;
  totalAmountPayable?: number;
}

export default function LoanComparisonPage() {
  const [comparisonResults, setComparisonResults] = useState<LoanComparisonResult[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const form = useForm<ComparisonFormValues>({
    resolver: zodResolver(comparisonFormSchema),
    defaultValues: {
      loanOffers: [{ name: 'Loan Offer 1', principalAmount: undefined, annualInterestRate: undefined, loanTenure: undefined, tenureType: 'years' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'loanOffers',
  });

  const onSubmit: SubmitHandler<ComparisonFormValues> = (data) => {
    setIsComparing(true);
    setComparisonResults([]); // Clear previous results

    const results: LoanComparisonResult[] = data.loanOffers.map((offer, index) => {
      const tenureInMonths = offer.tenureType === 'years' ? offer.loanTenure * 12 : offer.loanTenure;
      if (tenureInMonths <= 0) {
        form.setError(`loanOffers.${index}.loanTenure`, { message: "Total tenure in months must be positive." });
        return { ...offer, id: fields[index].id }; // Return with error indication if needed
      }
      
      const monthlyEMI = calculateEMI(offer.principalAmount, offer.annualInterestRate, tenureInMonths);
      
      if (monthlyEMI === 0 && offer.principalAmount > 0 && offer.annualInterestRate > 0) {
         form.setError(`loanOffers.${index}.root`, { message: "Could not calculate valid EMI." });
         return { ...offer, id: fields[index].id };
      }

      const totalAmountPayable = monthlyEMI * tenureInMonths;
      const totalInterestPayable = totalAmountPayable - offer.principalAmount;

      return {
        ...offer,
        id: fields[index].id,
        monthlyEMI: parseFloat(monthlyEMI.toFixed(2)),
        totalInterestPayable: parseFloat(totalInterestPayable.toFixed(2)),
        totalAmountPayable: parseFloat(totalAmountPayable.toFixed(2)),
      };
    });
    
    // Check if any errors were set during calculation
    const hasErrors = data.loanOffers.some((_, index) => form.formState.errors.loanOffers?.[index]);
    if (hasErrors) {
        setIsComparing(false);
        return;
    }

    setComparisonResults(results);
    setIsComparing(false);
  };

  const addLoanOffer = () => {
    if (fields.length < 3) {
      append({ name: `Loan Offer ${fields.length + 1}`, principalAmount: undefined, annualInterestRate: undefined, loanTenure: undefined, tenureType: 'years' });
    }
  };

  const bestValues = useMemo(() => {
    if (!comparisonResults || comparisonResults.length === 0 || comparisonResults.some(r => r.monthlyEMI === undefined)) {
      return { emi: null, interest: null, total: null };
    }
    const validResults = comparisonResults.filter(r => r.monthlyEMI !== undefined);
    if (validResults.length === 0) return { emi: null, interest: null, total: null };

    const bestEMI = Math.min(...validResults.map(r => r.monthlyEMI!));
    const bestInterest = Math.min(...validResults.map(r => r.totalInterestPayable!));
    const bestTotal = Math.min(...validResults.map(r => r.totalAmountPayable!));
    return { emi: bestEMI, interest: bestInterest, total: bestTotal };
  }, [comparisonResults]);


  return (
    <div className="space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-headline flex items-center">
            <Scale className="mr-3 h-7 w-7 text-primary" /> Loan Comparison Tool
          </CardTitle>
          <CardDescription>
            Compare multiple loan offers side-by-side to find the best option for you. Add up to 3 loan offers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {fields.map((field, index) => (
                <Card key={field.id} className="pt-4 border-dashed hover:border-solid">
                  <CardHeader className="py-0 px-6 flex flex-row items-center justify-between">
                    <FormField
                      control={form.control}
                      name={`loanOffers.${index}.name`}
                      render={({ field: nameField }) => (
                        <FormItem className="flex-grow mr-4">
                          <FormLabel className="sr-only">Loan Offer Name {index + 1}</FormLabel>
                          <FormControl>
                            <Input placeholder={`Loan Offer ${index + 1}`} {...nameField} className="text-lg font-semibold border-0 shadow-none px-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto py-1" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove Loan Offer</span>
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <FormField
                      control={form.control}
                      name={`loanOffers.${index}.principalAmount`}
                      render={({ field: pField }) => (
                        <FormItem>
                          <FormLabel>Principal Amount (₹)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="e.g., 500000" {...pField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`loanOffers.${index}.annualInterestRate`}
                      render={({ field: rField }) => (
                        <FormItem>
                          <FormLabel>Annual Interest Rate (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="e.g., 8.5" {...rField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`loanOffers.${index}.loanTenure`}
                        render={({ field: tField }) => (
                          <FormItem>
                            <FormLabel>Loan Tenure</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g., 5 or 60" {...tField} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`loanOffers.${index}.tenureType`}
                        render={({ field: ttField }) => (
                          <FormItem>
                            <FormLabel>Tenure Type</FormLabel>
                            <Controller
                                control={form.control}
                                name={`loanOffers.${index}.tenureType`}
                                render={({ field: cField }) => (
                                    <Select onValueChange={cField.onChange} defaultValue={cField.value}>
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
                                )}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {form.formState.errors.loanOffers?.[index]?.root && (
                        <FormMessage>{form.formState.errors.loanOffers[index]?.root?.message}</FormMessage>
                    )}
                  </CardContent>
                </Card>
              ))}
              
              <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLoanOffer}
                  disabled={fields.length >= 3 || isComparing}
                  className="w-full sm:w-auto"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add {fields.length > 0 ? 'Another' : 'Loan'} Offer
                </Button>
                <Button type="submit" className="w-full sm:w-auto" disabled={isComparing || fields.length === 0}>
                  {isComparing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Scale className="mr-2 h-4 w-4" />
                  )}
                  Compare Loans
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {comparisonResults.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Comparison Results</CardTitle>
            <CardDescription>Here's how the loan offers stack up. Best values are highlighted.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`grid grid-cols-1 md:grid-cols-${comparisonResults.length} gap-4`}>
              {comparisonResults.map((result) => (
                <Card key={result.id} className={cn("flex flex-col", result.monthlyEMI === undefined && "border-destructive")}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg truncate">{result.name || `Offer ${comparisonResults.indexOf(result) + 1}`}</CardTitle>
                    {result.monthlyEMI === undefined && 
                        <BadgeCheck className="h-4 w-4 text-destructive mr-1 self-start" />
                    }
                    <CardDescription>
                      {formatCurrency(result.principalAmount)} @ {result.annualInterestRate}% for {result.loanTenure} {result.tenureType}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 flex-grow">
                    {result.monthlyEMI !== undefined ? (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Monthly EMI</Label>
                          <p className={cn("text-2xl font-bold", result.monthlyEMI === bestValues.emi && "text-green-600 dark:text-green-500")}>
                            {formatCurrency(result.monthlyEMI)}
                            {result.monthlyEMI === bestValues.emi && <BadgeCheck className="inline-block ml-2 h-5 w-5 text-green-600 dark:text-green-500" />}
                          </p>
                        </div>
                        <Separator />
                        <div>
                          <Label className="text-xs text-muted-foreground">Total Interest Payable</Label>
                          <p className={cn("text-lg font-semibold", result.totalInterestPayable === bestValues.interest && "text-green-600 dark:text-green-500")}>
                            {formatCurrency(result.totalInterestPayable)}
                            {result.totalInterestPayable === bestValues.interest && <BadgeCheck className="inline-block ml-1 h-4 w-4 text-green-600 dark:text-green-500" />}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Total Amount Payable</Label>
                          <p className={cn("text-lg font-semibold", result.totalAmountPayable === bestValues.total && "text-green-600 dark:text-green-500")}>
                            {formatCurrency(result.totalAmountPayable)}
                            {result.totalAmountPayable === bestValues.total && <BadgeCheck className="inline-block ml-1 h-4 w-4 text-green-600 dark:text-green-500" />}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="text-destructive flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        <p>Could not calculate EMI. Please check inputs.</p>
                      </div>
                    )}
                  </CardContent>
                  {result.monthlyEMI !== undefined && (
                    <CardFooter className="pt-3">
                        {result.monthlyEMI === bestValues.emi && result.totalInterestPayable === bestValues.interest && result.totalAmountPayable === bestValues.total ? (
                            <p className="text-xs text-green-600 dark:text-green-500 font-semibold flex items-center"><BadgeCheck className="h-4 w-4 mr-1"/>Overall Best Offer</p>
                        ) : (
                             <p className="text-xs text-muted-foreground">&nbsp;</p> // Placeholder for alignment
                        )}
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Note: Calculations are estimates. Actual values may vary based on lender policies.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


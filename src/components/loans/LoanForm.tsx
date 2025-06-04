
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { LoanFormData } from '@/types';
import { useState } from 'react';

const currentYear = new Date().getFullYear();

const loanFormSchema = z.object({
  name: z.string().min(2, { message: 'Loan name must be at least 2 characters.' }).max(50, { message: 'Loan name must be 50 characters or less.'}),
  principalAmount: z.coerce.number().positive({ message: 'Principal amount must be positive.' }),
  interestRate: z.coerce.number().min(0, { message: 'Interest rate cannot be negative.' }).max(100, { message: 'Interest rate seems too high.' }),
  duration: z.coerce.number().positive({ message: 'Duration must be positive.' }).int(),
  durationType: z.enum(['months', 'years']),
  startDate: z.date({ required_error: 'Loan start date is required.' })
    .max(new Date(currentYear + 50, 0, 1), { message: "Start date seems too far in the future." })
    .min(new Date(currentYear - 100, 0, 1), { message: "Start date seems too far in the past." }),
  amountAlreadyPaid: z.coerce.number().min(0, { message: 'Amount paid cannot be negative.' }).optional(),
});

type LoanFormProps = {
  onSubmit: (data: LoanFormData) => Promise<void>;
  initialData?: Partial<LoanFormData>;
  isLoading?: boolean;
  submitButtonText?: string;
};

export function LoanForm({ onSubmit, initialData, isLoading = false, submitButtonText = "Save Loan" }: LoanFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof loanFormSchema>>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      principalAmount: initialData?.principalAmount || undefined,
      interestRate: initialData?.interestRate || undefined,
      duration: initialData?.duration || undefined,
      durationType: initialData?.durationType || 'years',
      startDate: initialData?.startDate ? new Date(initialData.startDate) : new Date(),
      amountAlreadyPaid: initialData?.amountAlreadyPaid || undefined,
    },
  });

  const handleFormSubmit = async (values: z.infer<typeof loanFormSchema>) => {
    setIsSubmitting(true);
    await onSubmit(values);
    setIsSubmitting(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Loan Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Car Loan, Home Renovation" {...field} />
              </FormControl>
              <FormDescription>Give your loan a descriptive name.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="principalAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Principal Amount (₹)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="e.g., 100000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="interestRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Annual Interest Rate (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="e.g., 5.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Loan Term / Duration</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g., 5 or 60" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="durationType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration type" />
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Loan Start Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}
                      >
                        {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date > new Date(new Date().setFullYear(new Date().getFullYear() + 50)) || date < new Date(new Date().setFullYear(new Date().getFullYear() - 100))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="amountAlreadyPaid"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount Already Paid (₹) (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="e.g., 10000" 
                    {...field} 
                    onChange={e => field.onChange(e.target.value === '' ? undefined : +e.target.value)} 
                    value={field.value !== undefined ? String(field.value) : ""} 
                  />
                </FormControl>
                <FormDescription>If you&apos;ve already made some payments.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={isLoading || isSubmitting}>
          {(isLoading || isSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitButtonText}
        </Button>
      </form>
    </Form>
  );
}

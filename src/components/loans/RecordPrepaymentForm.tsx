
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { RecordedPrepaymentFormData } from '@/types';

interface RecordPrepaymentFormProps {
  onSubmit: (data: RecordedPrepaymentFormData) => Promise<void>;
  isLoading?: boolean;
  loanStartDate: Date; // To ensure prepayment date is not before loan start
  onCancel: () => void;
}

export function RecordPrepaymentForm({ onSubmit, isLoading = false, loanStartDate, onCancel }: RecordPrepaymentFormProps) {
  
  const prepaymentFormSchema = z.object({
    amount: z.coerce.number().positive({ message: 'Prepayment amount must be positive.' }),
    date: z.date({ required_error: 'Prepayment date is required.' })
      .min(loanStartDate, { message: `Prepayment date cannot be before loan start date (${format(loanStartDate, 'PPP')}).` })
      .max(new Date(), { message: "Prepayment date cannot be in the future." }),
    notes: z.string().max(200, { message: 'Notes must be 200 characters or less.' }).optional(),
  });
  
  const form = useForm<z.infer<typeof prepaymentFormSchema>>({
    resolver: zodResolver(prepaymentFormSchema),
    defaultValues: {
      amount: undefined,
      date: new Date(),
      notes: '',
    },
  });

  const handleFormSubmit = async (values: z.infer<typeof prepaymentFormSchema>) => {
    await onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prepayment Amount (₹)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" placeholder="e.g., 5000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Prepayment Date</FormLabel>
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
                    disabled={(date) => date > new Date() || date < loanStartDate}
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
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="e.g., Bonus payment, sold old bike" {...field} />
              </FormControl>
              <FormDescription>Any notes about this prepayment.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Prepayment
          </Button>
        </div>
      </form>
    </Form>
  );
}

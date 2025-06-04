
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
});

export function ResetPasswordForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, values.email);
      toast({
        title: 'Password Reset Email Sent',
        description: 'Check your inbox for instructions to reset your password.',
      });
    } catch (error: any) {
      toast({
        title: 'Error Sending Reset Email',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} type="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Send Reset Link
        </Button>
      </form>
    </Form>
  );
}

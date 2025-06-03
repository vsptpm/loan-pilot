'use server';

/**
 * @fileOverview Simulates the impact of loan prepayments on closure date, interest saved, and monthly payments.
 *
 * - simulatePrepayment - A function that handles the prepayment simulation process.
 * - SimulatePrepaymentInput - The input type for the simulatePrepayment function.
 * - SimulatePrepaymentOutput - The return type for the simulatePrepayment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SimulatePrepaymentInputSchema = z.object({
  principalAmount: z.number().describe('The original principal amount of the loan.'),
  interestRate: z.number().describe('The annual interest rate of the loan (as a decimal, e.g., 0.05 for 5%).'),
  loanTermMonths: z.number().describe('The total term of the loan in months.'),
  remainingBalance: z.number().describe('The current remaining balance on the loan.'),
  monthlyPayment: z.number().describe('The current monthly payment amount.'),
  prepaymentPercentage: z
    .number()
    .describe('The percentage of the remaining balance to prepay (as a decimal, e.g., 0.10 for 10%).'),
});
export type SimulatePrepaymentInput = z.infer<typeof SimulatePrepaymentInputSchema>;

const SimulatePrepaymentOutputSchema = z.object({
  newEstimatedClosureDate: z
    .string()
    .describe('The estimated date when the loan will be fully paid off after the prepayment.'),
  interestSaved: z
    .number()
    .describe('The total amount of interest saved by making the prepayment.'),
  newMonthlyPayment: z
    .number()
    .describe('The new monthly payment amount, if the prepayment results in a change to the payment schedule.'),
  summary: z
    .string()
    .describe('A summary of the impact of the prepayment, including estimated closure date, interest saved, and new monthly payment if applicable.'),
});
export type SimulatePrepaymentOutput = z.infer<typeof SimulatePrepaymentOutputSchema>;

export async function simulatePrepayment(input: SimulatePrepaymentInput): Promise<SimulatePrepaymentOutput> {
  return simulatePrepaymentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'simulatePrepaymentPrompt',
  input: {schema: SimulatePrepaymentInputSchema},
  output: {schema: SimulatePrepaymentOutputSchema},
  prompt: `You are a financial advisor specializing in loan prepayments. Given the loan details and the prepayment percentage provided by the user, you will calculate the new estimated closure date, the total interest saved, and the new monthly payment amount (if applicable).

Loan Details:
- Principal Amount: {{{principalAmount}}}
- Interest Rate: {{{interestRate}}}
- Loan Term (Months): {{{loanTermMonths}}}
- Remaining Balance: {{{remainingBalance}}}
- Monthly Payment: {{{monthlyPayment}}}
- Prepayment Percentage: {{{prepaymentPercentage}}}

Calculate the impact of the prepayment and provide a summary of the results. The summary should include the new estimated closure date, the total interest saved, and the new monthly payment if applicable.

Output the results in JSON format.
`,
});

const simulatePrepaymentFlow = ai.defineFlow(
  {
    name: 'simulatePrepaymentFlow',
    inputSchema: SimulatePrepaymentInputSchema,
    outputSchema: SimulatePrepaymentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

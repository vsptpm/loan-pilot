
'use server';
/**
 * @fileOverview AI flow for providing loan prepayment advice.
 *
 * - getPrepaymentAdvice - A function that invokes the AI flow.
 * - PrepaymentAdviceInputSchema - The Zod schema for the input.
 * - PrepaymentAdviceInput - The input type for the flow.
 * - PrepaymentAdviceOutputSchema - The Zod schema for the output.
 * - PrepaymentAdviceOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod'; // Corrected import for Zod

const LoanForAISchema = z.object({
  id: z.string().describe("The unique identifier of the loan."),
  name: z.string().describe("The name of the loan."),
  currentBalance: z.number().describe("The current outstanding balance of the loan."),
  interestRate: z.number().describe("The annual interest rate of the loan (e.g., 8.5 for 8.5%)."),
});

export const PrepaymentAdviceInputSchema = z.object({
  loans: z.array(LoanForAISchema).min(1, "At least one loan is required for advice.").describe("An array of the user's active loans."),
});
export type PrepaymentAdviceInput = z.infer<typeof PrepaymentAdviceInputSchema>;

export const PrepaymentAdviceOutputSchema = z.object({
  prioritizedLoanId: z.string().optional().describe("The ID of the loan recommended for prepayment. Omit if no specific loan is prioritized."),
  prioritizedLoanName: z.string().optional().describe("The name of the loan recommended for prepayment. Omit if no specific loan is prioritized."),
  reasoning: z.string().describe("The explanation for the recommendation. If no specific loan is prioritized (e.g., no loans, or all very low interest), this field should explain why and still offer general advice."),
  generalAdvice: z.string().describe("A general tip or consideration for loan prepayment strategies."),
});
export type PrepaymentAdviceOutput = z.infer<typeof PrepaymentAdviceOutputSchema>;

export async function getPrepaymentAdvice(input: PrepaymentAdviceInput): Promise<PrepaymentAdviceOutput> {
  return prepaymentAdviceFlow(input);
}

const prepaymentAdvicePrompt = ai.definePrompt({
  name: 'prepaymentAdvicePrompt',
  input: { schema: PrepaymentAdviceInputSchema },
  output: { schema: PrepaymentAdviceOutputSchema },
  prompt: `You are an expert financial advisor specializing in loan management and prepayment strategies.
Your goal is to help users save money on interest by making smart prepayment decisions.

Analyze the following list of active loans. Your primary strategy should be the "debt avalanche" method: identify the loan with the highest interest rate. This is the loan that, if prepaid, generally results in the greatest interest savings.

If multiple loans share the same highest interest rate, you can briefly mention considering the one with the smallest balance for a quicker win (debt snowball), but your primary recommendation should stick to the highest rate.
If no loans are provided (which shouldn't happen if the input schema is followed, but as a fallback), or if all loans have very low interest rates (e.g., below 2-3%) and the user might have better investment opportunities, you can state that aggressive prepayment might not be the top priority, but still offer general advice on financial health.

Provide the ID and name of the prioritized loan, a brief and clear explanation for your recommendation, and one general tip for loan prepayment strategies.
If you prioritize a loan, 'prioritizedLoanId' and 'prioritizedLoanName' must be populated with the correct details from the input.
If, for some reason, you cannot prioritize a specific loan based on the data, these fields can be omitted, and your 'reasoning' field should explain this and provide general financial guidance.

User's active loans:
{{#if loans.length}}
  {{#each loans}}
  - Loan ID: {{{id}}}, Name: {{{name}}}, Current Balance: {{currentBalance}}, Interest Rate: {{interestRate}}%
  {{/each}}
{{else}}
  No active loans were provided for analysis.
{{/if}}

Please ensure your output strictly follows the JSON schema provided for the output.
`,
});

const prepaymentAdviceFlow = ai.defineFlow(
  {
    name: 'prepaymentAdviceFlow',
    inputSchema: PrepaymentAdviceInputSchema,
    outputSchema: PrepaymentAdviceOutputSchema,
  },
  async (input) => {
    // Input validation (though Zod schema on defineFlow also does this)
    if (!input.loans || input.loans.length === 0) {
      return {
        reasoning: "No active loans were found to analyze. Please add your loans to LoanPilot to get prepayment advice.",
        generalAdvice: "Regularly reviewing your debts and creating a budget are key steps to financial health. Consider prepaying high-interest loans when possible.",
      };
    }

    try {
      const { output } = await prepaymentAdvicePrompt(input);
      if (!output) {
        console.error("AI prompt did not return a valid output according to the schema for input:", JSON.stringify(input));
        throw new Error("The AI failed to generate advice in the expected format. The response might have been malformed or not adhered to the required output structure.");
      }
      return output;
    } catch (e) {
      console.error("Error during AI prompt execution or output parsing for prepayment advice:", e);
      throw new Error(`An error occurred while generating AI advice: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

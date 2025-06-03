import type { Loan, AmortizationEntry, LoanFormData } from '@/types';
import { addMonths, formatISO, parseISO } from 'date-fns';

/**
 * Calculates the monthly EMI for a loan.
 * @param principal The principal loan amount.
 * @param annualRate The annual interest rate (as a percentage, e.g., 5 for 5%).
 * @param termMonths The loan term in months.
 * @returns The monthly EMI amount.
 */
export function calculateEMI(principal: number, annualRate: number, termMonths: number): number {
  if (principal <= 0 || annualRate < 0 || termMonths <= 0) {
    return 0;
  }
  if (annualRate === 0) {
    return principal / termMonths;
  }
  const monthlyRate = annualRate / 100 / 12;
  const emi =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return parseFloat(emi.toFixed(2));
}

/**
 * Generates an amortization schedule for a loan.
 * @param principal The principal loan amount.
 * @param annualRate The annual interest rate (as a percentage, e.g., 5 for 5%).
 * @param termMonths The loan term in months.
 * @param startDate The start date of the loan (ISO string or Date object).
 * @param initialPrepaidEMIs Number of EMIs already considered paid from amountAlreadyPaid.
 * @returns An array of AmortizationEntry objects.
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  startDate: string | Date,
  initialPrepaidEMIs: number = 0,
): AmortizationEntry[] {
  if (principal <= 0 || termMonths <= 0) return [];

  const schedule: AmortizationEntry[] = [];
  const monthlyRate = annualRate > 0 ? annualRate / 100 / 12 : 0;
  const emi = calculateEMI(principal, annualRate, termMonths);

  let balance = principal;
  const loanStartDate = typeof startDate === 'string' ? parseISO(startDate) : startDate;

  for (let i = 0; i < termMonths; i++) {
    const interestForMonth = annualRate > 0 ? parseFloat((balance * monthlyRate).toFixed(2)) : 0;
    const principalPaid = parseFloat((emi - interestForMonth).toFixed(2));
    balance = parseFloat((balance - principalPaid).toFixed(2));

    // Ensure balance doesn't go negative, adjust last payment if necessary
    if (i === termMonths - 1 && balance !== 0) {
        // If balance is small positive, it means last principalPaid was too low. Add to it.
        // If balance is small negative, it means last principalPaid was too high. Reduce from it.
        // This adjustment is effectively absorbed by the final EMI or principal payment.
        // For simplicity, we'll assume the EMI calculation is precise enough for most cases.
        // A more robust solution might adjust the final EMI itself.
        // If balance is very close to zero (e.g. due to rounding), set to 0.
        if (Math.abs(balance) < 0.05) balance = 0;
    }
    
    const paymentDate = addMonths(loanStartDate, i);

    schedule.push({
      month: i + 1,
      paymentDate: formatISO(paymentDate, { representation: 'date' }),
      payment: emi,
      principalPaid: principalPaid,
      interestPaid: interestForMonth,
      remainingBalance: balance < 0 ? 0 : balance, // Ensure balance doesn't show negative
      isPaid: (i + 1) <= initialPrepaidEMIs, // Mark initial EMIs as paid
      actualPaidDate: (i + 1) <= initialPrepaidEMIs ? formatISO(paymentDate, { representation: 'date' }) : undefined,
    });

    if (balance <= 0) break; // Loan paid off
  }
  return schedule;
}


/**
 * Processes loan form data to create a Loan object.
 * Calculates duration in months if given in years.
 * @param formData The loan form data.
 * @param userId The ID of the user creating the loan.
 * @returns A partial Loan object ready for Firestore.
 */
export function processLoanFormData(formData: LoanFormData): Omit<Loan, 'id' | 'userId' | 'createdAt' | 'updatedAt'> {
  const durationMonths = formData.durationType === 'years' ? formData.duration * 12 : formData.duration;
  
  return {
    name: formData.name,
    principalAmount: formData.principalAmount,
    interestRate: formData.interestRate,
    durationMonths: durationMonths,
    startDate: formatISO(formData.startDate, { representation: 'date' }),
    amountAlreadyPaid: formData.amountAlreadyPaid || 0,
  };
}


export interface LoanStatus {
  currentBalance: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number; // This is principal part of (amountAlreadyPaid + logged EMIs + logged prepayments)
  nextDueDate: string | null;
  paidEMIsCount: number;
  remainingEMIsCount: number;
  completedPercentage: number;
  effectiveInterestRate?: number; // Could be added for advanced scenarios
  estimatedClosureDate: string | null;
}

/**
 * Calculates the current status of a loan based on its amortization schedule and payments made.
 * @param loan The loan object.
 * @param schedule The loan's amortization schedule.
 * @returns A LoanStatus object.
 */
export function getLoanStatus(loan: Loan, schedule: AmortizationEntry[]): LoanStatus {
  if (!schedule || schedule.length === 0) {
    return {
      currentBalance: loan.principalAmount - loan.amountAlreadyPaid,
      totalInterestPaid: 0,
      totalPrincipalPaid: loan.amountAlreadyPaid, // Assuming amountAlreadyPaid is purely principal for simplicity here
      nextDueDate: formatISO(addMonths(parseISO(loan.startDate), 0), { representation: 'date' }),
      paidEMIsCount: 0,
      remainingEMIsCount: loan.durationMonths,
      completedPercentage: (loan.amountAlreadyPaid / loan.principalAmount) * 100,
      estimatedClosureDate: formatISO(addMonths(parseISO(loan.startDate), loan.durationMonths), {representation: 'date'}),
    };
  }

  let currentBalance = loan.principalAmount;
  let totalInterestPaid = 0;
  let totalPrincipalPaidByApp = 0; // Principal paid through EMIs marked in app
  let paidEMIsCount = 0;
  let nextDueDate: string | null = null;
  let estimatedClosureDate: string | null = schedule[schedule.length-1].paymentDate;


  for (const entry of schedule) {
    if (entry.isPaid) {
      totalInterestPaid += entry.interestPaid;
      totalPrincipalPaidByApp += entry.principalPaid;
      currentBalance = entry.remainingBalance; // The balance after this paid EMI
      paidEMIsCount++;
    } else if (!nextDueDate) {
      nextDueDate = entry.paymentDate;
    }
  }
  
  // Adjust for amountAlreadyPaid: Assume it covered initial EMIs or was a lump sum principal reduction.
  // The schedule generation already considers initialPrepaidEMIs if `amountAlreadyPaid` logic is implemented there.
  // For now, we assume `schedule` reflects the current state.

  const totalPrincipalActuallyPaid = totalPrincipalPaidByApp; // This needs to consider `loan.amountAlreadyPaid` correctly.
                                                        // If `amountAlreadyPaid` reduced principal upfront, schedule reflects that.
                                                        // If `amountAlreadyPaid` covered N EMIs, schedule reflects that.

  // If the `loan.amountAlreadyPaid` was a principal reduction *before* this schedule started,
  // then currentBalance from schedule is correct.
  // If `loan.amountAlreadyPaid` represented N EMIs, schedule's `isPaid` handles it.

  const completedPercentage = loan.principalAmount > 0 ? ((loan.principalAmount - currentBalance) / loan.principalAmount) * 100 : 0;
  
  //If all EMIs are paid, currentBalance should be 0.
  if (paidEMIsCount === schedule.length) {
    currentBalance = 0;
    nextDueDate = null; // No next due date if fully paid
  }


  return {
    currentBalance: currentBalance,
    totalInterestPaid: totalInterestPaid,
    totalPrincipalPaid: loan.principalAmount - currentBalance, // Total principal reduction
    nextDueDate: nextDueDate,
    paidEMIsCount: paidEMIsCount,
    remainingEMIsCount: schedule.length - paidEMIsCount,
    completedPercentage: parseFloat(completedPercentage.toFixed(2)),
    estimatedClosureDate: estimatedClosureDate,
  };
}

/**
 * Helper to determine number of EMIs covered by amountAlreadyPaid.
 * This is a simplified approach. A more accurate method would simulate payments.
 * @param amountPaid The amount already paid.
 * @param emi The monthly EMI.
 * @returns Number of EMIs covered.
 */
export function getInitialPaidEMIsCount(amountPaid: number, emi: number): number {
  if (emi <= 0) return 0;
  return Math.floor(amountPaid / emi);
}
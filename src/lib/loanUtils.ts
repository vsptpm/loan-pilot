
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
    return parseFloat((principal / termMonths).toFixed(2));
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
    let principalPaidThisMonth = parseFloat((emi - interestForMonth).toFixed(2));
    
    if (balance - principalPaidThisMonth < 0) {
        principalPaidThisMonth = balance; // Pay off remaining balance
    }
    
    balance = parseFloat((balance - principalPaidThisMonth).toFixed(2));

    if (i === termMonths - 1 && balance !== 0 && Math.abs(balance) < 0.05) {
        // Adjust last payment slightly for rounding errors if balance is very close to zero
        principalPaidThisMonth = parseFloat((principalPaidThisMonth + balance).toFixed(2));
        balance = 0;
    }
    
    const paymentDate = addMonths(loanStartDate, i + 1); // Payment date is end of month i, or start of month i+1

    schedule.push({
      month: i + 1,
      paymentDate: formatISO(paymentDate, { representation: 'date' }),
      payment: (i === termMonths -1 && balance === 0) ? principalPaidThisMonth + interestForMonth : emi, // Final payment might be different
      principalPaid: principalPaidThisMonth,
      interestPaid: interestForMonth,
      remainingBalance: balance < 0 ? 0 : balance,
      isPaid: (i + 1) <= initialPrepaidEMIs,
      actualPaidDate: (i + 1) <= initialPrepaidEMIs ? formatISO(paymentDate, { representation: 'date' }) : undefined,
    });

    if (balance <= 0) break; 
  }
  return schedule;
}


/**
 * Processes loan form data to create a Loan object.
 * Calculates duration in months if given in years.
 * @param formData The loan form data.
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
  totalPrincipalPaid: number; 
  nextDueDate: string | null;
  paidEMIsCount: number;
  remainingEMIsCount: number;
  completedPercentage: number;
  estimatedClosureDate: string | null;
}

/**
 * Calculates the current status of a loan based on its amortization schedule and payments made.
 * @param loan The loan object.
 * @param schedule The loan's amortization schedule.
 * @returns A LoanStatus object.
 */
export function getLoanStatus(loan: Loan, schedule: AmortizationEntry[]): LoanStatus {
  const initialPaidEMIs = getInitialPaidEMIsCount(loan.amountAlreadyPaid, schedule.length > 0 ? schedule[0].payment : 0);

  // Regenerate schedule if amountAlreadyPaid should be considered as N EMIs paid
  // This example assumes schedule provided is already correct or amountAlreadyPaid is a principal reduction.
  // For simplicity, we will use the schedule as is for now.
  // A more robust `getLoanStatus` might regenerate schedule based on `loan.amountAlreadyPaid` if not already reflected.

  if (!schedule || schedule.length === 0) {
    // Fallback if schedule is empty (e.g., zero term loan, though generateAmortizationSchedule should handle this)
    const principalAfterInitialPayment = loan.principalAmount - loan.amountAlreadyPaid;
    return {
      currentBalance: principalAfterInitialPayment > 0 ? principalAfterInitialPayment : 0,
      totalInterestPaid: 0, 
      totalPrincipalPaid: loan.amountAlreadyPaid,
      nextDueDate: loan.durationMonths > 0 ? formatISO(addMonths(parseISO(loan.startDate), 1), { representation: 'date' }) : null,
      paidEMIsCount: 0, // Or calculate based on amountAlreadyPaid if EMI is known
      remainingEMIsCount: loan.durationMonths,
      completedPercentage: loan.principalAmount > 0 ? (loan.amountAlreadyPaid / loan.principalAmount) * 100 : 100,
      estimatedClosureDate: loan.durationMonths > 0 ? formatISO(addMonths(parseISO(loan.startDate), loan.durationMonths), {representation: 'date'}) : loan.startDate,
    };
  }
  
  let currentBalance = loan.principalAmount;
  let totalInterestPaidAccumulated = 0;
  let paidEMIsCountInApp = 0;
  let nextDueDate: string | null = null;
  let lastPaidEntry: AmortizationEntry | null = null;

  for (const entry of schedule) {
    if (entry.isPaid) {
      totalInterestPaidAccumulated += entry.interestPaid;
      // currentBalance should reflect the remainingBalance *after* this payment
      currentBalance = entry.remainingBalance; 
      paidEMIsCountInApp++;
      lastPaidEntry = entry;
    } else if (!nextDueDate) {
      nextDueDate = entry.paymentDate;
    }
  }

  // currentBalance from the last paid entry in the schedule is the most accurate
  if (lastPaidEntry) {
    currentBalance = lastPaidEntry.remainingBalance;
  } else if (loan.amountAlreadyPaid > 0 && schedule.length > 0) {
     // If no EMIs are marked as paid in app, but amountAlreadyPaid exists
     // This case is complex: amountAlreadyPaid could be principal reduction or N EMIs.
     // generateAmortizationSchedule should ideally account for amountAlreadyPaid.
     // For now, assume the schedule provided IS the one after amountAlreadyPaid is factored.
     // So if initialPaidEMIs > 0, those are marked isPaid=true in schedule.
     // If initialPaidEMIs = 0, it means amountAlreadyPaid was a principal reduction *before* this schedule.
     if (initialPaidEMIs === 0) {
         currentBalance = loan.principalAmount - loan.amountAlreadyPaid;
     } else {
         // find the initialPaidEMIs-th entry
         if(schedule[initialPaidEMIs -1]) {
            currentBalance = schedule[initialPaidEMIs -1].remainingBalance;
         } else { // if initialPaidEMIs is more than schedule length
            currentBalance = 0;
         }
     }
  }


  const totalPrincipalActuallyPaid = loan.principalAmount - currentBalance;
  const completedPercentage = loan.principalAmount > 0 ? (totalPrincipalActuallyPaid / loan.principalAmount) * 100 : (currentBalance === 0 ? 100:0);
  
  const allAppEMIsPaid = paidEMIsCountInApp === schedule.length;
  const allInitialEMIsPaid = initialPaidEMIs === schedule.length;

  if (currentBalance <= 0 || allAppEMIsPaid || allInitialEMIsPaid) {
    currentBalance = 0;
    nextDueDate = null; 
  }
  
  const estimatedClosureDate = schedule[schedule.length-1]?.paymentDate || null;

  return {
    currentBalance: currentBalance,
    totalInterestPaid: totalInterestPaidAccumulated, // This is interest from *app-marked* paid EMIs
    totalPrincipalPaid: totalPrincipalActuallyPaid,
    nextDueDate: nextDueDate,
    paidEMIsCount: paidEMIsCountInApp > initialPaidEMIs ? paidEMIsCountInApp : initialPaidEMIs,
    remainingEMIsCount: schedule.length - (paidEMIsCountInApp > initialPaidEMIs ? paidEMIsCountInApp : initialPaidEMIs),
    completedPercentage: parseFloat(completedPercentage.toFixed(2)),
    estimatedClosureDate: estimatedClosureDate,
  };
}

/**
 * Helper to determine number of EMIs covered by amountAlreadyPaid.
 * @param amountPaid The amount already paid.
 * @param emi The monthly EMI.
 * @returns Number of EMIs covered.
 */
export function getInitialPaidEMIsCount(amountPaid: number, emi: number): number {
  if (amountPaid <= 0 || emi <= 0) return 0;
  return Math.floor(amountPaid / emi);
}

/**
 * Recalculates the amortization schedule considering a prepayment.
 * @param originalLoan The original loan details.
 * @param originalSchedule The original amortization schedule.
 * @param prepaymentAmount The amount of prepayment.
 * @param prepaymentMonth The month number (1-indexed) in the original schedule *after* which prepayment is applied.
 * @returns A new amortization schedule.
 */
export function simulatePrepayment(
  originalLoan: Pick<Loan, 'principalAmount' | 'interestRate' | 'durationMonths' | 'startDate' | 'amountAlreadyPaid'>,
  originalSchedule: AmortizationEntry[],
  prepaymentAmount: number,
  prepaymentMonth: number // The month *after* which prepayment is applied (e.g., 1 means after 1st EMI)
): AmortizationEntry[] {
  if (prepaymentMonth < 0 || prepaymentMonth > originalSchedule.length || prepaymentAmount <= 0) {
    return [...originalSchedule]; // Return original if prepayment is invalid
  }

  // Find the state of the loan at the point of prepayment
  // If prepaymentMonth is 0, it's applied before any EMIs on original principal minus amountAlreadyPaid
  let balanceAfterPrepaymentMonth: number;
  let dateAfterPrepaymentMonth: string;
  let remainingOriginalTerm: number;
  let paidEMIsSoFar: number;

  if (prepaymentMonth === 0) { // Prepayment at the very beginning or on top of amountAlreadyPaid
    const effectivePrincipal = originalLoan.principalAmount - (originalLoan.amountAlreadyPaid || 0);
    balanceAfterPrepaymentMonth = effectivePrincipal - prepaymentAmount;
    dateAfterPrepaymentMonth = originalLoan.startDate;
    remainingOriginalTerm = originalLoan.durationMonths;
    paidEMIsSoFar = 0;
  } else {
    const paymentEntryBeforePrepayment = originalSchedule[prepaymentMonth - 1];
    if (!paymentEntryBeforePrepayment || paymentEntryBeforePrepayment.remainingBalance < prepaymentAmount) {
      // Prepayment cannot be more than balance or applied at non-existent month
      return [...originalSchedule];
    }
    balanceAfterPrepaymentMonth = paymentEntryBeforePrepayment.remainingBalance - prepaymentAmount;
    dateAfterPrepaymentMonth = paymentEntryBeforePrepayment.paymentDate; // Prepayment happens after this EMI payment date
    remainingOriginalTerm = originalLoan.durationMonths - prepaymentMonth;
    paidEMIsSoFar = prepaymentMonth;
  }
  
  if (balanceAfterPrepaymentMonth <= 0) { // Loan paid off by prepayment
    const paidOffSchedule = originalSchedule.slice(0, prepaymentMonth);
    if (prepaymentMonth > 0) {
        const lastPaidEntry = paidOffSchedule[paidOffSchedule.length -1];
        lastPaidEntry.remainingBalance = 0; // Mark as fully paid
        // May need to add a final entry for the prepayment itself if it clears the loan
    }
    return paidOffSchedule;
  }

  // Recalculate EMI or term. For simplicity, let's keep EMI same and reduce term.
  // Or, recalculate term based on new principal and original EMI (more common for users)
  // For this simulation, we will keep the EMI the same and see how many months it takes.

  const originalEmi = calculateEMI(originalLoan.principalAmount-(originalLoan.amountAlreadyPaid || 0), originalLoan.interestRate, originalLoan.durationMonths);
  const monthlyRate = originalLoan.interestRate / 100 / 12;

  const newSchedulePart: AmortizationEntry[] = [];
  let currentSimulatedBalance = balanceAfterPrepaymentMonth;
  let monthsCounter = 0;

  while (currentSimulatedBalance > 0 && monthsCounter < remainingOriginalTerm * 2) { // Safety break
    const interestForMonth = parseFloat((currentSimulatedBalance * monthlyRate).toFixed(2));
    let principalPaidThisMonth = parseFloat((originalEmi - interestForMonth).toFixed(2));

    if (principalPaidThisMonth <=0 && originalEmi > 0) { // if interest is higher than EMI due to very low balance, adjust.
        principalPaidThisMonth = currentSimulatedBalance; // Pay off the loan
    }
    
    if (currentSimulatedBalance - principalPaidThisMonth < 0) {
      principalPaidThisMonth = currentSimulatedBalance;
    }
    
    currentSimulatedBalance = parseFloat((currentSimulatedBalance - principalPaidThisMonth).toFixed(2));

    const paymentDate = formatISO(addMonths(parseISO(dateAfterPrepaymentMonth), monthsCounter + 1), { representation: 'date' });
    
    let actualPaymentThisMonth = originalEmi;
    if (currentSimulatedBalance <= 0) { // Last payment
        actualPaymentThisMonth = principalPaidThisMonth + interestForMonth;
    }


    newSchedulePart.push({
      month: paidEMIsSoFar + monthsCounter + 1,
      paymentDate: paymentDate,
      payment: actualPaymentThisMonth,
      principalPaid: principalPaidThisMonth,
      interestPaid: interestForMonth,
      remainingBalance: currentSimulatedBalance < 0 ? 0 : currentSimulatedBalance,
      isPaid: false, // New part of schedule is not yet paid
    });
    monthsCounter++;
    if (currentSimulatedBalance <= 0) break;
  }

  return [...originalSchedule.slice(0, prepaymentMonth), ...newSchedulePart];
}


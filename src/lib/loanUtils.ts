
import type { Loan, AmortizationEntry, LoanFormData } from '@/types';
import { addMonths, formatISO, parseISO, differenceInCalendarMonths } from 'date-fns';

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
      payment: (i === termMonths -1 && balance === 0 && emi !== (principalPaidThisMonth + interestForMonth)) ? principalPaidThisMonth + interestForMonth : emi, // Final payment might be different
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

  if (!schedule || schedule.length === 0) {
    const principalAfterInitialPayment = loan.principalAmount - loan.amountAlreadyPaid;
    return {
      currentBalance: principalAfterInitialPayment > 0 ? principalAfterInitialPayment : 0,
      totalInterestPaid: 0, 
      totalPrincipalPaid: loan.amountAlreadyPaid,
      nextDueDate: loan.durationMonths > 0 ? formatISO(addMonths(parseISO(loan.startDate), 1), { representation: 'date' }) : null,
      paidEMIsCount: 0, 
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
      currentBalance = entry.remainingBalance; 
      paidEMIsCountInApp++;
      lastPaidEntry = entry;
    } else if (!nextDueDate) {
      nextDueDate = entry.paymentDate;
    }
  }

  if (lastPaidEntry) {
    currentBalance = lastPaidEntry.remainingBalance;
  } else if (loan.amountAlreadyPaid > 0 && schedule.length > 0) {
     if (initialPaidEMIs === 0) {
         currentBalance = loan.principalAmount - loan.amountAlreadyPaid;
     } else {
         if(schedule[initialPaidEMIs -1]) {
            currentBalance = schedule[initialPaidEMIs -1].remainingBalance;
         } else { 
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
  
  const estimatedClosureDate = schedule.length > 0 ? schedule[schedule.length-1]?.paymentDate : null;

  return {
    currentBalance: currentBalance,
    totalInterestPaid: totalInterestPaidAccumulated,
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
  // Ensure we don't count more EMIs than exist for the loan based on amountAlreadyPaid if it's a very large sum
  // This logic is simplistic; a robust check would compare against total loan principal.
  return Math.floor(amountPaid / emi);
}

/**
 * Recalculates the amortization schedule considering a prepayment.
 * The EMI is kept the same, and the loan term is reduced.
 * @param originalLoan The original loan details, specifically principal, rate, duration, start date.
 * @param originalSchedule The original amortization schedule.
 * @param prepaymentAmount The amount of prepayment.
 * @param prepaymentAfterMonth The month number (1-indexed) in the original schedule *after* which prepayment is applied.
 *                             If 0, prepayment is applied before any scheduled EMIs (to initial principal).
 * @returns A new amortization schedule incorporating the prepayment.
 */
export function simulatePrepayment(
  originalLoanData: Pick<Loan, 'principalAmount' | 'interestRate' | 'durationMonths' | 'startDate' | 'amountAlreadyPaid'>,
  originalSchedule: AmortizationEntry[],
  prepaymentAmount: number,
  prepaymentAfterMonth: number 
): AmortizationEntry[] {

  if (prepaymentAmount <= 0) {
    return [...originalSchedule]; 
  }
  // Ensure prepaymentAfterMonth is within valid bounds of the original schedule.
  // If prepaymentAfterMonth is 0, it's applied to the initial effective principal.
  // If > 0, it's applied after that EMI, so it shouldn't exceed the number of entries.
  if (prepaymentAfterMonth < 0 || prepaymentAfterMonth > originalSchedule.length) {
    console.warn("Prepayment month is out of bounds.");
    return [...originalSchedule];
  }

  let balanceForPrepayment: number;
  let dateForNewScheduleStart: string;
  let emiToUse: number;
  let effectiveInitialPrincipalForEmiCalc: number = originalLoanData.principalAmount - (originalLoanData.amountAlreadyPaid || 0);

  if (prepaymentAfterMonth === 0) {
    // Prepayment at the very beginning
    balanceForPrepayment = effectiveInitialPrincipalForEmiCalc;
    if (prepaymentAmount >= balanceForPrepayment) { // Prepayment clears loan
      return [{
        month: 1,
        paymentDate: formatISO(addMonths(parseISO(originalLoanData.startDate),1), {representation: 'date'}),
        payment: balanceForPrepayment, // This is not an EMI but the clearing payment
        principalPaid: balanceForPrepayment,
        interestPaid: 0,
        remainingBalance: 0,
        isPaid: false, 
      }];
    }
    balanceForPrepayment -= prepaymentAmount;
    dateForNewScheduleStart = originalLoanData.startDate; // New schedule starts from original start date
    // The EMI needs to be calculated on the original principal before this very first prepayment
    // for term reduction logic. Or, if it were a lump sum on day 0, new EMI for full term.
    // Here, we assume EMI is fixed, so we just reduce principal.
    emiToUse = calculateEMI(effectiveInitialPrincipalForEmiCalc, originalLoanData.interestRate, originalLoanData.durationMonths);
  } else {
    const paymentEntryBeforePrepayment = originalSchedule[prepaymentAfterMonth - 1];
    if (!paymentEntryBeforePrepayment) {
        console.warn("Cannot find payment entry for prepayment month.");
        return [...originalSchedule];
    }
    if (prepaymentAmount >= paymentEntryBeforePrepayment.remainingBalance) { // Prepayment clears loan
      const finalSchedule = originalSchedule.slice(0, prepaymentAfterMonth);
      if (finalSchedule.length > 0) {
        const lastEntry = finalSchedule[finalSchedule.length-1];
        // Reflect the prepayment as part of the last payment or a separate transaction
        // For simplicity, adjust the last payment to clear the balance
        lastEntry.payment += prepaymentAmount - (paymentEntryBeforePrepayment.remainingBalance - prepaymentAmount > 0 ? 0 : paymentEntryBeforePrepayment.remainingBalance); // this logic needs to be cleaner
        lastEntry.principalPaid = lastEntry.payment - lastEntry.interestPaid; // Re-evaluate principal
        lastEntry.remainingBalance = 0;
      }
      return finalSchedule;
    }
    balanceForPrepayment = paymentEntryBeforePrepayment.remainingBalance - prepaymentAmount;
    dateForNewScheduleStart = paymentEntryBeforePrepayment.paymentDate;
    emiToUse = paymentEntryBeforePrepayment.payment; // Use the existing EMI
  }
  
  if (balanceForPrepayment <= 0) { // Loan effectively paid off
    const paidOffSchedule = originalSchedule.slice(0, prepaymentAfterMonth);
     if (paidOffSchedule.length > 0) {
      const lastPaidEntry = paidOffSchedule[paidOffSchedule.length -1];
      if (lastPaidEntry) { // ensure entry exists
        // Adjust to reflect that the prepayment cleared the balance
        // This part can be tricky: did the prepayment happen along with an EMI or standalone?
        // Assuming it's a standalone amount reducing principal.
        // The last entry's remaining balance in paidOffSchedule would be after its EMI.
        // Then prepayment reduces it further. If to 0, then it's paid.
         // The existing function simulatePrepayment (original) reduces principal and recalculates schedule
         // Here, we just need to ensure the schedule part before prepayment is correct
         // And the new part starts with the reduced balance.
         // If balanceForPrepayment (which is after reduction) is <= 0, then the loan is closed.
         // The schedule should reflect this.
         
         // If prepayment was after month X, that month X's entry is already in paidOffSchedule.
         // Its remainingBalance was `R`. Now we apply prepayment `P`. New balance `R-P`.
         // If `R-P <= 0`, then the schedule should end there.
         const lastEntry = paidOffSchedule[paidOffSchedule.length - 1];
         lastEntry.remainingBalance = Math.max(0, lastEntry.remainingBalance - prepaymentAmount); // This is not quite right
                                                                                              // Balance for prepayment is *after* reduction.
                                                                                              // So if balanceForPrepayment is <= 0, that's the new reality.
         if(lastEntry) lastEntry.remainingBalance = 0; // if balanceForPrepayment is 0 or less.
      }
    }
    return paidOffSchedule;
  }

  const monthlyRate = originalLoanData.interestRate / 100 / 12;
  const newSchedulePart: AmortizationEntry[] = [];
  let currentSimulatedBalance = balanceForPrepayment;
  let monthsCounter = 0;
  // Max iterations to prevent infinite loops, e.g., original term + buffer
  const maxIterations = originalLoanData.durationMonths * 2; 

  while (currentSimulatedBalance > 0 && monthsCounter < maxIterations) {
    const interestForMonth = monthlyRate > 0 ? parseFloat((currentSimulatedBalance * monthlyRate).toFixed(2)) : 0;
    let principalPaidThisMonth = parseFloat((emiToUse - interestForMonth).toFixed(2));
    
    // If interest is higher than EMI (can happen with very low balance & fixed EMI) or EMI is not enough
    if (principalPaidThisMonth <= 0 && currentSimulatedBalance > 0 && emiToUse > 0) {
      principalPaidThisMonth = currentSimulatedBalance; // Make the principal payment equal to the balance to close loan
    }
    
    if (currentSimulatedBalance - principalPaidThisMonth < 0) {
      principalPaidThisMonth = currentSimulatedBalance; // Ensure we don't overpay principal
    }
    
    let actualPaymentThisMonth = emiToUse;
    if (principalPaidThisMonth === currentSimulatedBalance || currentSimulatedBalance - principalPaidThisMonth <= 0.01) { // Last payment
      actualPaymentThisMonth = parseFloat((currentSimulatedBalance + interestForMonth).toFixed(2));
      principalPaidThisMonth = currentSimulatedBalance; // Ensure exact principal payoff
    }

    currentSimulatedBalance = parseFloat((currentSimulatedBalance - principalPaidThisMonth).toFixed(2));

    const paymentDate = formatISO(addMonths(parseISO(dateForNewScheduleStart), monthsCounter + 1), { representation: 'date' });
    
    newSchedulePart.push({
      month: prepaymentAfterMonth + monthsCounter + 1,
      paymentDate: paymentDate,
      payment: actualPaymentThisMonth,
      principalPaid: principalPaidThisMonth,
      interestPaid: interestForMonth,
      remainingBalance: currentSimulatedBalance < 0 ? 0 : currentSimulatedBalance,
      isPaid: false, 
    });
    monthsCounter++;
    if (currentSimulatedBalance <= 0) break;
  }
  return [...originalSchedule.slice(0, prepaymentAfterMonth), ...newSchedulePart];
}


/**
 * Calculates the total interest paid in an amortization schedule.
 * @param schedule An array of AmortizationEntry objects.
 * @returns The total interest paid.
 */
export function calculateTotalInterest(schedule: AmortizationEntry[]): number {
  return schedule.reduce((total, entry) => total + entry.interestPaid, 0);
}


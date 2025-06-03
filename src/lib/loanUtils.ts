
import type { Loan, AmortizationEntry, LoanFormData, RecordedPrepayment } from '@/types';
import { addMonths, formatISO, parseISO, differenceInCalendarMonths, isBefore, isEqual, isAfter } from 'date-fns';

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
 * Generates an amortization schedule for a loan, considering initial payments and recorded prepayments.
 * Assumes EMIs due on or before today are paid.
 * @param principal The original principal loan amount.
 * @param annualRate The annual interest rate (as a percentage).
 * @param termMonths The original loan term in months.
 * @param startDate The start date of the loan (ISO string or Date object).
 * @param initialPaidEMIs Number of initial EMIs considered paid from amountAlreadyPaid.
 * @param recordedPrepayments An array of recorded prepayments, should be sorted by date if not already.
 * @returns An array of AmortizationEntry objects.
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  startDate: string | Date,
  initialPaidEMIs: number = 0,
  recordedPrepayments: RecordedPrepayment[] = []
): AmortizationEntry[] {
  if (principal <= 0) return [];
  
  const today = new Date();
  const todayDateOnly = parseISO(formatISO(today, { representation: 'date' }));


  // If termMonths is 0 but principal > 0, it's effectively an immediate repayment.
  if (termMonths <= 0 && principal > 0) {
      const paymentDate = formatISO(typeof startDate === 'string' ? parseISO(startDate) : startDate, { representation: 'date' });
      const paymentDueDate = parseISO(paymentDate);
      const isEntryPastOrToday = isBefore(paymentDueDate, todayDateOnly) || isEqual(paymentDueDate, todayDateOnly);
      const finalIsPaid = true; // Immediate repayment is always considered paid.

      return [{
          month: 1,
          paymentDate: paymentDate,
          payment: principal,
          principalPaid: principal,
          interestPaid: 0,
          remainingBalance: 0,
          isPaid: finalIsPaid,
          actualPaidDate: finalIsPaid ? paymentDate : undefined,
      }];
  }


  const schedule: AmortizationEntry[] = [];
  const monthlyRate = annualRate > 0 ? annualRate / 100 / 12 : 0;
  const emi = calculateEMI(principal, annualRate, termMonths);

  if (emi === 0 && principal > 0 && annualRate === 0) {
    const simpleEMI = parseFloat((principal / termMonths).toFixed(2));
    let bal = principal;
    for (let i = 0; i < termMonths; i++) {
        const paymentDate = addMonths(typeof startDate === 'string' ? parseISO(startDate) : startDate, i + 1);
        const paymentDateISO = formatISO(paymentDate, { representation: 'date' });
        const paymentDueDate = parseISO(paymentDateISO);

        const principalPaidThisMonth = (i === termMonths - 1) ? bal : simpleEMI;
        bal -= principalPaidThisMonth;
        bal = parseFloat(bal.toFixed(2));

        const isEntryPaidByInitial = (i + 1) <= initialPaidEMIs;
        const isEntryPastOrToday = isBefore(paymentDueDate, todayDateOnly) || isEqual(paymentDueDate, todayDateOnly);
        const finalIsPaid = isEntryPaidByInitial || isEntryPastOrToday;

        schedule.push({
            month: i + 1,
            paymentDate: paymentDateISO,
            payment: principalPaidThisMonth,
            principalPaid: principalPaidThisMonth,
            interestPaid: 0,
            remainingBalance: Math.max(0, bal),
            isPaid: finalIsPaid,
            actualPaidDate: finalIsPaid ? paymentDateISO : undefined,
        });
        if (bal <=0) break;
    }
    return schedule.map((entry, index) => ({...entry, month: index + 1}));
  }
  if (emi === 0 && principal > 0 && annualRate > 0) {
    console.warn("EMI calculated as 0 for a loan with positive principal and interest. Schedule may be incorrect.");
    if (principal - (recordedPrepayments.reduce((sum, pp) => sum + pp.amount, 0)) <=0 ) {
         const paymentDate = formatISO(typeof startDate === 'string' ? parseISO(startDate) : startDate, { representation: 'date' });
         const paymentDueDate = parseISO(paymentDate);
         const isEntryPastOrToday = isBefore(paymentDueDate, todayDateOnly) || isEqual(paymentDueDate, todayDateOnly);
         const finalIsPaid = true; 
         return [{
            month: 1,
            paymentDate: paymentDate,
            payment: principal,
            principalPaid: principal,
            interestPaid: 0,
            remainingBalance: 0,
            isPaid: finalIsPaid,
            actualPaidDate: finalIsPaid ? paymentDate : undefined,
         }];
    }
    return [];
  }


  let currentBalance = principal;
  const loanStartDate = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  
  const sortedPrepayments = [...recordedPrepayments].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  let prepaymentPointer = 0;
  let effectiveMonth = 0;

  while(prepaymentPointer < sortedPrepayments.length) {
    const prepayment = sortedPrepayments[prepaymentPointer];
    const prepaymentDate = parseISO(prepayment.date);
    const firstEmiDueDate = addMonths(loanStartDate, 1);

    if (prepaymentDate < firstEmiDueDate) {
        if (currentBalance > 0) {
            const amountToApply = Math.min(prepayment.amount, currentBalance);
            currentBalance -= amountToApply;
            currentBalance = parseFloat(currentBalance.toFixed(2));
        }
        prepaymentPointer++;
        if (currentBalance <= 0) break;
    } else {
        break; 
    }
  }
  
  if (currentBalance <= 0) { 
     const paymentDate = sortedPrepayments.length > 0 ? sortedPrepayments[prepaymentPointer-1].date : formatISO(loanStartDate, {representation: 'date'});
     const paymentDueDate = parseISO(paymentDate);
     const isEntryPastOrToday = isBefore(paymentDueDate, todayDateOnly) || isEqual(paymentDueDate, todayDateOnly);
     const finalIsPaid = true;
     return [{
        month: 1,
        paymentDate: paymentDate,
        payment: principal, 
        principalPaid: principal,
        interestPaid: 0,
        remainingBalance: 0,
        isPaid: finalIsPaid,
        actualPaidDate: finalIsPaid ? paymentDate : undefined,
     }];
  }

  const maxIterations = termMonths + (recordedPrepayments.length * 2) + 12 ; 

  for (let i = 0; i < maxIterations; i++) {
    if (currentBalance <= 0.01) break; 

    effectiveMonth++;
    const currentMonthPaymentDateDt = addMonths(loanStartDate, effectiveMonth);
    const currentMonthPaymentDateISO = formatISO(currentMonthPaymentDateDt, { representation: 'date' });
    const paymentDueDate = parseISO(currentMonthPaymentDateISO);
    
    const previousCycleEndDate = addMonths(loanStartDate, effectiveMonth -1);

    while (prepaymentPointer < sortedPrepayments.length) {
      const prepayment = sortedPrepayments[prepaymentPointer];
      const prepaymentDate = parseISO(prepayment.date);

      if (prepaymentDate > previousCycleEndDate && prepaymentDate <= currentMonthPaymentDateDt) {
         if (currentBalance > 0) {
            const amountToApply = Math.min(prepayment.amount, currentBalance);
            currentBalance -= amountToApply;
            currentBalance = parseFloat(currentBalance.toFixed(2));
         }
        prepaymentPointer++;
        if (currentBalance <= 0) break;
      } else if (prepaymentDate <= previousCycleEndDate) {
        prepaymentPointer++; 
      } else {
        break; 
      }
    }

    if (currentBalance <= 0.01) break;

    const interestForMonth = annualRate > 0 ? parseFloat((currentBalance * monthlyRate).toFixed(2)) : 0;
    let principalPaidThisMonth = parseFloat((emi - interestForMonth).toFixed(2));
    let actualPaymentThisMonth = emi;

    if (principalPaidThisMonth < 0 && annualRate > 0) { 
        principalPaidThisMonth = 0; 
    }
    
    if (currentBalance - principalPaidThisMonth <= 0.01 && currentBalance > 0) {
      principalPaidThisMonth = currentBalance;
      actualPaymentThisMonth = parseFloat((principalPaidThisMonth + interestForMonth).toFixed(2));
    }
    
    currentBalance = parseFloat((currentBalance - principalPaidThisMonth).toFixed(2));
    currentBalance = Math.max(0, currentBalance);

    const isEntryPaidByInitial = effectiveMonth <= initialPaidEMIs;
    const isEntryPastOrToday = isBefore(paymentDueDate, todayDateOnly) || isEqual(paymentDueDate, todayDateOnly);
    const finalIsPaid = isEntryPaidByInitial || isEntryPastOrToday;
    const finalActualPaidDate = finalIsPaid ? currentMonthPaymentDateISO : undefined;

    schedule.push({
      month: effectiveMonth, 
      paymentDate: currentMonthPaymentDateISO,
      payment: actualPaymentThisMonth,
      principalPaid: principalPaidThisMonth,
      interestPaid: interestForMonth,
      remainingBalance: currentBalance,
      isPaid: finalIsPaid,
      actualPaidDate: finalActualPaidDate,
    });

    if (currentBalance <= 0) break;
  }
  return schedule.map((entry, index) => ({ ...entry, month: index + 1 }));
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
 * Calculates the current status of a loan based on its amortization schedule (potentially prepayment-adjusted) and current date.
 * The schedule provided should have its `isPaid` flags set correctly (e.g., by generateAmortizationSchedule assuming past EMIs are paid).
 * @param loan The loan object.
 * @param schedule The loan's amortization schedule.
 * @returns A LoanStatus object reflecting status as of today.
 */
export function getLoanStatus(loan: Loan, schedule: AmortizationEntry[]): LoanStatus {
  const today = new Date();
  const todayDateOnly = parseISO(formatISO(today, { representation: 'date' }));

  if (!schedule || schedule.length === 0) {
    const effectivelyPaidOff = loan.principalAmount > 0; 
    return {
      currentBalance: 0,
      totalInterestPaid: 0, 
      totalPrincipalPaid: effectivelyPaidOff ? loan.principalAmount : 0,
      nextDueDate: null,
      paidEMIsCount: 0, 
      remainingEMIsCount: 0,
      completedPercentage: effectivelyPaidOff || loan.principalAmount === 0 ? 100 : 0,
      estimatedClosureDate: loan.startDate, 
    };
  }

  let currentBalance = loan.principalAmount - (loan.amountAlreadyPaid || 0); // Start with principal reduced by initial payments
  let totalInterestPaidToDate = 0;
  let totalPrincipalPaidToDate = loan.amountAlreadyPaid || 0; // Initial payment is all principal
  let paidEMIsSoFarCount = 0;
  let nextPaymentDueDate: string | null = null;
  
  // Adjust currentBalance based on schedule entries marked as paid (which now includes past/today dates)
  // The schedule's remainingBalance should reflect this already.
  
  let lastProcessedEntry: AmortizationEntry | null = null;

  for (const entry of schedule) {
    if (entry.isPaid) { // isPaid is true if initialPaid or (past/today due date)
      lastProcessedEntry = entry;
    } else if (!nextPaymentDueDate) {
      // This is the first unpaid entry, thus the next due date
      nextPaymentDueDate = entry.paymentDate;
    }
  }
  
  if (lastProcessedEntry) {
      currentBalance = lastProcessedEntry.remainingBalance;
      paidEMIsSoFarCount = lastProcessedEntry.month;
      // Recalculate total principal and interest based on *all* entries up to lastProcessedEntry
      // (or all entries if loan is fully paid through schedule)
      totalPrincipalPaidToDate = 0;
      totalInterestPaidToDate = 0;
      for(let i=0; i < schedule.length; i++){
          if(i < paidEMIsSoFarCount) {
            totalPrincipalPaidToDate += schedule[i].principalPaid;
            totalInterestPaidToDate += schedule[i].interestPaid;
          }
      }
      // Add the initial amountAlreadyPaid as principal paid, if it wasn't purely covering EMIs that are now also summed up.
      // The schedule itself starts *after* amountAlreadyPaid is conceptually applied via initialPaidEMIs.
      // So, the principalPaid in the schedule entries + the principal part of amountAlreadyPaid is the total.
      // generateAmortizationSchedule marks initialPaidEMIs as paid.
      // The sum of `principalPaid` for these `isPaid` entries is correct.
      totalPrincipalPaidToDate = loan.principalAmount - currentBalance;

  } else {
    // No EMIs are considered paid yet by the schedule (e.g. all EMIs are in the future, and no amountAlreadyPaid)
    // Or, amountAlreadyPaid was 0 and all EMIs are future.
    // currentBalance remains loan.principalAmount (if amountAlreadyPaid was 0)
    // If loan.amountAlreadyPaid > 0, it reduces initialPaidEMIs which are marked isPaid.
    // This `else` block should only be hit if initialPaidEMIs is 0 AND all schedule entries are in future.
    currentBalance = loan.principalAmount;
    totalPrincipalPaidToDate = 0; // No EMIs paid, no initial amount
    if (schedule.length > 0) {
      nextPaymentDueDate = schedule[0].paymentDate;
    }
  }

  currentBalance = Math.max(0, parseFloat(currentBalance.toFixed(2)));
  if (currentBalance === 0 && loan.principalAmount > 0) {
      totalPrincipalPaidToDate = loan.principalAmount;
  }


  const completedPercentage = loan.principalAmount > 0 ? (totalPrincipalPaidToDate / loan.principalAmount) * 100 : (currentBalance === 0 ? 100:0);
  const estimatedClosureDate = schedule.length > 0 ? schedule[schedule.length - 1].paymentDate : null;
  const remainingEMIsCount = schedule.length - paidEMIsSoFarCount;

  return {
    currentBalance: currentBalance,
    totalInterestPaid: parseFloat(totalInterestPaidToDate.toFixed(2)),
    totalPrincipalPaid: parseFloat(totalPrincipalPaidToDate.toFixed(2)),
    nextDueDate: nextPaymentDueDate,
    paidEMIsCount: paidEMIsSoFarCount,
    remainingEMIsCount: remainingEMIsCount < 0 ? 0 : remainingEMIsCount,
    completedPercentage: parseFloat(completedPercentage.toFixed(2)),
    estimatedClosureDate: estimatedClosureDate,
  };
}


/**
 * Helper to determine number of EMIs covered by amountAlreadyPaid.
 * This count is used to mark initial EMIs in the schedule as 'isPaid'.
 * @param amountPaid The amount already paid towards scheduled EMIs.
 * @param emi The monthly EMI.
 * @returns Number of EMIs covered.
 */
export function getInitialPaidEMIsCount(amountPaid: number, emi: number): number {
  if (amountPaid <= 0 || emi <= 0) return 0;
  return Math.floor(amountPaid / emi);
}

/**
 * Recalculates the amortization schedule considering an additional hypothetical prepayment.
 * The EMI is kept the same, and the loan term is reduced.
 * @param originalLoanData The original loan's base terms (principal, rate, term, start date).
 * @param currentSchedule The current amortization schedule, which may already include recorded prepayments.
 * @param prepaymentAmount The amount of the new hypothetical prepayment.
 * @param prepaymentAfterMonth The month number (1-indexed) in the `currentSchedule` *after* which this new prepayment is applied.
 *                             If 0, prepayment is applied before the first entry in `currentSchedule` (to its starting balance).
 * @returns A new amortization schedule incorporating the simulated prepayment.
 */
export function simulatePrepayment(
  originalLoanData: Pick<Loan, 'principalAmount' | 'interestRate' | 'durationMonths' | 'startDate' | 'amountAlreadyPaid'>,
  currentSchedule: AmortizationEntry[],
  prepaymentAmount: number,
  prepaymentAfterMonth: number 
): AmortizationEntry[] {

  if (prepaymentAmount <= 0) {
    return [...currentSchedule]; 
  }
  
  if (prepaymentAfterMonth < 0 || prepaymentAfterMonth > currentSchedule.length) {
    console.warn("Simulated prepayment month is out of bounds of the current schedule.");
    return [...currentSchedule];
  }
  
  let balanceBeforeSimulatedPrepayment: number;
  let dateForNewSimulatedScheduleStart: string;
  let baseSchedulePart: AmortizationEntry[]; 
  let emiToUseForSimulation: number;


  if (prepaymentAfterMonth === 0) {
    if (currentSchedule.length === 0) { 
        return [];
    }
    const firstEntry = currentSchedule[0];
    balanceBeforeSimulatedPrepayment = firstEntry.remainingBalance + firstEntry.principalPaid; 
    
    baseSchedulePart = [];
    dateForNewSimulatedScheduleStart = formatISO(addMonths(parseISO(firstEntry.paymentDate), -1), {representation: 'date'});
    emiToUseForSimulation = firstEntry.payment; 
    
  } else {
    const paymentEntryBeforePrepayment = currentSchedule[prepaymentAfterMonth - 1];
     if (!paymentEntryBeforePrepayment) {
        console.warn("Cannot find payment entry for simulated prepayment month in current schedule.");
        return [...currentSchedule];
    }
    balanceBeforeSimulatedPrepayment = paymentEntryBeforePrepayment.remainingBalance;
    baseSchedulePart = currentSchedule.slice(0, prepaymentAfterMonth);
    dateForNewSimulatedScheduleStart = paymentEntryBeforePrepayment.paymentDate;
    emiToUseForSimulation = paymentEntryBeforePrepayment.payment;
  }

  if (prepaymentAmount >= balanceBeforeSimulatedPrepayment) { 
    if (balanceBeforeSimulatedPrepayment > 0 && baseSchedulePart.length > 0) {
        const lastEntryInBase = baseSchedulePart[baseSchedulePart.length-1];
        lastEntryInBase.payment += (balanceBeforeSimulatedPrepayment - lastEntryInBase.interestPaid - lastEntryInBase.principalPaid); // adjust payment to cover rest
        lastEntryInBase.principalPaid = lastEntryInBase.principalPaid + (balanceBeforeSimulatedPrepayment - lastEntryInBase.principalPaid - lastEntryInBase.interestPaid > 0 ? balanceBeforeSimulatedPrepayment - lastEntryInBase.principalPaid - lastEntryInBase.interestPaid : 0 ); // Add remaining part to principal paid
        lastEntryInBase.remainingBalance = 0;
    } else if (balanceBeforeSimulatedPrepayment > 0 && baseSchedulePart.length === 0) { 
         return [{
            month: 1,
            paymentDate: dateForNewSimulatedScheduleStart, 
            payment: balanceBeforeSimulatedPrepayment,
            principalPaid: balanceBeforeSimulatedPrepayment,
            interestPaid: 0,
            remainingBalance: 0,
            isPaid: false, 
        }];
    }
    // Ensure month numbers are sequential for the base part if it's returned directly
    return baseSchedulePart.map((entry, index) => ({ ...entry, month: index + 1 }));
  }
  
  let simulatedBalance = balanceBeforeSimulatedPrepayment - prepaymentAmount;
  if (simulatedBalance <= 0.01) { 
    if (baseSchedulePart.length > 0) {
        const lastEntry = baseSchedulePart[baseSchedulePart.length -1];
        lastEntry.payment += simulatedBalance > 0 ? simulatedBalance : 0; // Add the remainder to the last payment
        lastEntry.principalPaid += simulatedBalance > 0 ? simulatedBalance : 0;
        lastEntry.remainingBalance = 0; 
    }
     return baseSchedulePart.map((entry, index) => ({ ...entry, month: index + 1 }));
  }

  const monthlyRate = originalLoanData.interestRate / 100 / 12;
  const newSimulatedSchedulePart: AmortizationEntry[] = [];
  let currentSimulatedBalanceInLoop = simulatedBalance;
  let monthsCounter = 0;
  const maxIterations = originalLoanData.durationMonths * 2; 

  while (currentSimulatedBalanceInLoop > 0.01 && monthsCounter < maxIterations) {
    const interestForMonth = monthlyRate > 0 ? parseFloat((currentSimulatedBalanceInLoop * monthlyRate).toFixed(2)) : 0;
    let principalPaidThisMonth = parseFloat((emiToUseForSimulation - interestForMonth).toFixed(2));
    let actualPaymentThisMonth = emiToUseForSimulation;

    if (principalPaidThisMonth < 0 && monthlyRate > 0) {
        principalPaidThisMonth = 0;
    }

    if (currentSimulatedBalanceInLoop - principalPaidThisMonth <= 0.01 && currentSimulatedBalanceInLoop > 0) {
      principalPaidThisMonth = currentSimulatedBalanceInLoop;
      actualPaymentThisMonth = parseFloat((principalPaidThisMonth + interestForMonth).toFixed(2));
    }
    
    currentSimulatedBalanceInLoop = parseFloat((currentSimulatedBalanceInLoop - principalPaidThisMonth).toFixed(2));
    currentSimulatedBalanceInLoop = Math.max(0, currentSimulatedBalanceInLoop);
    
    const paymentDate = formatISO(addMonths(parseISO(dateForNewSimulatedScheduleStart), monthsCounter + 1), { representation: 'date' });
    
    newSimulatedSchedulePart.push({
      month: baseSchedulePart.length + monthsCounter + 1,
      paymentDate: paymentDate,
      payment: actualPaymentThisMonth,
      principalPaid: principalPaidThisMonth,
      interestPaid: interestForMonth,
      remainingBalance: currentSimulatedBalanceInLoop,
      isPaid: false, 
    });
    monthsCounter++;
    if (currentSimulatedBalanceInLoop <= 0.01) break;
  }
  
  const finalSchedule = [...baseSchedulePart, ...newSimulatedSchedulePart];
  return finalSchedule.map((entry, index) => ({...entry, month: index + 1}));
}


/**
 * Calculates the total interest paid in an amortization schedule.
 * @param schedule An array of AmortizationEntry objects.
 * @returns The total interest paid.
 */
export function calculateTotalInterest(schedule: AmortizationEntry[]): number {
  if (!schedule) return 0;
  return schedule.reduce((total, entry) => total + entry.interestPaid, 0);
}


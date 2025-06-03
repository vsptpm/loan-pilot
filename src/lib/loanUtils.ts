
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
      // const isEntryPastOrToday = isBefore(paymentDueDate, todayDateOnly) || isEqual(paymentDueDate, todayDateOnly);
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
        const paymentDateDt = addMonths(typeof startDate === 'string' ? parseISO(startDate) : startDate, i + 1);
        const paymentDateISO = formatISO(paymentDateDt, { representation: 'date' });
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
         // const paymentDueDate = parseISO(paymentDate);
         // const isEntryPastOrToday = isBefore(paymentDueDate, todayDateOnly) || isEqual(paymentDueDate, todayDateOnly);
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

  // Apply prepayments made before the first scheduled EMI due date
  while(prepaymentPointer < sortedPrepayments.length) {
    const prepayment = sortedPrepayments[prepaymentPointer];
    const prepaymentDate = parseISO(prepayment.date);
    // First EMI is due 1 month after loan start date
    const firstEmiDueDate = addMonths(loanStartDate, 1);

    // If prepayment is on or before the loan start date, or before the first EMI is due
    if (isBefore(prepaymentDate, firstEmiDueDate) || isEqual(prepaymentDate, loanStartDate)) {
        if (currentBalance > 0) {
            const amountToApply = Math.min(prepayment.amount, currentBalance);
            currentBalance -= amountToApply;
            currentBalance = parseFloat(currentBalance.toFixed(2));
        }
        prepaymentPointer++;
        if (currentBalance <= 0) break;
    } else {
        break; // Prepayments from here on are after or on first EMI date
    }
  }
  
  if (currentBalance <= 0) { 
     // Loan paid off by prepayments before first EMI
     const lastPpDate = sortedPrepayments.length > 0 ? sortedPrepayments[prepaymentPointer-1].date : formatISO(loanStartDate, {representation: 'date'});
     // const paymentDueDate = parseISO(lastPpDate);
     // const isEntryPastOrToday = isBefore(paymentDueDate, todayDateOnly) || isEqual(paymentDueDate, todayDateOnly);
     const finalIsPaid = true;
     return [{
        month: 1,
        paymentDate: lastPpDate, // Use the date of the last prepayment that cleared it
        payment: principal, // Total payment effectively equals principal
        principalPaid: principal,
        interestPaid: 0,
        remainingBalance: 0,
        isPaid: finalIsPaid,
        actualPaidDate: finalIsPaid ? lastPpDate : undefined,
     }];
  }

  const maxIterations = termMonths + (recordedPrepayments.length * 2) + 24 ; // Increased buffer

  for (let i = 0; i < maxIterations; i++) {
    if (currentBalance <= 0.01) break; 

    effectiveMonth++;
    const currentMonthPaymentDateDt = addMonths(loanStartDate, effectiveMonth);
    const currentMonthPaymentDateISO = formatISO(currentMonthPaymentDateDt, { representation: 'date' });
    const paymentDueDate = parseISO(currentMonthPaymentDateISO);
    
    // Consider prepayments that fall between the last EMI date and the current EMI due date
    const previousEmiDueDate = addMonths(loanStartDate, effectiveMonth -1);

    while (prepaymentPointer < sortedPrepayments.length) {
      const prepayment = sortedPrepayments[prepaymentPointer];
      const prepaymentDate = parseISO(prepayment.date);

      // If prepayment date is after previous EMI due date AND on or before current EMI due date
      if (isAfter(prepaymentDate, previousEmiDueDate) && (isBefore(prepaymentDate, currentMonthPaymentDateDt) || isEqual(prepaymentDate, currentMonthPaymentDateDt))) {
         if (currentBalance > 0) {
            const amountToApply = Math.min(prepayment.amount, currentBalance);
            currentBalance -= amountToApply;
            currentBalance = parseFloat(currentBalance.toFixed(2));
         }
        prepaymentPointer++;
        if (currentBalance <= 0) break; // Loan cleared by this prepayment
      } else if (isBefore(prepaymentDate, previousEmiDueDate) || isEqual(prepaymentDate, previousEmiDueDate)) {
        // This prepayment was already accounted for or is from a past cycle
        prepaymentPointer++; 
      } else {
        break; // This prepayment is for a future cycle
      }
    }

    if (currentBalance <= 0.01) break; // Break if loan cleared by prepayments before EMI calculation

    const interestForMonth = annualRate > 0 ? parseFloat((currentBalance * monthlyRate).toFixed(2)) : 0;
    let principalPaidThisMonth = parseFloat((emi - interestForMonth).toFixed(2));
    let actualPaymentThisMonth = emi;

    if (principalPaidThisMonth < 0 && annualRate > 0) { 
        principalPaidThisMonth = 0; // Interest is more than EMI, all EMI goes to interest
    }
    
    // If current balance is less than the scheduled principal payment for this month
    if (currentBalance - principalPaidThisMonth <= 0.01 && currentBalance > 0) {
      principalPaidThisMonth = currentBalance; // Pay off remaining balance
      actualPaymentThisMonth = parseFloat((principalPaidThisMonth + interestForMonth).toFixed(2));
    }
    
    currentBalance = parseFloat((currentBalance - principalPaidThisMonth).toFixed(2));
    currentBalance = Math.max(0, currentBalance); // Ensure balance doesn't go negative

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
export function processLoanFormData(formData: LoanFormData): Omit<Loan, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'totalPrepaymentAmount'> {
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
 * Calculates the current status of a loan.
 * If forSummaryView is true, it approximates currentBalance using loan.totalPrepaymentAmount
 * after calculating schedule-based balance (schedule should be basic in this case).
 * Otherwise (for detail view), it relies on the provided schedule which should already be
 * prepayment-adjusted by generateAmortizationSchedule.
 * @param loan The loan object, potentially with totalPrepaymentAmount.
 * @param schedule The loan's amortization schedule.
 * @param forSummaryView If true, applies totalPrepaymentAmount to adjust balance for summaries.
 * @returns A LoanStatus object.
 */
export function getLoanStatus(
  loan: Loan,
  schedule: AmortizationEntry[],
  forSummaryView: boolean = false
): LoanStatus {
  const today = new Date();
  const todayDateOnly = parseISO(formatISO(today, { representation: 'date' }));

  if (!schedule || schedule.length === 0) {
    let currentBal = loan.principalAmount - (loan.amountAlreadyPaid || 0);
    if (forSummaryView && loan.totalPrepaymentAmount) {
      currentBal -= loan.totalPrepaymentAmount;
    }
    currentBal = Math.max(0, currentBal);
    
    const principalPaid = loan.principalAmount - currentBal;
    const isEffectivelyPaidOff = currentBal === 0 && loan.principalAmount > 0;

    return {
      currentBalance: currentBal,
      totalInterestPaid: 0, 
      totalPrincipalPaid: principalPaid,
      nextDueDate: null,
      paidEMIsCount: 0, 
      remainingEMIsCount: 0,
      completedPercentage: isEffectivelyPaidOff || loan.principalAmount === 0 ? 100 : (loan.principalAmount > 0 ? (principalPaid / loan.principalAmount) * 100 : 0),
      estimatedClosureDate: loan.startDate, 
    };
  }

  let currentBalanceFromSchedule = loan.principalAmount; // Base for schedule calculation
  let totalPrincipalScheduledPaid = 0;
  let totalInterestScheduledPaid = 0;
  let paidEMIsSoFarCount = 0;
  let nextPaymentDueDate: string | null = null;
  let lastProcessedEntry: AmortizationEntry | null = null;
  
  for (const entry of schedule) {
    if (entry.isPaid) { // isPaid determined by generateAmortizationSchedule (initial + past/today)
      lastProcessedEntry = entry;
    } else if (!nextPaymentDueDate) {
      nextPaymentDueDate = entry.paymentDate;
    }
  }
  
  if (lastProcessedEntry) {
    currentBalanceFromSchedule = lastProcessedEntry.remainingBalance;
    paidEMIsSoFarCount = lastProcessedEntry.month;
    
    // Sum principal and interest from *all* entries up to the last processed one
    // This reflects payments made according to the schedule (including initial EMIs)
    for(let i = 0; i < paidEMIsSoFarCount && i < schedule.length; i++){
        totalPrincipalScheduledPaid += schedule[i].principalPaid;
        totalInterestScheduledPaid += schedule[i].interestPaid;
    }
  } else {
    // No EMIs considered paid by the schedule (e.g., all future, no amountAlreadyPaid resulting in initialPaidEMIs > 0)
    // currentBalanceFromSchedule remains loan.principalAmount (or less if schedule started with reduced principal from prepayments before first EMI)
    // If the schedule itself accounts for prepayments that reduce the starting balance,
    // currentBalanceFromSchedule here should be the first entry's (balance + principal_paid).
     if (schedule.length > 0) {
        currentBalanceFromSchedule = schedule[0].remainingBalance + schedule[0].principalPaid;
        nextPaymentDueDate = schedule[0].paymentDate;
     } else { // Should not happen if schedule has entries
        currentBalanceFromSchedule = loan.principalAmount;
     }
  }


  let finalCurrentBalance: number;
  let finalTotalPrincipalPaid: number;
  let finalTotalInterestPaid: number = totalInterestScheduledPaid; // Interest paid is based on schedule EMIs

  if (forSummaryView && loan.totalPrepaymentAmount && loan.totalPrepaymentAmount > 0) {
    // For summary views, adjust the schedule-derived balance by totalPrepaymentAmount
    finalCurrentBalance = Math.max(0, parseFloat((currentBalanceFromSchedule - loan.totalPrepaymentAmount).toFixed(2)));
    // Total principal paid for summary is scheduled principal paid + total prepayments
    finalTotalPrincipalPaid = parseFloat((totalPrincipalScheduledPaid + loan.totalPrepaymentAmount).toFixed(2));
    finalTotalPrincipalPaid = Math.min(finalTotalPrincipalPaid, loan.principalAmount); // Cap at original loan amount
    // Adjust balance if total principal paid implies a different figure
    finalCurrentBalance = parseFloat((loan.principalAmount - finalTotalPrincipalPaid).toFixed(2));

  } else {
    // For detail page, or if no totalPrepaymentAmount, use schedule-derived values directly
    // The 'schedule' for detail page is already fully adjusted for individual prepayments.
    finalCurrentBalance = parseFloat(currentBalanceFromSchedule.toFixed(2));
    finalTotalPrincipalPaid = parseFloat(totalPrincipalScheduledPaid.toFixed(2));
  }
  finalCurrentBalance = Math.max(0, finalCurrentBalance); // Ensure not negative

  const completedPercentage = loan.principalAmount > 0 
    ? parseFloat(((finalTotalPrincipalPaid / loan.principalAmount) * 100).toFixed(2)) 
    : (finalCurrentBalance === 0 ? 100 : 0);
  
  const estimatedClosureDate = schedule.length > 0 ? schedule[schedule.length - 1].paymentDate : loan.startDate;
  const remainingEMIsCount = schedule.length - paidEMIsSoFarCount;

  return {
    currentBalance: finalCurrentBalance,
    totalInterestPaid: parseFloat(finalTotalInterestPaid.toFixed(2)),
    totalPrincipalPaid: parseFloat(finalTotalPrincipalPaid.toFixed(2)),
    nextDueDate: finalCurrentBalance === 0 ? null : nextPaymentDueDate,
    paidEMIsCount: paidEMIsSoFarCount,
    remainingEMIsCount: remainingEMIsCount < 0 ? 0 : remainingEMIsCount,
    completedPercentage: completedPercentage > 100 ? 100 : completedPercentage, // Cap at 100
    estimatedClosureDate: finalCurrentBalance === 0 && lastProcessedEntry ? lastProcessedEntry.paymentDate : estimatedClosureDate,
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
    // Prepaying before the first EMI in the current schedule
    if (currentSchedule.length === 0) { // Loan is fully paid or has no schedule
        // If original principal > 0, and prepay clears it
        if (originalLoanData.principalAmount > 0 && prepaymentAmount >= originalLoanData.principalAmount) {
            return [{
                month: 1,
                paymentDate: originalLoanData.startDate, // Or today's date for simulation
                payment: originalLoanData.principalAmount,
                principalPaid: originalLoanData.principalAmount,
                interestPaid: 0,
                remainingBalance: 0,
                isPaid: false, // It's a simulation
            }];
        }
        return []; // No basis for simulation if schedule is empty and not cleared by this prepayment.
    }
    const firstEntry = currentSchedule[0];
    // Balance before the very first EMI of the current schedule
    balanceBeforeSimulatedPrepayment = firstEntry.remainingBalance + firstEntry.principalPaid; 
    
    baseSchedulePart = []; // No entries from current schedule are kept before this point
    // Simulation starts from the original loan's start date perspective for schedule generation,
    // or from the date of first entry minus one month if more appropriate.
    dateForNewSimulatedScheduleStart = formatISO(addMonths(parseISO(firstEntry.paymentDate), -1), {representation: 'date'});
    emiToUseForSimulation = firstEntry.payment; // Use EMI from current schedule
    
  } else {
    // Prepaying after a specific EMI in the current schedule
    const paymentEntryBeforePrepayment = currentSchedule[prepaymentAfterMonth - 1];
     if (!paymentEntryBeforePrepayment) {
        console.warn("Cannot find payment entry for simulated prepayment month in current schedule.");
        return [...currentSchedule];
    }
    balanceBeforeSimulatedPrepayment = paymentEntryBeforePrepayment.remainingBalance;
    baseSchedulePart = currentSchedule.slice(0, prepaymentAfterMonth); // Keep entries up to this point
    dateForNewSimulatedScheduleStart = paymentEntryBeforePrepayment.paymentDate; // Next simulated EMI is after this date
    emiToUseForSimulation = paymentEntryBeforePrepayment.payment; // Use EMI from current schedule
  }

  // If prepayment clears the balance at the point of application
  if (prepaymentAmount >= balanceBeforeSimulatedPrepayment) { 
    if (balanceBeforeSimulatedPrepayment > 0 && baseSchedulePart.length > 0) {
        const lastEntryInBase = baseSchedulePart[baseSchedulePart.length-1];
        // The prepayment effectively becomes part of the "payment" for the period it's applied in.
        // Adjusting the last "paid" entry is tricky if it represents an EMI.
        // It's simpler to consider the prepayment happens, balance becomes 0.
        // The schedule effectively ends here.
        // If a visual representation of this simulated prepayment itself is needed, it's more complex.
        // For now, the schedule just truncates, and the simulation results show interest saved.
        lastEntryInBase.remainingBalance = 0; // Balance becomes 0 after this point.
         // Recalculate last payment if needed to clear the exact balance
        const interestForLastPeriod = lastEntryInBase.interestPaid;
        const principalToClear = balanceBeforeSimulatedPrepayment - prepaymentAmount > 0 ? 0 : balanceBeforeSimulatedPrepayment; // This needs care
        // This part is complex, let's simplify: If cleared, the remainingBalance of the last base part entry becomes 0.
        // The simulation will then show the impact.
    } else if (balanceBeforeSimulatedPrepayment > 0 && baseSchedulePart.length === 0) { 
        // Prepayment before first EMI clears the loan
         return [{
            month: 1,
            paymentDate: dateForNewSimulatedScheduleStart, // Or a more representative "prepayment date"
            payment: balanceBeforeSimulatedPrepayment, // This would be the effective payment
            principalPaid: balanceBeforeSimulatedPrepayment,
            interestPaid: 0, // Assuming no interest accrued if paid at start
            remainingBalance: 0,
            isPaid: false, // Simulation
        }];
    }
    // Return the base part, ensuring month numbers are sequential
    return baseSchedulePart.map((entry, index) => ({ ...entry, month: index + 1 }));
  }
  
  let simulatedBalanceAfterPrepayment = balanceBeforeSimulatedPrepayment - prepaymentAmount;
  // This check is redundant if the one above handles it, but as a safeguard:
  if (simulatedBalanceAfterPrepayment <= 0.01) { 
    if (baseSchedulePart.length > 0) {
        const lastEntry = baseSchedulePart[baseSchedulePart.length -1];
        lastEntry.remainingBalance = 0; 
    }
     return baseSchedulePart.map((entry, index) => ({ ...entry, month: index + 1 }));
  }

  const monthlyRate = originalLoanData.interestRate / 100 / 12;
  const newSimulatedSchedulePart: AmortizationEntry[] = [];
  let currentSimulatedBalanceInLoop = simulatedBalanceAfterPrepayment;
  let monthsCounter = 0;
  const maxIterations = originalLoanData.durationMonths * 2; // Safety break

  while (currentSimulatedBalanceInLoop > 0.01 && monthsCounter < maxIterations) {
    const interestForMonth = monthlyRate > 0 ? parseFloat((currentSimulatedBalanceInLoop * monthlyRate).toFixed(2)) : 0;
    let principalPaidThisMonth = parseFloat((emiToUseForSimulation - interestForMonth).toFixed(2));
    let actualPaymentThisMonth = emiToUseForSimulation;

    if (principalPaidThisMonth < 0 && monthlyRate > 0) { // Should not happen if EMI is correctly calculated for positive balance
        principalPaidThisMonth = 0;
    }

    // If current balance is less than the scheduled principal payment for this month (or EMI itself if interest is high)
    if (currentSimulatedBalanceInLoop - principalPaidThisMonth <= 0.01 && currentSimulatedBalanceInLoop > 0) {
      principalPaidThisMonth = currentSimulatedBalanceInLoop; // Pay off remaining balance
      actualPaymentThisMonth = parseFloat((principalPaidThisMonth + interestForMonth).toFixed(2));
    }
    
    currentSimulatedBalanceInLoop = parseFloat((currentSimulatedBalanceInLoop - principalPaidThisMonth).toFixed(2));
    currentSimulatedBalanceInLoop = Math.max(0, currentSimulatedBalanceInLoop); // Ensure balance doesn't go negative
    
    // Payment date for this new simulated EMI
    const paymentDate = formatISO(addMonths(parseISO(dateForNewSimulatedScheduleStart), monthsCounter + 1), { representation: 'date' });
    
    newSimulatedSchedulePart.push({
      month: baseSchedulePart.length + monthsCounter + 1, // Sequential month number
      paymentDate: paymentDate,
      payment: actualPaymentThisMonth,
      principalPaid: principalPaidThisMonth,
      interestPaid: interestForMonth,
      remainingBalance: currentSimulatedBalanceInLoop,
      isPaid: false, // Simulated entries are not 'paid' in reality
    });
    monthsCounter++;
    if (currentSimulatedBalanceInLoop <= 0.01) break;
  }
  
  const finalSchedule = [...baseSchedulePart, ...newSimulatedSchedulePart];
  // Ensure month numbers are sequential for the entire combined schedule
  return finalSchedule.map((entry, index) => ({...entry, month: index + 1}));
}


/**
 * Calculates the total interest paid in an amortization schedule.
 * @param schedule An array of AmortizationEntry objects.
 * @returns The total interest paid.
 */
export function calculateTotalInterest(schedule: AmortizationEntry[]): number {
  if (!schedule || schedule.length === 0) return 0;
  return schedule.reduce((total, entry) => total + entry.interestPaid, 0);
}


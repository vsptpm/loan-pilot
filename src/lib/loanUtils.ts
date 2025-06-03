
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
  // If termMonths is 0 but principal > 0, it's effectively an immediate repayment.
  if (termMonths <= 0 && principal > 0) {
      const paymentDate = formatISO(typeof startDate === 'string' ? parseISO(startDate) : startDate, { representation: 'date' });
      return [{
          month: 1,
          paymentDate: paymentDate,
          payment: principal,
          principalPaid: principal,
          interestPaid: 0,
          remainingBalance: 0,
          isPaid: true, // Considered paid off immediately
          actualPaidDate: paymentDate,
      }];
  }


  const schedule: AmortizationEntry[] = [];
  const monthlyRate = annualRate > 0 ? annualRate / 100 / 12 : 0;
  const emi = calculateEMI(principal, annualRate, termMonths);

  // Handle cases where EMI might be zero for a positive principal (e.g., 0% interest loan)
  if (emi === 0 && principal > 0 && annualRate === 0) {
    const simpleEMI = parseFloat((principal / termMonths).toFixed(2));
    let bal = principal;
    for (let i = 0; i < termMonths; i++) {
        const paymentDate = addMonths(typeof startDate === 'string' ? parseISO(startDate) : startDate, i + 1);
        const principalPaidThisMonth = (i === termMonths - 1) ? bal : simpleEMI;
        bal -= principalPaidThisMonth;
        bal = parseFloat(bal.toFixed(2));
        schedule.push({
            month: i + 1,
            paymentDate: formatISO(paymentDate, { representation: 'date' }),
            payment: principalPaidThisMonth,
            principalPaid: principalPaidThisMonth,
            interestPaid: 0,
            remainingBalance: Math.max(0, bal),
            isPaid: i + 1 <= initialPaidEMIs,
            actualPaidDate: i + 1 <= initialPaidEMIs ? formatISO(paymentDate, { representation: 'date' }) : undefined,
        });
        if (bal <=0) break;
    }
    return schedule.map((entry, index) => ({...entry, month: index + 1}));
  }
  if (emi === 0 && principal > 0 && annualRate > 0) {
    // This indicates an issue, likely termMonths is too large or rate too small for EMI formula.
    // Or principal itself should have been handled by prepayments/initial payments.
    console.warn("EMI calculated as 0 for a loan with positive principal and interest. Schedule may be incorrect.");
    // Potentially return a schedule that just shows the principal if it's paid off by initial/prepayments
    // For now, returning empty if EMI is 0 and interest is involved.
    if (principal - (recordedPrepayments.reduce((sum, pp) => sum + pp.amount, 0)) <=0 ) {
        // if prepayments cover it
         const paymentDate = formatISO(typeof startDate === 'string' ? parseISO(startDate) : startDate, { representation: 'date' });
         return [{
            month: 1,
            paymentDate: paymentDate,
            payment: principal,
            principalPaid: principal,
            interestPaid: 0,
            remainingBalance: 0,
            isPaid: true,
            actualPaidDate: paymentDate,
         }];
    }
    return [];
  }


  let currentBalance = principal;
  const loanStartDate = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  
  // Sort prepayments by date to ensure correct application order
  const sortedPrepayments = [...recordedPrepayments].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  let prepaymentPointer = 0;
  let effectiveMonth = 0;

  // Apply prepayments that occur before the first EMI date
  // These effectively reduce the starting balance for the amortization calculation.
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
        break; // Remaining prepayments are on or after the first EMI due date
    }
  }
  
  if (currentBalance <= 0) { // Loan paid off by initial amount + early prepayments
     const paymentDate = sortedPrepayments.length > 0 ? sortedPrepayments[prepaymentPointer-1].date : formatISO(loanStartDate, {representation: 'date'});
     return [{
        month: 1,
        paymentDate: paymentDate,
        payment: principal, // Total paid to clear
        principalPaid: principal,
        interestPaid: 0,
        remainingBalance: 0,
        isPaid: true,
        actualPaidDate: paymentDate,
     }];
  }


  // Max loop iterations: original term + a buffer for safety, though it should break earlier if term shortens.
  const maxIterations = termMonths + (recordedPrepayments.length * 2) + 12 ; 

  for (let i = 0; i < maxIterations; i++) {
    if (currentBalance <= 0.01) break; // Use a small threshold for float precision

    effectiveMonth++;
    const currentMonthPaymentDate = addMonths(loanStartDate, effectiveMonth);
    const currentMonthPaymentDateISO = formatISO(currentMonthPaymentDate, { representation: 'date' });
    
    // Apply prepayments that fall between the last EMI date (or loan start/early prepayments) and this EMI's due date
    const previousCycleEndDate = addMonths(loanStartDate, effectiveMonth -1);

    while (prepaymentPointer < sortedPrepayments.length) {
      const prepayment = sortedPrepayments[prepaymentPointer];
      const prepaymentDate = parseISO(prepayment.date);

      if (prepaymentDate > previousCycleEndDate && prepaymentDate <= currentMonthPaymentDate) {
         if (currentBalance > 0) {
            const amountToApply = Math.min(prepayment.amount, currentBalance);
            currentBalance -= amountToApply;
            currentBalance = parseFloat(currentBalance.toFixed(2));
         }
        prepaymentPointer++;
        if (currentBalance <= 0) break;
      } else if (prepaymentDate <= previousCycleEndDate) {
        // This should ideally not happen if logic for pre-first-EMI prepayments is correct
        // Or if a prepayment date was *exactly* on previous EMI date.
        prepaymentPointer++; 
      } else {
        break; // This prepayment is for a future cycle
      }
    }

    if (currentBalance <= 0.01) break;

    const interestForMonth = annualRate > 0 ? parseFloat((currentBalance * monthlyRate).toFixed(2)) : 0;
    let principalPaidThisMonth = parseFloat((emi - interestForMonth).toFixed(2));
    let actualPaymentThisMonth = emi;

    if (principalPaidThisMonth < 0 && annualRate > 0) { // Interest exceeds EMI
        principalPaidThisMonth = 0; // Only interest is covered
        // actualPaymentThisMonth remains emi, or could be adjusted if loan agreement allows
    }
    
    // Final payment adjustment
    if (currentBalance - principalPaidThisMonth <= 0.01 && currentBalance > 0) {
      principalPaidThisMonth = currentBalance;
      actualPaymentThisMonth = parseFloat((principalPaidThisMonth + interestForMonth).toFixed(2));
    }
    
    currentBalance = parseFloat((currentBalance - principalPaidThisMonth).toFixed(2));
    currentBalance = Math.max(0, currentBalance);

    schedule.push({
      month: effectiveMonth, 
      paymentDate: currentMonthPaymentDateISO,
      payment: actualPaymentThisMonth,
      principalPaid: principalPaidThisMonth,
      interestPaid: interestForMonth,
      remainingBalance: currentBalance,
      isPaid: effectiveMonth <= initialPaidEMIs,
      actualPaidDate: effectiveMonth <= initialPaidEMIs ? currentMonthPaymentDateISO : undefined,
    });

    if (currentBalance <= 0) break;
  }
  // Ensure month numbers are sequential from 1
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
 * @param loan The loan object.
 * @param schedule The loan's amortization schedule, which should already incorporate initialPaidEMIs and recordedPrepayments.
 * @returns A LoanStatus object reflecting status as of today.
 */
export function getLoanStatus(loan: Loan, schedule: AmortizationEntry[]): LoanStatus {
  const today = new Date();
  const todayDateOnly = parseISO(formatISO(today, { representation: 'date' }));

  if (!schedule || schedule.length === 0) {
    // This implies the loan is fully paid off (e.g., by prepayments or 0 duration/principal, handled by generateAmortizationSchedule)
    // or it's a 0 principal loan from the start.
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

  let lastEntryOnOrBeforeToday: AmortizationEntry | null = null;
  let firstEntryAfterToday: AmortizationEntry | null = null;
  let cumulativeInterestPaidUpToToday = 0;
  let cumulativePrincipalPaidUpToTodayInSchedule = 0; // Sum of principal components from schedule entries
  let paidEMIsByDateCount = 0;

  for (const entry of schedule) {
    const entryPaymentDate = parseISO(entry.paymentDate);
    if (isBefore(entryPaymentDate, todayDateOnly) || isEqual(entryPaymentDate, todayDateOnly)) {
      lastEntryOnOrBeforeToday = entry;
      cumulativeInterestPaidUpToToday += entry.interestPaid;
      cumulativePrincipalPaidUpToTodayInSchedule += entry.principalPaid;
      paidEMIsByDateCount = entry.month; // This is the count of EMIs scheduled up to this point
    } else if (!firstEntryAfterToday) {
      firstEntryAfterToday = entry;
      // No break here, need to find the actual end of schedule for estimatedClosureDate
    }
  }
  
  let currentBalance: number;
  let totalPrincipalEffectivelyPaid: number;

  if (lastEntryOnOrBeforeToday) {
    currentBalance = lastEntryOnOrBeforeToday.remainingBalance;
    // If the loan is paid off by this entry, total principal paid is the original amount
    totalPrincipalEffectivelyPaid = loan.principalAmount - currentBalance;
  } else {
    // Today is before the first scheduled payment.
    // Balance is principal minus any amount already paid AND any prepayments made before the first EMI.
    // This complex scenario is handled by generateAmortizationSchedule which adjusts the 'currentBalance' from the start.
    // So, if lastEntryOnOrBeforeToday is null, it means schedule starts in future.
    // The balance should be the first entry's principal (if schedule[0] is the start before first EMI) or loan.principalAmount.
    // Let's rely on schedule's integrity: currentBalance is what generateAmortizationSchedule starts with
    // or loan.principalAmount if schedule starts with first EMI due.
    // The 'schedule' passed here should have already accounted for initial 'amountAlreadyPaid' (via initialPaidEMIs)
    // and any prepayments made before the first scheduled EMI when it was generated.
    // So, the 'currentBalance' for the loan *before any EMIs are due* is essentially the starting principal
    // of the *first* entry in the schedule (if schedule items represented state *before* payment)
    // or simply loan.principalAmount if initial state prepayments were reflected in its generation.
    // Given generateAmortizationSchedule gives EMIs, the balance before first EMI is loan.principalAmount MINUS impact of amountAlreadyPaid and early prepayments.
    // This is complex. Let's assume generateAmortizationSchedule output reflects this.
    // If no entries are due by today, currentBalance is effectively principal - (amountAlreadyPaid applied as principal reduction) - (early prepayments).
    // For simplicity, if no entries by today, balance is loan.principalAmount minus whatever reduction was applied to it by generateAmortizationSchedule's start.
    // The most reliable "currentBalance" is simply the `remainingBalance` of the *first entry* if today is before it,
    // OR `loan.principalAmount` minus initial deductions if the schedule reflects that.
    // This is tricky. The most direct way is:
    currentBalance = schedule[0]?.remainingBalance + schedule[0]?.principalPaid + schedule[0]?.interestPaid - schedule[0]?.payment; // Balance *before* first payment
    if(schedule.length > 0 && isBefore(todayDateOnly, parseISO(schedule[0].paymentDate))) {
       // If today is before the first EMI, the balance is effectively the starting principal of the schedule
       // which is loan.principalAmount minus impact of amountAlreadyPaid and any prepayments before 1st EMI.
       // `generateAmortizationSchedule` is expected to have produced a schedule where balance is correct.
       // The balance *before* the first payment is the principal of the loan, after any initial reductions.
       // To get this, we'd need to know the balance *before* the first EMI.
       // Let's assume if `lastEntryOnOrBeforeToday` is null, current balance is the initial loan principal adjusted by initial reductions.
       // `totalPrincipalEffectivelyPaid` would be sum of those initial reductions.
       // `getInitialPaidEMIsCount` + `recordedPrepayments` are used by `generateAmortizationSchedule`
       // The `schedule` given to `getLoanStatus` is the result.
       // So, if no `lastEntryOnOrBeforeToday`, then `currentBalance` is `loan.principalAmount` (original) unless schedule generation has
       // effectively reduced it due to `amountAlreadyPaid` or very early prepayments.
       // The balance of the loan IS `loan.principalAmount` until the first payment calculation changes it.
       // Prepayments and `amountAlreadyPaid` effectively make the schedule start with a lower `currentBalance` in `generateAmortizationSchedule`.
       // So, if no EMIs are due yet, `currentBalance` is the initial balance from `generateAmortizationSchedule`.
       // This starting balance might be principal, or principal reduced by prepayments made before any EMIs.
       
       // If today is before the first EMI:
       currentBalance = loan.principalAmount - (loan.amountAlreadyPaid || 0); // Simplified: initial paid reduces principal directly here for status if no EMIs due
       // More accurately, if `generateAmortizationSchedule` has reduced the principal at its start due to prepayments/initial amounts:
       // currentBalance should be that starting principal.
       // The first entry in the schedule, if it exists, its (remainingBalance + principalPaid) should be the balance before that payment.
       if (schedule.length > 0) {
         // This is the balance right before the first scheduled payment would be made.
         currentBalance = schedule[0].remainingBalance + schedule[0].principalPaid;
       } else {
         currentBalance = loan.principalAmount - (loan.amountAlreadyPaid || 0); // Fallback
       }

    }
    totalPrincipalEffectivelyPaid = loan.principalAmount - currentBalance; // What has reduced the original principal
  }
  
  currentBalance = Math.max(0, parseFloat(currentBalance.toFixed(2))); 
  if (currentBalance === 0 && loan.principalAmount > 0) { 
    totalPrincipalEffectivelyPaid = loan.principalAmount;
  }


  const nextDueDate = firstEntryAfterToday ? firstEntryAfterToday.paymentDate : null;
  const completedPercentage = loan.principalAmount > 0 ? (totalPrincipalEffectivelyPaid / loan.principalAmount) * 100 : (currentBalance === 0 ? 100:0);
  
  // Estimated closure date is the payment date of the last entry in the potentially shortened schedule
  const estimatedClosureDate = schedule.length > 0 ? schedule[schedule.length - 1].paymentDate : null;
  
  // Remaining EMIs are total in (prepayment-adjusted) schedule minus those due by date
  const remainingEMIsCount = schedule.length - paidEMIsByDateCount;

  return {
    currentBalance: currentBalance,
    totalInterestPaid: parseFloat(cumulativeInterestPaidUpToToday.toFixed(2)),
    totalPrincipalPaid: parseFloat(totalPrincipalEffectivelyPaid.toFixed(2)),
    nextDueDate: nextDueDate,
    paidEMIsCount: paidEMIsByDateCount,
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
  
  // Determine the state *before* the simulated prepayment
  let balanceBeforeSimulatedPrepayment: number;
  let dateForNewSimulatedScheduleStart: string;
  let baseSchedulePart: AmortizationEntry[]; // Part of currentSchedule before simulation point
  let emiToUseForSimulation: number;


  if (prepaymentAfterMonth === 0) {
    // Prepayment applied before the first entry of the current (possibly already prepayment-adjusted) schedule.
    // The "principal" for this simulation is the balance *before* the first payment of currentSchedule.
    if (currentSchedule.length === 0) { // Loan is already fully paid
        return [];
    }
    const firstEntry = currentSchedule[0];
    // Balance before the first payment in currentSchedule
    balanceBeforeSimulatedPrepayment = firstEntry.remainingBalance + firstEntry.principalPaid; 
    
    baseSchedulePart = [];
    // Simulation starts from the effective start date that led to currentSchedule's first payment.
    // This needs the date *before* currentSchedule[0].paymentDate by one payment cycle.
    // Or, more simply, the originalLoanData.startDate if currentSchedule starts from the beginning.
    dateForNewSimulatedScheduleStart = formatISO(addMonths(parseISO(firstEntry.paymentDate), -1), {representation: 'date'});
    emiToUseForSimulation = firstEntry.payment; // Use EMI from the current schedule
    
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

  // Apply the simulated prepayment
  if (prepaymentAmount >= balanceBeforeSimulatedPrepayment) { // Simulated prepayment clears the loan
    if (balanceBeforeSimulatedPrepayment > 0 && baseSchedulePart.length > 0) {
        const lastEntryInBase = baseSchedulePart[baseSchedulePart.length-1];
        // Adjust this entry to show it's paid off by this simulation
        // This can be complex: does the prepayment replace or add to an EMI?
        // For simplicity, assume it just clears the remaining balance at that point.
        lastEntryInBase.payment += (balanceBeforeSimulatedPrepayment - lastEntryInBase.interestPaid); // adjust payment to cover rest
        lastEntryInBase.principalPaid = balanceBeforeSimulatedPrepayment;
        lastEntryInBase.remainingBalance = 0;
    } else if (balanceBeforeSimulatedPrepayment > 0 && baseSchedulePart.length === 0) { // Prepayment at month 0 clears it
         return [{
            month: 1,
            paymentDate: dateForNewSimulatedScheduleStart, // Or a bit later
            payment: balanceBeforeSimulatedPrepayment,
            principalPaid: balanceBeforeSimulatedPrepayment,
            interestPaid: 0,
            remainingBalance: 0,
            isPaid: false, // It's a simulation
        }];
    }
    return baseSchedulePart;
  }
  
  let simulatedBalance = balanceBeforeSimulatedPrepayment - prepaymentAmount;
  if (simulatedBalance <= 0.01) { // effectively paid off
    // Similar to above, adjust baseSchedulePart's last entry or return a single clearing entry.
    if (baseSchedulePart.length > 0) {
        baseSchedulePart[baseSchedulePart.length -1].remainingBalance = 0; // Simplified
    }
    return baseSchedulePart;
  }

  // Generate the new schedule part after the simulated prepayment
  const monthlyRate = originalLoanData.interestRate / 100 / 12;
  const newSimulatedSchedulePart: AmortizationEntry[] = [];
  let currentSimulatedBalanceInLoop = simulatedBalance;
  let monthsCounter = 0;
  const maxIterations = originalLoanData.durationMonths * 2; // Safety break

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
      isPaid: false, // Simulated entries are not 'paid' in reality
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


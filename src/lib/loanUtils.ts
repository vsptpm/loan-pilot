
import type { Loan, AmortizationEntry, LoanFormData, RecordedPrepayment, WhatIfAnalysisResults } from '@/types';
import { addMonths, formatISO, parseISO, differenceInCalendarMonths, isBefore, isEqual, isAfter, differenceInMonths } from 'date-fns';

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
    const firstEmiDueDate = addMonths(loanStartDate, 1);

    if (isBefore(prepaymentDate, firstEmiDueDate) || isEqual(prepaymentDate, loanStartDate)) {
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
     const lastPpDate = sortedPrepayments.length > 0 && prepaymentPointer > 0 ? sortedPrepayments[prepaymentPointer-1].date : formatISO(loanStartDate, {representation: 'date'});
     const finalIsPaid = true;
     return [{
        month: 1,
        paymentDate: lastPpDate, 
        payment: principal, 
        principalPaid: principal,
        interestPaid: 0,
        remainingBalance: 0,
        isPaid: finalIsPaid,
        actualPaidDate: finalIsPaid ? lastPpDate : undefined,
     }];
  }

  const maxIterations = termMonths + (recordedPrepayments.length * 2) + 24 ; 

  for (let i = 0; i < maxIterations; i++) {
    if (currentBalance <= 0.01) break; 

    effectiveMonth++;
    const currentMonthPaymentDateDt = addMonths(loanStartDate, effectiveMonth);
    const currentMonthPaymentDateISO = formatISO(currentMonthPaymentDateDt, { representation: 'date' });
    const paymentDueDate = parseISO(currentMonthPaymentDateISO);
    
    const previousEmiDueDate = addMonths(loanStartDate, effectiveMonth -1);

    while (prepaymentPointer < sortedPrepayments.length) {
      const prepayment = sortedPrepayments[prepaymentPointer];
      const prepaymentDate = parseISO(prepayment.date);

      if (isAfter(prepaymentDate, previousEmiDueDate) && (isBefore(prepaymentDate, currentMonthPaymentDateDt) || isEqual(prepaymentDate, currentMonthPaymentDateDt))) {
         if (currentBalance > 0) {
            const amountToApply = Math.min(prepayment.amount, currentBalance);
            currentBalance -= amountToApply;
            currentBalance = parseFloat(currentBalance.toFixed(2));
         }
        prepaymentPointer++;
        if (currentBalance <= 0) break; 
      } else if (isBefore(prepaymentDate, previousEmiDueDate) || isEqual(prepaymentDate, previousEmiDueDate)) {
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

  let currentBalanceFromSchedule = loan.principalAmount; 
  let totalPrincipalScheduledPaid = 0; 
  let totalInterestScheduledPaid = 0; 
  let paidEMIsSoFarCount = 0;
  let nextPaymentDueDate: string | null = null;
  let lastProcessedEntry: AmortizationEntry | null = null;
  
  for (const entry of schedule) {
    if (entry.isPaid) { 
      lastProcessedEntry = entry;
    } else if (!nextPaymentDueDate) {
      nextPaymentDueDate = entry.paymentDate;
    }
  }
  
  if (lastProcessedEntry) {
    currentBalanceFromSchedule = lastProcessedEntry.remainingBalance;
    paidEMIsSoFarCount = lastProcessedEntry.month;
    
    for(let i = 0; i < paidEMIsSoFarCount && i < schedule.length; i++){
      if(schedule[i].isPaid) { 
        totalPrincipalScheduledPaid += schedule[i].principalPaid;
        totalInterestScheduledPaid += schedule[i].interestPaid;
      }
    }
  } else {
     if (schedule.length > 0) {
        currentBalanceFromSchedule = schedule[0].remainingBalance + schedule[0].principalPaid; 
        nextPaymentDueDate = schedule[0].paymentDate;
     } else { 
        currentBalanceFromSchedule = loan.principalAmount;
     }
  }

  let finalCurrentBalance: number;
  let finalTotalPrincipalPaid: number;


  if (forSummaryView && loan.totalPrepaymentAmount && loan.totalPrepaymentAmount > 0) {
    let tempCurrentBalance = currentBalanceFromSchedule - loan.totalPrepaymentAmount;
    finalCurrentBalance = Math.max(0, parseFloat(tempCurrentBalance.toFixed(2)));
    
    let tempTotalPrincipalPaid = totalPrincipalScheduledPaid + loan.totalPrepaymentAmount;
    finalTotalPrincipalPaid = parseFloat(tempTotalPrincipalPaid.toFixed(2));
    finalTotalPrincipalPaid = Math.min(finalTotalPrincipalPaid, loan.principalAmount); 
    
    finalCurrentBalance = parseFloat((loan.principalAmount - finalTotalPrincipalPaid).toFixed(2));
    finalCurrentBalance = Math.max(0, finalCurrentBalance);


  } else {
    finalCurrentBalance = parseFloat(currentBalanceFromSchedule.toFixed(2));
    finalCurrentBalance = Math.max(0, finalCurrentBalance);
    finalTotalPrincipalPaid = parseFloat((loan.principalAmount - finalCurrentBalance).toFixed(2));
    finalTotalPrincipalPaid = Math.min(finalTotalPrincipalPaid, loan.principalAmount); 
    finalTotalPrincipalPaid = Math.max(0, finalTotalPrincipalPaid);
  }
  
  const finalTotalInterestPaid = parseFloat(totalInterestScheduledPaid.toFixed(2));

  const completedPercentage = loan.principalAmount > 0 
    ? parseFloat(((finalTotalPrincipalPaid / loan.principalAmount) * 100).toFixed(2)) 
    : (finalCurrentBalance === 0 ? 100 : 0);
  
  const estimatedClosureDate = schedule.length > 0 ? schedule[schedule.length - 1].paymentDate : loan.startDate;
  const remainingEMIsCount = schedule.length - paidEMIsSoFarCount;

  return {
    currentBalance: finalCurrentBalance,
    totalInterestPaid: finalTotalInterestPaid,
    totalPrincipalPaid: finalTotalPrincipalPaid,
    nextDueDate: finalCurrentBalance === 0 ? null : nextPaymentDueDate,
    paidEMIsCount: paidEMIsSoFarCount,
    remainingEMIsCount: remainingEMIsCount < 0 ? 0 : remainingEMIsCount,
    completedPercentage: completedPercentage > 100 ? 100 : ( completedPercentage < 0 ? 0 : completedPercentage),
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

interface SimulationParams {
  type: 'one-time' | 'recurring';
  amount: number;
  applyAfterMonth: number; // Month in *currentSchedule* after which the ONE-TIME or FIRST recurring prepayment occurs
  recurringFrequencyMonths?: number; // e.g., 6 for every 6 months, 12 for annually
}

/**
 * Generates a new amortization schedule based on simulation parameters (one-time or recurring prepayment).
 * @param originalLoanData The original loan's base terms.
 * @param currentSchedule The current amortization schedule, reflecting all actual recorded prepayments.
 * @param simulationParams Parameters for the simulation.
 * @returns A new amortization schedule incorporating the simulated prepayment(s).
 */
export function generateSimulatedSchedule(
  originalLoanData: Pick<Loan, 'principalAmount' | 'interestRate' | 'durationMonths' | 'startDate' | 'amountAlreadyPaid'>,
  currentSchedule: AmortizationEntry[],
  simulationParams: SimulationParams
): AmortizationEntry[] {
  const { type, amount: prepaymentAmount, applyAfterMonth, recurringFrequencyMonths } = simulationParams;

  if (prepaymentAmount <= 0) {
    return [...currentSchedule];
  }

  if (applyAfterMonth < 0 || (applyAfterMonth > 0 && applyAfterMonth > currentSchedule.length)) {
    console.warn("Simulated prepayment month is out of bounds of the current schedule.");
    return [...currentSchedule];
  }

  let balanceAtSimStartPoint: number;
  let dateForNewScheduleGenStart: string; // Date of the payment *after* which the new schedule begins
  let baseSchedulePart: AmortizationEntry[];
  let emiForSimulation: number;
  let monthOffsetForSimulatedPart = 0; // How many months into the current schedule the simulation starts

  if (currentSchedule.length === 0 && originalLoanData.principalAmount > 0) {
    // Handling edge case: current schedule is empty (e.g. loan fully paid by initial amount/prepayments, or error)
    // but we are trying to simulate on top of the original loan.
    // For simulation, we'd start from the original loan terms.
    balanceAtSimStartPoint = originalLoanData.principalAmount;
    dateForNewScheduleGenStart = originalLoanData.startDate; // Or addMonths(parseISO(originalLoanData.startDate), -1) if first emi is after 1 month
    baseSchedulePart = [];
    emiForSimulation = calculateEMI(originalLoanData.principalAmount, originalLoanData.interestRate, originalLoanData.durationMonths);
    monthOffsetForSimulatedPart = 0;

  } else if (applyAfterMonth === 0) {
    if (currentSchedule.length === 0) return []; // No basis if current schedule truly empty and original principal is 0
    const firstEntryCurrentSchedule = currentSchedule[0];
    balanceAtSimStartPoint = firstEntryCurrentSchedule.remainingBalance + firstEntryCurrentSchedule.principalPaid;
    baseSchedulePart = [];
    // The new schedule generation starts as if it's from the month *before* the first entry of the current schedule.
    dateForNewScheduleGenStart = formatISO(addMonths(parseISO(firstEntryCurrentSchedule.paymentDate), -1), { representation: 'date' });
    emiForSimulation = firstEntryCurrentSchedule.payment;
    monthOffsetForSimulatedPart = 0;
  } else {
    const entryBeforeSimStart = currentSchedule[applyAfterMonth - 1];
    if (!entryBeforeSimStart) {
      console.warn("Cannot find entry for simulated prepayment month in current schedule.");
      return [...currentSchedule];
    }
    balanceAtSimStartPoint = entryBeforeSimStart.remainingBalance;
    baseSchedulePart = currentSchedule.slice(0, applyAfterMonth);
    dateForNewScheduleGenStart = entryBeforeSimStart.paymentDate;
    emiForSimulation = entryBeforeSimStart.payment;
    monthOffsetForSimulatedPart = applyAfterMonth;
  }
  
  // Apply the first (or one-time) prepayment
  let currentSimulatedBalance = balanceAtSimStartPoint - prepaymentAmount;
  currentSimulatedBalance = Math.max(0, parseFloat(currentSimulatedBalance.toFixed(2)));

  if (currentSimulatedBalance <= 0.01) {
    // Prepayment clears the loan at this point
    if (baseSchedulePart.length > 0) {
      baseSchedulePart[baseSchedulePart.length - 1].remainingBalance = 0;
    } else if (balanceAtSimStartPoint > 0) { // Prepayment at month 0 clears it all
        return [{
            month:1,
            paymentDate: dateForNewScheduleGenStart, // Or a more appropriate date if pre-first EMI
            payment: balanceAtSimStartPoint,
            principalPaid: balanceAtSimStartPoint,
            interestPaid: 0,
            remainingBalance: 0,
            isPaid: false, // Simulation
        }];
    }
    return baseSchedulePart.map((entry, index) => ({ ...entry, month: index + 1, isPaid: false }));
  }

  const monthlyRate = originalLoanData.interestRate / 100 / 12;
  const newSimulatedSchedulePart: AmortizationEntry[] = [];
  let monthsElapsedInSimulation = 0; // Tracks months *after* the first simulated prepayment
  const maxIterations = (originalLoanData.durationMonths * 2) + 120; // Safety break for long loans / frequent prepayments

  for (let i = 0; i < maxIterations && currentSimulatedBalance > 0.01; i++) {
    monthsElapsedInSimulation++;
    
    const interestForMonth = monthlyRate > 0 ? parseFloat((currentSimulatedBalance * monthlyRate).toFixed(2)) : 0;
    let principalPaidThisMonth = parseFloat((emiForSimulation - interestForMonth).toFixed(2));
    let actualPaymentThisMonth = emiForSimulation;

    if (principalPaidThisMonth < 0 && monthlyRate > 0) {
      principalPaidThisMonth = 0; // All payment goes to interest
    }

    // Adjust if this is the final payment
    if (currentSimulatedBalance - principalPaidThisMonth <= 0.01 && currentSimulatedBalance > 0) {
      principalPaidThisMonth = currentSimulatedBalance;
      actualPaymentThisMonth = parseFloat((principalPaidThisMonth + interestForMonth).toFixed(2));
    }
    
    currentSimulatedBalance = parseFloat((currentSimulatedBalance - principalPaidThisMonth).toFixed(2));
    currentSimulatedBalance = Math.max(0, currentSimulatedBalance);

    // Check for recurring prepayment for *this* month (after regular EMI processing)
    if (type === 'recurring' && recurringFrequencyMonths && (monthsElapsedInSimulation % recurringFrequencyMonths === 0)) {
        if (currentSimulatedBalance > 0) {
            const recurringPrepayAmountToApply = Math.min(prepaymentAmount, currentSimulatedBalance);
            currentSimulatedBalance -= recurringPrepayAmountToApply;
            currentSimulatedBalance = Math.max(0, parseFloat(currentSimulatedBalance.toFixed(2)));
            // Note: The `actualPaymentThisMonth` and `principalPaidThisMonth` for the schedule entry 
            // primarily reflect the EMI. The recurring prepayment's effect is directly on the balance.
            // If we wanted to show it in the payment, we'd add it here. For simplicity, we apply to balance.
        }
    }
    
    const paymentDate = formatISO(addMonths(parseISO(dateForNewScheduleGenStart), monthsElapsedInSimulation), { representation: 'date' });
    
    newSimulatedSchedulePart.push({
      month: baseSchedulePart.length + monthsElapsedInSimulation,
      paymentDate: paymentDate,
      payment: actualPaymentThisMonth, // This is still the scheduled EMI
      principalPaid: principalPaidThisMonth,
      interestPaid: interestForMonth,
      remainingBalance: currentSimulatedBalance,
      isPaid: false, // All entries in simulated part are 'not paid'
    });

    if (currentSimulatedBalance <= 0.01) break;
  }
  
  const finalSchedule = [...baseSchedulePart, ...newSimulatedSchedulePart];
  // Renumber months sequentially from 1
  return finalSchedule.map((entry, index) => ({ ...entry, month: index + 1, isPaid: entry.isPaid && index < baseSchedulePart.length }));
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

/**
 * Simulates the impact of paying a new, potentially higher, EMI on a loan from a certain point.
 * @param currentBalance The outstanding loan balance at the point the new EMI starts.
 * @param annualRate The loan's annual interest rate (percentage).
 * @param newMonthlyEMI The new EMI amount.
 * @param startDateForNewSchedule The date (ISO string) from which the new EMI payments begin. This is usually the date of the *next* scheduled EMI after which the change is made.
 * @param originalEmiForInterestCalculation The EMI amount used for interest calc if new EMI is not provided or valid.
 * @returns An object containing the new projected schedule, closure date, and total interest paid.
 */
export function simulateNewEMI(
  currentBalance: number,
  annualRate: number,
  newMonthlyEMI: number,
  startDateForNewSchedule: string // This should be the due date of the *first* payment with the new EMI
): Pick<WhatIfAnalysisResults, 'newSchedule' | 'newProjectedClosureDate' | 'newTotalInterestPaid' | 'timeSavedInMonths'> & { monthsToRepay: number } {

  const newSchedule: AmortizationEntry[] = [];
  if (currentBalance <= 0) {
    return { newSchedule, newProjectedClosureDate: startDateForNewSchedule, newTotalInterestPaid: 0, monthsToRepay: 0, timeSavedInMonths: 0 };
  }

  const monthlyRate = annualRate / 100 / 12;
  
  if (monthlyRate > 0 && newMonthlyEMI <= currentBalance * monthlyRate) {
    console.warn("New EMI is not enough to cover interest. Loan will not be repaid.");
     return { newSchedule: [], newProjectedClosureDate: null, newTotalInterestPaid: 0, monthsToRepay: Infinity, timeSavedInMonths: 0 };
  }


  let balance = currentBalance;
  let totalInterestForNewSchedule = 0;
  let monthCount = 0;
  const maxIterations = 1200; 

  while (balance > 0.01 && monthCount < maxIterations) {
    monthCount++;
    const interestForMonth = monthlyRate > 0 ? parseFloat((balance * monthlyRate).toFixed(2)) : 0;
    let principalPaidThisMonth = parseFloat((newMonthlyEMI - interestForMonth).toFixed(2));
    let actualPaymentThisMonth = newMonthlyEMI;

    if (principalPaidThisMonth < 0 && monthlyRate > 0) { 
        principalPaidThisMonth = 0;
    }

    if (balance - principalPaidThisMonth <= 0.01) { 
      principalPaidThisMonth = balance;
      actualPaymentThisMonth = parseFloat((principalPaidThisMonth + interestForMonth).toFixed(2));
    }

    balance = parseFloat((balance - principalPaidThisMonth).toFixed(2));
    balance = Math.max(0, balance);
    totalInterestForNewSchedule += interestForMonth;

    const paymentDate = formatISO(addMonths(parseISO(startDateForNewSchedule), monthCount - 1), { representation: 'date' });
    
    newSchedule.push({
      month: monthCount,
      paymentDate: paymentDate,
      payment: actualPaymentThisMonth,
      principalPaid: principalPaidThisMonth,
      interestPaid: interestForMonth,
      remainingBalance: balance,
      isPaid: false, 
    });

    if (balance <= 0.01) break;
  }
  
  const newClosureDate = newSchedule.length > 0 ? newSchedule[newSchedule.length - 1].paymentDate : null;

  return {
    newSchedule,
    newProjectedClosureDate: newClosureDate,
    newTotalInterestPaid: parseFloat(totalInterestForNewSchedule.toFixed(2)),
    monthsToRepay: monthCount,
    timeSavedInMonths: 0, 
  };
}


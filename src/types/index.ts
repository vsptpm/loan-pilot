
import type { Timestamp } from 'firebase/firestore';

// For data input via form
export interface LoanFormData {
  name: string;
  principalAmount: number; // Original principal amount
  interestRate: number; // Annual interest rate as a percentage (e.g., 5 for 5%)
  duration: number; // Loan term
  durationType: 'months' | 'years'; // Unit for duration
  startDate: Date; // Original start date of the loan
  amountAlreadyPaid?: number; // Optional: Amount already paid before tracking in app
}

// How loan data is stored in Firestore
export interface Loan {
  id: string; // Firestore document ID
  userId: string;
  name: string;
  principalAmount: number; // Original principal amount
  interestRate: number; // Annual interest rate (e.g., 5 for 5%)
  durationMonths: number; // Original loan term in months
  startDate: string; // Original start date of the loan (ISO string)
  amountAlreadyPaid: number; // Amount already paid (defaults to 0 if not provided)
  totalPrepaymentAmount?: number; // Sum of all recorded prepayments for this loan
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Represents an entry in the amortization schedule
export interface AmortizationEntry {
  month: number;
  paymentDate: string; // ISO string
  payment: number; // EMI amount for this month
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
  isPaid: boolean; // Whether this EMI has been marked as paid by the user
  actualPaidDate?: string; // Optional: Actual date user marked/logged payment
}

// For recording a new prepayment via form
export interface RecordedPrepaymentFormData {
  amount: number;
  date: Date;
  notes?: string;
}

// How recorded prepayments are stored in Firestore (as a subcollection of a loan)
export interface RecordedPrepayment {
  id: string; // Firestore document ID
  amount: number;
  date: string; // ISO string for the prepayment date
  notes?: string;
  createdAt: Timestamp; // Firestore server timestamp
}

// For the Prepayment Simulator results
export interface SimulationResults {
  newClosureDate: string | null;
  interestSaved: number;
  originalTotalInterest: number;
  newTotalInterest: number;
  simulatedSchedule: AmortizationEntry[];
  oldClosureDate: string | null;
}

// For "What If" Analyzer results
export interface WhatIfAnalysisResults {
  originalProjectedClosureDate: string | null;
  originalTotalInterest: number;
  originalMonthlyEMI: number;
  newProjectedClosureDate: string | null;
  newTotalInterestPaid: number; // Total interest from the point of change with new EMI
  newSchedule: AmortizationEntry[];
  totalInterestSaved: number;
  timeSavedInMonths: number;
}

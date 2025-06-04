
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISO, format, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number as a currency string (INR).
 * @param amount The number to format.
 * @returns A string representing the formatted currency, e.g., "₹1,234.56". Returns an empty string if amount is null/undefined.
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) {
    // Handle null or undefined, return an empty string
    return '';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

/**
 * Formats a date string or Date object into a readable string format.
 * @param dateInput The date string (ISO format recommended) or Date object to format.
 * @returns A formatted date string, e.g., "Aug 1, 2024". Returns an empty string if dateInput is null/undefined/empty, or "Invalid Date" if parsing fails.
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return '';
  }

  let dateObj: Date;

  if (typeof dateInput === 'string') {
    // Try parseISO first as it's more specific for ISO strings
    dateObj = parseISO(dateInput);
    // If parseISO results in an invalid date, try new Date() as a fallback
    // This handles cases where dateInput might be a format new Date() understands but parseISO doesn't
    if (!isValid(dateObj)) {
      dateObj = new Date(dateInput);
    }
  } else { // dateInput is already a Date object
    dateObj = dateInput;
  }

  // Check if the final dateObj is valid before formatting
  if (!isValid(dateObj)) {
    // console.warn("formatDate: Input resulted in an invalid Date object:", dateInput);
    return 'Invalid Date';
  }

  try {
    // 'PP' format is like "Jul 17, 2024"
    return format(dateObj, 'PP');
  } catch (error) {
    // console.error("Error formatting date with date-fns format:", dateInput, error);
    // This catch might be redundant if isValid(dateObj) is comprehensive, but good for safety.
    return 'Invalid Date';
  }
}

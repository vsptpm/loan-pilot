import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISO, format } from 'date-fns';

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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Formats a date string or Date object into a readable string format.
 * @param dateString The date string (ISO format) or Date object to format.
 * @returns A formatted date string, e.g., "Aug 1, 2024". Returns an empty string if dateString is null/undefined or invalid.
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) {
    return '';
  }
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
    return format(date, 'PP'); // 'PP' format is like "Jul 17, 2024"
  } catch (error) {
    // console.error("Error formatting date:", dateString, error);
    // Fallback if date parsing fails, though parseISO is robust
    return 'Invalid Date'; 
  }
}

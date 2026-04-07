/**
 * Utility functions for handling text truncation and formatting in web UIs
 */

/**
 * Truncate email address if it's too long
 * @param email - The email to truncate
 * @param maxLength - Maximum length before truncation (default: 20)
 * @returns Truncated email with ellipsis
 */
export function truncateEmail(email: string, maxLength: number = 20): string {
  if (!email) return "";
  if (email.length <= maxLength) return email;
  return `${email.slice(0, maxLength - 3)}...`;
}

/**
 * Truncate any text to a maximum length
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

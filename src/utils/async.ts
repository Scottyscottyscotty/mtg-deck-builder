/**
 * Async utility functions
 */

/**
 * Sleep for a specified duration
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

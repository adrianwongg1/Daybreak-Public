export const MAX_BRIEFING_JOB_ATTEMPTS = 3;

export function retryDelayMinutes(attempts: number): number {
  return Math.min(60, 2 ** Math.max(attempts - 1, 0));
}

export function isTerminalJobAttempt(attempts: number): boolean {
  return attempts >= MAX_BRIEFING_JOB_ATTEMPTS;
}

/**
 * Pure deterministic time utilities for aviation 24h clock operations.
 */

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMinutes: number): string {
  // Clamp to positive range
  const clamped = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 0) return `-${formatDuration(-minutes)}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDelayBadge(delayMins: number): string {
  if (delayMins <= 0) return 'ON TIME';
  if (delayMins < 60) return `+${delayMins}m`;
  return `+${formatDuration(delayMins)}`;
}

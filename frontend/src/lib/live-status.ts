// Shared (client + server) derivation of a LiveAnnouncement's effective
// status from its scheduled window. Per design decision: the live itself
// happens off-platform — Corridor only stores a time-boxed signal — so
// "LIVE" is never a stored state, just `now()` falling inside the window.
// `CANCELLED` is the one state that can't be derived and stays persisted.
export type LiveDerivedStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export interface LiveWindow {
  status: string;
  scheduledStart: string | Date;
  scheduledEnd: string | Date;
}

export function deriveLiveStatus(live: LiveWindow, now: Date = new Date()): LiveDerivedStatus {
  if (live.status === 'CANCELLED') return 'CANCELLED';
  const start = new Date(live.scheduledStart).getTime();
  const end = new Date(live.scheduledEnd).getTime();
  const t = now.getTime();
  if (t < start) return 'SCHEDULED';
  if (t <= end) return 'LIVE';
  return 'ENDED';
}

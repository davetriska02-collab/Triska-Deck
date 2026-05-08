// Arming state machine. In-memory only. Cleared on tab close (this script
// being unloaded is enough); on disarm; on successful LIVE execution; and on
// the five-second timeout.

import type { ArmingState } from '@/shared/types';

const ARM_WINDOW_MS = 5000;

type Listener = (state: ArmingState | null) => void;

class ArmingController {
  private current: ArmingState | null = null;
  private timer: number | null = null;
  private listeners = new Set<Listener>();

  arm(buttonId: string, workflowId: string): ArmingState {
    this.disarm();
    const now = Date.now();
    this.current = {
      buttonId,
      workflowId,
      armedAt: now,
      expiresAt: now + ARM_WINDOW_MS,
    };
    this.timer = window.setTimeout(() => this.disarm(), ARM_WINDOW_MS);
    this.notify();
    return this.current;
  }

  disarm(): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.current !== null) {
      this.current = null;
      this.notify();
    }
  }

  // Consume the arm if the requested button matches the armed one. Returns
  // true if consumption succeeded (the caller may proceed in LIVE). Returns
  // false otherwise (the caller must fall back to CONFIRM).
  consume(buttonId: string): boolean {
    if (!this.current) return false;
    if (this.current.buttonId !== buttonId) return false;
    if (Date.now() > this.current.expiresAt) {
      this.disarm();
      return false;
    }
    this.disarm();
    return true;
  }

  state(): ArmingState | null {
    if (this.current && Date.now() > this.current.expiresAt) this.disarm();
    return this.current;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l(this.current);
  }
}

export const arming = new ArmingController();
export const ARM_WINDOW_MS_EXPORT = ARM_WINDOW_MS;

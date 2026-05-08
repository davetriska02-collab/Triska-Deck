// Workflow recorder. Phase 3 of the build sequence; the production
// implementation will:
//   - listen for clicks, key presses, focus changes, navigations
//   - log each user action with three candidate selectors per element
//     (CSS path on stable attributes, role+accessible name, text fallback)
//   - convert the trace into the smallest sequence of primitives
//   - present the captured steps in an inline editor for naming, ordering,
//     deletion and wait insertion
//
// This stub fixes the public interface so the panel can call into it without
// needing the full implementation.

import type { Step } from '@/shared/types';

export interface RecorderHandle {
  stop(): Promise<Step[]>;
  cancel(): void;
  count(): number;
}

export function startRecording(): RecorderHandle {
  let stopped = false;
  const steps: Step[] = [];

  // TODO Phase 3: attach DOM listeners, build candidate selectors per
  // interaction, debounce mutations, and translate the trace into primitives.

  return {
    async stop() {
      stopped = true;
      return steps;
    },
    cancel() {
      stopped = true;
    },
    count() {
      return stopped ? steps.length : steps.length;
    },
  };
}

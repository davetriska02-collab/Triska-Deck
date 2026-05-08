import type { Workspace } from './types';
import { buildMedicusOrigin, MEDICUS_ORIGIN } from './medicusPack';

export function defaultWorkspace(): Workspace {
  const now = Date.now();
  const { origin, workflows } = buildMedicusOrigin();

  const workflowMap: Workspace['workflows'] = {};
  for (const wf of workflows) workflowMap[wf.id] = wf;

  return {
    version: 1,
    origins: { [MEDICUS_ORIGIN]: origin },
    workflows: workflowMap,
    settings: {
      liveDisabled: false,
      liveTutorialCompleted: false,
      panelCompact: false,
      panelPosition: { x: 24, y: 24 },
    },
    createdAt: now,
    lastEditedAt: now,
  };
}

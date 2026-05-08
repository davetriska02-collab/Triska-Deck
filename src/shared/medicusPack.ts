// Medicus pre-loaded pack. Constants here are the known-good shortcuts from the
// plan. They are seeds, not contracts: revalidate periodically against the
// live UI.

import type { DeckButton, Origin, Workflow } from './types';
import { newId } from './ids';

// Origin templates. Default to the england tenant; the tenant slug appears in
// the URL pattern so we leave it as a placeholder the user can edit on the
// origin's settings page once we add tenant-config UI.
export const MEDICUS_ORIGIN = 'https://england.medicus.health';
const TENANT = '{tenant}';

// Task list deep links.
// Pattern: /{tenant}/tasks/{task_type}/task-list?statuses[]=...&masterAssignee={role_uuid}&viewContext=homepage
function taskListUrl(taskType: string, statuses: string[]): string {
  const qp = new URLSearchParams();
  for (const s of statuses) qp.append('statuses[]', s);
  qp.set('viewContext', 'homepage');
  return `${MEDICUS_ORIGIN}/${TENANT}/tasks/${taskType}/task-list?${qp.toString()}`;
}

const TASK_LIST_BUTTONS: DeckButton[] = [
  {
    id: newId('btn'),
    label: 'Triage MR',
    icon: '📋',
    color: '#0ea5e9',
    action: {
      kind: 'PRIMITIVE',
      step: {
        id: newId('step'),
        type: 'NAVIGATE',
        url: taskListUrl('medical_patient_request_task', ['new-request']),
      },
    },
  },
  {
    id: newId('btn'),
    label: 'Awaiting Reply',
    icon: '⏳',
    color: '#0ea5e9',
    action: {
      kind: 'PRIMITIVE',
      step: {
        id: newId('step'),
        type: 'NAVIGATE',
        url: taskListUrl('medical_patient_request_task', [
          'awaiting-recipient-response',
        ]),
      },
    },
  },
  {
    id: newId('btn'),
    label: 'Reply Received',
    icon: '↩️',
    color: '#0ea5e9',
    action: {
      kind: 'PRIMITIVE',
      step: {
        id: newId('step'),
        type: 'NAVIGATE',
        url: taskListUrl('medical_patient_request_task', ['reply-received']),
      },
    },
  },
  {
    id: newId('btn'),
    label: 'Routine Rx',
    icon: '💊',
    color: '#22c55e',
    action: {
      kind: 'PRIMITIVE',
      step: {
        id: newId('step'),
        type: 'NAVIGATE',
        url: taskListUrl('prescription_request_task_routine', ['new-request']),
      },
    },
  },
  {
    id: newId('btn'),
    label: 'Non-routine Rx',
    icon: '🚨',
    color: '#f59e0b',
    action: {
      kind: 'PRIMITIVE',
      step: {
        id: newId('step'),
        type: 'NAVIGATE',
        url: taskListUrl('prescription_request_task_non_routine', [
          'new-request',
        ]),
      },
    },
  },
  {
    id: newId('btn'),
    label: 'General Tasks',
    icon: '📝',
    color: '#0ea5e9',
    action: {
      kind: 'PRIMITIVE',
      step: {
        id: newId('step'),
        type: 'NAVIGATE',
        url: taskListUrl('general_task', ['new-request']),
      },
    },
  },
];

// Right panel switcher: combobox by accessible name.
// We click the combobox, then click the option with the matching role/name.
function rightPanelButton(view: string): DeckButton {
  return {
    id: newId('btn'),
    label: view,
    icon: '🪟',
    color: '#64748b',
    action: {
      kind: 'WORKFLOW',
      // Workflow is created alongside in defaultWorkspace.
      workflowId: rightPanelWorkflowId(view),
    },
  };
}

const RIGHT_PANEL_VIEWS = [
  'Care Record',
  'Clinical Summary',
  'Journal',
  'Medication Regimen',
  'Medication History',
  'Immunisations',
  'Results and Observations',
  'Problems',
  'Appointments',
  'Personal Details',
  'Registration',
  'Data Sharing',
  'Tasks',
  'Online Access',
  'Booking Links',
  'Internal Conversations',
  'Yellow Cards',
] as const;

export type RightPanelView = (typeof RIGHT_PANEL_VIEWS)[number];

function rightPanelWorkflowId(view: string): string {
  return `wf_medicus_rightpanel_${view.toLowerCase().replace(/\s+/g, '_')}`;
}

function rightPanelWorkflow(view: string): Workflow {
  const now = Date.now();
  return {
    id: rightPanelWorkflowId(view),
    name: `Right panel → ${view}`,
    origin: MEDICUS_ORIGIN,
    steps: [
      {
        id: newId('step'),
        type: 'CLICK',
        target: { ariaName: { role: 'combobox', name: 'Right panel view' } },
      },
      {
        id: newId('step'),
        type: 'WAIT_FOR_DOM',
        target: { ariaName: { role: 'option', name: view } },
        condition: 'APPEAR',
        timeoutMs: 2000,
      },
      {
        id: newId('step'),
        type: 'CLICK',
        target: { ariaName: { role: 'option', name: view } },
      },
    ],
    commitMode: 'SAFE',
    liveEligible: false,
    successCount: 0,
    liveRunCount: 0,
    createdAt: now,
    lastEditedAt: now,
  };
}

// Slash-menu shortcuts inside Codes and actions.
const SLASH_SHORTCUTS: Array<[string, string, string]> = [
  ['Prescription', 'pres', '💊'],
  ['Referral', 'ref', '➡️'],
  ['Investigation', 'inv', '🧪'],
  ['Fit note', 'fit', '📄'],
  ['Procedure', 'proc', '🛠️'],
  ['Communication', 'com', '✉️'],
  ['Document', 'doc', '📎'],
  ['Future action', 'fut', '🗓️'],
  ['QRisk', 'qri', '❤️'],
  ['Immunisation', 'imm', '💉'],
];

function slashWorkflowId(label: string): string {
  return `wf_medicus_slash_${label.toLowerCase().replace(/\s+/g, '_')}`;
}

function slashWorkflow(label: string, fragment: string): Workflow {
  const now = Date.now();
  return {
    id: slashWorkflowId(label),
    name: `Slash → ${label}`,
    origin: MEDICUS_ORIGIN,
    steps: [
      {
        id: newId('step'),
        type: 'CLICK',
        target: { ariaName: { name: 'Codes and actions' } },
      },
      {
        id: newId('step'),
        type: 'INJECT_TEXT',
        target: { ariaName: { name: 'Codes and actions' } },
        text: `/${fragment}\n`,
      },
    ],
    commitMode: 'SAFE',
    liveEligible: false,
    successCount: 0,
    liveRunCount: 0,
    createdAt: now,
    lastEditedAt: now,
    hasDraftRisk: true,
  };
}

function slashButton(label: string, icon: string): DeckButton {
  return {
    id: newId('btn'),
    label,
    icon,
    color: '#a855f7',
    action: { kind: 'WORKFLOW', workflowId: slashWorkflowId(label) },
  };
}

export function buildMedicusOrigin(): {
  origin: Origin;
  workflows: Workflow[];
} {
  const rightPanelButtons = RIGHT_PANEL_VIEWS.map(rightPanelButton);
  const slashButtons = SLASH_SHORTCUTS.map(([label, , icon]) =>
    slashButton(label, icon),
  );

  const origin: Origin = {
    origin: MEDICUS_ORIGIN,
    label: 'Medicus',
    pages: [
      {
        id: newId('page'),
        name: 'Task lists',
        buttons: TASK_LIST_BUTTONS,
      },
      {
        id: newId('page'),
        name: 'Right panel',
        buttons: rightPanelButtons,
      },
      {
        id: newId('page'),
        name: 'Slash menu',
        buttons: slashButtons,
      },
    ],
    submitClassExtras: [
      'Submit',
      'Send',
      'Save and Close',
      'Sign and Send',
      'Confirm Prescription',
      'Issue',
    ],
  };

  const workflows: Workflow[] = [
    ...RIGHT_PANEL_VIEWS.map((v) => rightPanelWorkflow(v)),
    ...SLASH_SHORTCUTS.map(([label, fragment]) =>
      slashWorkflow(label, fragment),
    ),
  ];

  return { origin, workflows };
}

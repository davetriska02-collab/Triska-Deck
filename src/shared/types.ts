// Triska data model. Persistent entities are JSON-serialisable; the workspace
// JSON is the export format.

export type CommitMode = 'SAFE' | 'CONFIRM' | 'LIVE';

export type ActionPrimitive =
  | 'NAVIGATE'
  | 'INJECT_TEXT'
  | 'CLICK'
  | 'WAIT_FOR_DOM'
  | 'RUN_WORKFLOW';

export interface SelectorBundle {
  // Three candidate selectors, tried in order. At least one is required.
  css?: string;
  ariaName?: { role?: string; name: string };
  text?: string;
}

export interface NavigateStep {
  id: string;
  type: 'NAVIGATE';
  url: string;
}

export interface InjectTextStep {
  id: string;
  type: 'INJECT_TEXT';
  target: SelectorBundle;
  text: string;
  // Whether text is treated as literal or templated (e.g. {{patient.id}}).
  templated?: boolean;
  // Field-type hint for redaction in the audit log.
  isClinicalSearch?: boolean;
}

export interface ClickStep {
  id: string;
  type: 'CLICK';
  target: SelectorBundle;
}

export type DomCondition = 'APPEAR' | 'DISAPPEAR' | 'QUIET';

export interface WaitForDomStep {
  id: string;
  type: 'WAIT_FOR_DOM';
  target?: SelectorBundle;
  condition: DomCondition;
  timeoutMs: number;
  // For QUIET: how long the DOM must be still before resolving.
  quietMs?: number;
}

export interface RunWorkflowStep {
  id: string;
  type: 'RUN_WORKFLOW';
  workflowId: string;
}

export type Step =
  | NavigateStep
  | InjectTextStep
  | ClickStep
  | WaitForDomStep
  | RunWorkflowStep;

export interface Workflow {
  id: string;
  name: string;
  origin: string;
  steps: Step[];
  commitMode: CommitMode;
  liveEligible: boolean;
  successCount: number;
  liveRunCount: number;
  createdAt: number;
  lastEditedAt: number;
  lastRunAt?: number;
  // Set if any step writes draft data; the executor will offer rollback.
  hasDraftRisk?: boolean;
}

export type ButtonAction =
  | { kind: 'PRIMITIVE'; step: Step }
  | { kind: 'WORKFLOW'; workflowId: string };

export interface DeckButton {
  id: string;
  label: string;
  icon?: string; // emoji, lucide name, or data-uri
  color?: string; // hex
  hotkey?: string;
  action: ButtonAction;
}

export interface Page {
  id: string;
  name: string;
  buttons: DeckButton[];
}

export interface Origin {
  origin: string; // e.g. "https://england.medicus.health"
  label: string;
  pages: Page[];
  // Submit-class denylist: text fragments to additionally treat as commit.
  submitClassExtras?: string[];
}

export interface Workspace {
  version: 1;
  origins: Record<string, Origin>;
  workflows: Record<string, Workflow>;
  settings: WorkspaceSettings;
  createdAt: number;
  lastEditedAt: number;
}

export interface WorkspaceSettings {
  // Kill switch: when true, no workflow may run in LIVE mode regardless of
  // its liveEligible flag. May be locked by an admin password hash.
  liveDisabled: boolean;
  liveDisabledLocked?: boolean;
  liveDisabledPasswordHash?: string;
  // First-run knowledge check completed; required before flagging anything LIVE.
  liveTutorialCompleted: boolean;
  // UI defaults.
  panelCompact: boolean;
  panelPosition: { x: number; y: number };
}

// Audit log entries are append-only and never leave the device.
export type AuditOutcome = 'SUCCESS' | 'ABORTED_BY_USER' | 'ABORTED_BY_FAILURE';

export interface AuditEntry {
  id: string;
  timestamp: number;
  origin: string;
  workflowId: string;
  workflowName: string;
  mode: CommitMode;
  // Patient context if extractable from URL.
  patientHint?: string;
  steps: AuditStepRecord[];
  outcome: AuditOutcome;
  failedSelector?: string;
  // True for any LIVE-mode execution. Surfaced as the red flag in UI.
  liveFlag: boolean;
}

export interface AuditStepRecord {
  type: ActionPrimitive;
  // Free text content is redacted unless the step was flagged isClinicalSearch.
  detail: string;
  durationMs: number;
  ok: boolean;
}

// Arming state lives in memory in the content script only. Never persisted.
export interface ArmingState {
  buttonId: string;
  workflowId: string;
  armedAt: number;
  // Five-second timeout from armedAt.
  expiresAt: number;
}

// Messages crossing the background <-> content boundary.
export type RuntimeMessage =
  | { kind: 'TOGGLE_PANEL' }
  | { kind: 'OPEN_EDITOR' }
  | { kind: 'WORKSPACE_UPDATED' }
  | { kind: 'AUDIT_APPEND'; entry: AuditEntry };

// Workflow executor. Implements the five primitives, the safety catch
// (SAFE / CONFIRM / LIVE), draft rollback on abort, and audit logging.

import type {
  AuditEntry,
  AuditOutcome,
  AuditStepRecord,
  CommitMode,
  InjectTextStep,
  Step,
  Workflow,
  Workspace,
} from '@/shared/types';
import { newId } from '@/shared/ids';
import { appendAuditEntry, saveWorkspace } from '@/shared/storage';
import { isSubmitClass } from './submitDetection';
import { resolveOnce, resolveWithRetry, sleep, waitQuiet } from './resolver';

export interface ToastSink {
  show(message: string, opts?: { variant?: 'info' | 'success' | 'error' | 'live' | 'confirm'; durationMs?: number }): string;
  clear(id: string): void;
  // Block until user picks Continue/Abort. Reject = abort.
  prompt(message: string, opts?: { live?: boolean }): Promise<'continue' | 'abort'>;
}

export interface ExecuteOptions {
  workflow: Workflow;
  workspace: Workspace;
  // Effective commit mode for this run. SAFE if liveDisabled or not eligible.
  effectiveMode: CommitMode;
  toasts: ToastSink;
  // Cancellation hook the panel can flip to abort.
  signal: AbortSignal;
}

export type ExecuteResult = AuditOutcome;

interface DraftSnapshot {
  step: InjectTextStep;
  prior: string;
  el: WeakRef<HTMLElement>;
}

export async function executeWorkflow(
  opts: ExecuteOptions,
): Promise<ExecuteResult> {
  const { workflow, workspace, effectiveMode, toasts, signal } = opts;
  const submitExtras =
    workspace.origins[workflow.origin]?.submitClassExtras ?? [];

  const headerVariant: 'info' | 'confirm' | 'live' =
    effectiveMode === 'LIVE'
      ? 'live'
      : effectiveMode === 'CONFIRM'
        ? 'confirm'
        : 'info';
  const headerPrefix =
    effectiveMode === 'LIVE'
      ? `LIVE FIRE: ${workflow.name}`
      : effectiveMode === 'CONFIRM'
        ? `CONFIRM: ${workflow.name}`
        : workflow.name;
  const headerToast = toasts.show(headerPrefix, { variant: headerVariant });

  const drafts: DraftSnapshot[] = [];
  const stepRecords: AuditStepRecord[] = [];
  let outcome: AuditOutcome = 'SUCCESS';
  let failedSelector: string | undefined;

  try {
    for (const step of workflow.steps) {
      if (signal.aborted) {
        outcome = 'ABORTED_BY_USER';
        break;
      }
      const start = Date.now();
      const stepRecord: AuditStepRecord = {
        type: step.type,
        detail: redactDetail(step),
        durationMs: 0,
        ok: false,
      };
      try {
        await runStep(step, {
          drafts,
          submitExtras,
          effectiveMode,
          toasts,
          signal,
        });
        stepRecord.ok = true;
      } catch (err) {
        stepRecord.ok = false;
        if (err instanceof Error && err.name === 'AbortError') {
          outcome = 'ABORTED_BY_USER';
        } else if (err instanceof SelectorMissError) {
          outcome = 'ABORTED_BY_FAILURE';
          failedSelector = err.selectorDesc;
          toasts.show(`Selector miss: ${err.selectorDesc}`, { variant: 'error', durationMs: 4000 });
        } else if (err instanceof UserAbortError) {
          outcome = 'ABORTED_BY_USER';
        } else {
          outcome = 'ABORTED_BY_FAILURE';
          toasts.show(`Step failed: ${(err as Error).message}`, { variant: 'error', durationMs: 4000 });
        }
        stepRecord.durationMs = Date.now() - start;
        stepRecords.push(stepRecord);
        break;
      }
      stepRecord.durationMs = Date.now() - start;
      stepRecords.push(stepRecord);
    }
  } finally {
    toasts.clear(headerToast);
  }

  if (outcome !== 'SUCCESS') {
    rollbackDrafts(drafts);
  }

  // Update workflow metadata.
  workflow.lastRunAt = Date.now();
  if (outcome === 'SUCCESS') {
    workflow.successCount += 1;
    if (effectiveMode === 'LIVE') workflow.liveRunCount += 1;
    workspace.workflows[workflow.id] = workflow;
    void saveWorkspace(workspace);
  }

  // Audit log.
  const entry: AuditEntry = {
    id: newId('aud'),
    timestamp: Date.now(),
    origin: workflow.origin,
    workflowId: workflow.id,
    workflowName: workflow.name,
    mode: effectiveMode,
    patientHint: extractPatientHint(),
    steps: stepRecords,
    outcome,
    failedSelector,
    liveFlag: effectiveMode === 'LIVE',
  };
  void appendAuditEntry(entry);

  // Final toast.
  if (outcome === 'SUCCESS') {
    if (effectiveMode === 'LIVE') {
      toasts.show(`LIVE FIRE complete: ${workflow.name}`, {
        variant: 'live',
        durationMs: 2000,
      });
    } else {
      toasts.show('Done', { variant: 'success', durationMs: 1200 });
    }
  } else if (outcome === 'ABORTED_BY_USER') {
    toasts.show('Aborted', { variant: 'error', durationMs: 1500 });
  }

  return outcome;
}

interface StepCtx {
  drafts: DraftSnapshot[];
  submitExtras: string[];
  effectiveMode: CommitMode;
  toasts: ToastSink;
  signal: AbortSignal;
}

async function runStep(step: Step, ctx: StepCtx): Promise<void> {
  switch (step.type) {
    case 'NAVIGATE': {
      window.location.assign(step.url);
      // After navigation the content script is re-injected; the workflow
      // tail does not survive. The recorder produces single-step navigate
      // buttons and longer flows that begin in-page.
      return;
    }

    case 'CLICK': {
      const r = await resolveWithRetry(step.target, 3000);
      if (!r.el) throw new SelectorMissError(describeSelector(step.target));

      // Submit-class gating.
      if (isSubmitClass(r.el, ctx.submitExtras)) {
        if (ctx.effectiveMode === 'SAFE') {
          ctx.toasts.show('Stop for user — submit step left for you', {
            variant: 'confirm',
            durationMs: 2500,
          });
          return;
        }
        if (ctx.effectiveMode === 'CONFIRM') {
          const decision = await ctx.toasts.prompt('Fire? Continue or Abort');
          if (decision === 'abort') throw new UserAbortError();
        }
        // LIVE falls through and clicks.
      }

      r.el.click();
      return;
    }

    case 'INJECT_TEXT': {
      const r = await resolveWithRetry(step.target, 3000);
      if (!r.el) throw new SelectorMissError(describeSelector(step.target));
      // Snapshot prior content so we can roll back on abort.
      const prior = readFieldValue(r.el);
      ctx.drafts.push({
        step,
        prior,
        el: new WeakRef(r.el),
      });
      r.el.focus();
      typeInto(r.el, step.text);
      return;
    }

    case 'WAIT_FOR_DOM': {
      if (step.condition === 'QUIET') {
        await waitQuiet(step.quietMs ?? 250, step.timeoutMs);
        return;
      }
      if (!step.target) {
        await sleep(Math.min(step.timeoutMs, 250));
        return;
      }
      const start = Date.now();
      while (Date.now() - start < step.timeoutMs) {
        if (ctx.signal.aborted) throw new UserAbortError();
        const r = resolveOnce(step.target);
        const present = !!r.el;
        if (step.condition === 'APPEAR' && present) return;
        if (step.condition === 'DISAPPEAR' && !present) return;
        await sleep(50);
      }
      throw new SelectorMissError(describeSelector(step.target));
    }

    case 'RUN_WORKFLOW':
      // Nested workflows are dispatched by the panel; the executor itself
      // does not recurse to keep audit boundaries clear.
      throw new Error('RUN_WORKFLOW must be expanded by the panel');
  }
}

function rollbackDrafts(drafts: DraftSnapshot[]): void {
  for (const d of drafts) {
    const el = d.el.deref();
    if (!el) continue;
    writeFieldValue(el, d.prior);
  }
}

function readFieldValue(el: HTMLElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value;
  }
  if (el.isContentEditable) return el.textContent ?? '';
  return '';
}

function writeFieldValue(el: HTMLElement, value: string): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(el),
      'value',
    )?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (el.isContentEditable) {
    el.textContent = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function typeInto(el: HTMLElement, text: string): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Use the native value setter so React's onChange picks up the update.
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(el),
      'value',
    )?.set;
    const next = (el.value ?? '') + text;
    setter?.call(el, next);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  if (el.isContentEditable) {
    // execCommand is deprecated but remains the most reliable way to insert
    // text into a rich-text editor and emit the events the framework expects.
    el.focus();
    document.execCommand('insertText', false, text);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
  }
}

function describeSelector(b: { css?: string; ariaName?: { role?: string; name: string }; text?: string }): string {
  if (b.css) return `css:${b.css}`;
  if (b.ariaName) return `aria:${b.ariaName.role ?? '*'}[${b.ariaName.name}]`;
  if (b.text) return `text:${b.text}`;
  return '<empty selector>';
}

function redactDetail(step: Step): string {
  switch (step.type) {
    case 'NAVIGATE':
      return step.url;
    case 'CLICK':
      return describeSelector(step.target);
    case 'INJECT_TEXT':
      // Redact text unless explicitly flagged as a clinical search.
      if (step.isClinicalSearch) return `text=${step.text}`;
      return `text=<redacted ${step.text.length} chars>`;
    case 'WAIT_FOR_DOM':
      return `${step.condition} ${step.target ? describeSelector(step.target) : ''} t=${step.timeoutMs}`;
    case 'RUN_WORKFLOW':
      return `wf=${step.workflowId}`;
  }
}

function extractPatientHint(): string | undefined {
  // Best-effort: try to capture a /patients/<uuid-or-id>/ segment without
  // capturing names or other PII. Tighten per-origin in v2.
  const m = window.location.pathname.match(/\/patients\/([a-zA-Z0-9-]{6,})/);
  return m ? `pid:${m[1]}` : undefined;
}

class SelectorMissError extends Error {
  selectorDesc: string;
  constructor(selectorDesc: string) {
    super(`Selector miss: ${selectorDesc}`);
    this.name = 'SelectorMissError';
    this.selectorDesc = selectorDesc;
  }
}

class UserAbortError extends Error {
  constructor() {
    super('User abort');
    this.name = 'AbortError';
  }
}

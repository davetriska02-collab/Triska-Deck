import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ArmingState,
  ButtonAction,
  CommitMode,
  DeckButton,
  Origin,
  Step,
  Workflow,
  Workspace,
} from '@/shared/types';
import { arming, ARM_WINDOW_MS_EXPORT } from './arming';
import { executeWorkflow, type ToastSink } from './executor';
import { newId } from '@/shared/ids';
import { loadWorkspace, saveWorkspace, watchWorkspace } from '@/shared/storage';
import { startRecording, type RecorderHandle } from './recorder';

interface PanelProps {
  open: boolean;
  onClose: () => void;
}

interface Toast {
  id: string;
  message: string;
  variant: 'info' | 'success' | 'error' | 'live' | 'confirm';
  // Resolves a prompt; absent means non-interactive toast.
  resolve?: (decision: 'continue' | 'abort') => void;
  ttlAt?: number;
}

export function Panel({ open, onClose }: PanelProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [armState, setArmState] = useState<ArmingState | null>(null);
  const [now, setNow] = useState(Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const [recCount, setRecCount] = useState(0);
  const [recording, setRecording] = useState(false);
  const [draftSteps, setDraftSteps] = useState<Step[] | null>(null);

  useEffect(() => {
    void loadWorkspace().then(setWorkspace);
    return watchWorkspace(setWorkspace);
  }, []);

  useEffect(() => arming.subscribe(setArmState), []);

  // Tick while armed so the countdown ring updates.
  useEffect(() => {
    if (!armState) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [armState]);

  const origin = useMemo<Origin | null>(() => {
    if (!workspace) return null;
    const key = `${window.location.protocol}//${window.location.host}`;
    return workspace.origins[key] ?? null;
  }, [workspace]);

  const page = origin?.pages[pageIdx];

  const toastSink: ToastSink = useMemo(
    () => ({
      show(message, opts) {
        const id = newId('toast');
        const ttl = opts?.durationMs ?? 0;
        setToasts((t) => [
          ...t,
          {
            id,
            message,
            variant: opts?.variant ?? 'info',
            ttlAt: ttl > 0 ? Date.now() + ttl : undefined,
          },
        ]);
        if (ttl > 0) {
          window.setTimeout(() => {
            setToasts((t) => t.filter((x) => x.id !== id));
          }, ttl);
        }
        return id;
      },
      clear(id) {
        setToasts((t) => t.filter((x) => x.id !== id));
      },
      prompt(message, opts) {
        return new Promise<'continue' | 'abort'>((resolve) => {
          const id = newId('toast');
          setToasts((t) => [
            ...t,
            {
              id,
              message,
              variant: opts?.live ? 'live' : 'confirm',
              resolve: (decision) => {
                setToasts((cur) => cur.filter((x) => x.id !== id));
                resolve(decision);
              },
            },
          ]);
        });
      },
    }),
    [],
  );

  const runButton = useCallback(
    async (button: DeckButton) => {
      if (!workspace) return;
      const wf = resolveWorkflow(button.action, workspace);
      if (!wf) return;

      const effective = effectiveCommitMode({
        workflow: wf,
        workspace,
        armingMatched: arming.consume(button.id),
      });

      abortRef.current = new AbortController();
      try {
        await executeWorkflow({
          workflow: wf,
          workspace,
          effectiveMode: effective,
          toasts: toastSink,
          signal: abortRef.current.signal,
        });
      } finally {
        abortRef.current = null;
      }
    },
    [workspace, toastSink],
  );

  const armButton = useCallback((button: DeckButton) => {
    if (!workspace) return;
    const wf = resolveWorkflow(button.action, workspace);
    if (!wf) return;
    if (!liveAvailable(wf, workspace)) return;
    arming.arm(button.id, wf.id);
  }, [workspace]);

  if (!workspace) return null;

  const stopAndDiscard = () => {
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
    setRecCount(0);
  };

  return (
    <>
      {recording && !open && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 2147483647,
            background: '#3f0d0d',
            border: '2px solid #ef4444',
            color: '#fee2e2',
            padding: '8px 12px',
            borderRadius: 8,
            fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            boxShadow: '0 0 14px rgba(239,68,68,0.6)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 6px rgba(239,68,68,0.9)',
            }}
          />
          <span style={{ fontSize: 12 }}>REC · {recCount} steps</span>
          <button onClick={() => recorderRef.current?.undoLast()} style={iconBtn}>
            ↶
          </button>
          <button
            onClick={async () => {
              const handle = recorderRef.current;
              if (!handle) return;
              const steps = await handle.stop();
              recorderRef.current = null;
              setRecording(false);
              setRecCount(0);
              setDraftSteps(steps);
            }}
            style={{ ...iconBtn, color: '#fee2e2', borderColor: '#ef4444' }}
          >
            Stop
          </button>
          <button onClick={stopAndDiscard} style={iconBtn}>
            ×
          </button>
        </div>
      )}
      {draftSteps && (
        <SaveWorkflowModal
          steps={draftSteps}
          workspace={workspace}
          onCancel={() => setDraftSteps(null)}
          onSaved={() => setDraftSteps(null)}
        />
      )}
      {open && (
    <div
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 2147483647,
        width: 360,
        background: '#0f172a',
        color: '#e2e8f0',
        borderRadius: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <strong style={{ letterSpacing: 1 }}>TRISKA</strong>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {recording ? (
            <>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 6px rgba(239,68,68,0.8)',
                }}
              />
              <span style={{ fontSize: 11, color: '#fee2e2' }}>
                REC · {recCount}
              </span>
              <button onClick={() => recorderRef.current?.undoLast()} style={iconBtn}>
                ↶
              </button>
              <button
                onClick={async () => {
                  const handle = recorderRef.current;
                  if (!handle) return;
                  const steps = await handle.stop();
                  recorderRef.current = null;
                  setRecording(false);
                  setRecCount(0);
                  setDraftSteps(steps);
                }}
                style={{ ...iconBtn, color: '#fee2e2', borderColor: '#ef4444' }}
              >
                Stop
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                const handle = startRecording();
                recorderRef.current = handle;
                handle.subscribe(setRecCount);
                setRecording(true);
                onClose();
              }}
              style={iconBtn}
              title="Record a workflow"
            >
              ●
            </button>
          )}
          <button onClick={() => chrome.runtime.openOptionsPage()} style={iconBtn}>
            ⚙︎
          </button>
          <button onClick={onClose} style={iconBtn}>
            ×
          </button>
        </div>
      </header>

      {!origin ? (
        <div style={{ padding: 16, fontSize: 13, color: '#94a3b8' }}>
          No deck for <code>{window.location.host}</code>. Open the editor to add one.
        </div>
      ) : (
        <>
          <nav style={{ display: 'flex', gap: 4, padding: '6px 8px', borderBottom: '1px solid #1e293b' }}>
            {origin.pages.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setPageIdx(i)}
                style={{
                  ...tabBtn,
                  background: i === pageIdx ? '#1e293b' : 'transparent',
                }}
              >
                {p.name}
              </button>
            ))}
          </nav>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 6,
              padding: 8,
            }}
          >
            {page?.buttons.map((b) => {
              const wf = resolveWorkflow(b.action, workspace);
              const mode: CommitMode = wf?.commitMode ?? 'SAFE';
              const liveOk = wf ? liveAvailable(wf, workspace) : false;
              const armed = armState?.buttonId === b.id;
              const remaining = armed && armState
                ? Math.max(0, armState.expiresAt - now)
                : 0;
              return (
                <DeckButtonView
                  key={b.id}
                  btn={b}
                  mode={mode}
                  liveOk={liveOk}
                  armed={armed}
                  remainingMs={remaining}
                  onRun={() => runButton(b)}
                  onArm={() => armButton(b)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
      )}

      <div style={{ position: 'fixed', right: 24, top: 24, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 2147483647 }}>
        {toasts.map((t) => (
          <ToastView key={t.id} t={t} />
        ))}
      </div>
    </>
  );
}

function DeckButtonView({
  btn,
  mode,
  liveOk,
  armed,
  remainingMs,
  onRun,
  onArm,
}: {
  btn: DeckButton;
  mode: CommitMode;
  liveOk: boolean;
  armed: boolean;
  remainingMs: number;
  onRun: () => void;
  onArm: () => void;
}) {
  const border =
    armed
      ? '2px solid #ef4444'
      : liveOk
        ? '1px solid #ef4444'
        : mode === 'CONFIRM'
          ? '1px solid #f59e0b'
          : '1px solid #1e293b';
  const glow = armed ? '0 0 12px rgba(239,68,68,0.7)' : 'none';
  const ringPct = armed
    ? Math.round((remainingMs / ARM_WINDOW_MS_EXPORT) * 100)
    : 0;
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onRun}
        title={`${btn.label} — ${mode}${liveOk ? ' (LIVE-eligible)' : ''}`}
        style={{
          width: '100%',
          height: 64,
          background: btn.color ?? '#1e293b',
          color: '#0f172a',
          fontWeight: 600,
          border,
          borderRadius: 8,
          boxShadow: glow,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          padding: 4,
        }}
      >
        <span style={{ fontSize: 18 }}>{btn.icon ?? '◻︎'}</span>
        <span style={{ fontSize: 10, lineHeight: 1.1, textAlign: 'center' }}>{btn.label}</span>
      </button>
      {liveOk && (
        <button
          onClick={onArm}
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            background: armed ? '#ef4444' : 'rgba(15,23,42,0.7)',
            color: '#fef2f2',
            border: 'none',
            borderRadius: 4,
            fontSize: 9,
            padding: '1px 4px',
            cursor: 'pointer',
          }}
        >
          {armed ? `${Math.ceil(remainingMs / 1000)}s` : 'ARM'}
        </button>
      )}
      {armed && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: 8,
            background: `conic-gradient(rgba(239,68,68,0.6) ${ringPct}%, transparent ${ringPct}%)`,
            mixBlendMode: 'multiply',
            opacity: 0.25,
          }}
        />
      )}
    </div>
  );
}

function ToastView({ t }: { t: Toast }) {
  const palette: Record<Toast['variant'], { bg: string; border: string; fg: string }> = {
    info: { bg: '#0f172a', border: '#334155', fg: '#e2e8f0' },
    success: { bg: '#052e1b', border: '#22c55e', fg: '#dcfce7' },
    error: { bg: '#3f0d0d', border: '#ef4444', fg: '#fee2e2' },
    live: { bg: '#3f0d0d', border: '#ef4444', fg: '#fee2e2' },
    confirm: { bg: '#3a2a05', border: '#f59e0b', fg: '#fef3c7' },
  };
  const c = palette[t.variant];
  return (
    <div
      style={{
        background: c.bg,
        border: `2px solid ${c.border}`,
        color: c.fg,
        padding: '8px 10px',
        borderRadius: 6,
        minWidth: 200,
        fontSize: 12,
        fontFamily: 'system-ui',
        boxShadow: t.variant === 'live' ? '0 0 14px rgba(239,68,68,0.6)' : '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <div>{t.message}</div>
      {t.resolve && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
          <button
            onClick={() => t.resolve?.('abort')}
            style={{ ...promptBtn, background: '#1f2937', color: '#fee2e2' }}
          >
            Abort
          </button>
          <button
            onClick={() => t.resolve?.('continue')}
            style={{ ...promptBtn, background: '#ef4444', color: '#0f172a' }}
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#94a3b8',
  border: '1px solid #1e293b',
  borderRadius: 4,
  padding: '2px 6px',
  cursor: 'pointer',
  fontSize: 14,
};

const tabBtn: React.CSSProperties = {
  background: 'transparent',
  color: '#cbd5e1',
  border: '1px solid #1e293b',
  borderRadius: 4,
  padding: '2px 8px',
  fontSize: 11,
  cursor: 'pointer',
};

const promptBtn: React.CSSProperties = {
  border: 'none',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 11,
  cursor: 'pointer',
  fontWeight: 600,
};

function resolveWorkflow(action: ButtonAction, ws: Workspace): Workflow | null {
  if (action.kind === 'WORKFLOW') return ws.workflows[action.workflowId] ?? null;
  // Wrap a primitive in a one-shot workflow so the executor handles it
  // uniformly.
  const id = `inline_${newId('wf')}`;
  return {
    id,
    name: 'Inline',
    origin: window.location.origin,
    steps: [action.step],
    commitMode: 'SAFE',
    liveEligible: false,
    successCount: 0,
    liveRunCount: 0,
    createdAt: 0,
    lastEditedAt: 0,
  };
}

function liveAvailable(wf: Workflow, ws: Workspace): boolean {
  if (ws.settings.liveDisabled) return false;
  if (!wf.liveEligible) return false;
  return wf.commitMode === 'LIVE';
}

function effectiveCommitMode({
  workflow,
  workspace,
  armingMatched,
}: {
  workflow: Workflow;
  workspace: Workspace;
  armingMatched: boolean;
}): CommitMode {
  if (workflow.commitMode === 'SAFE') return 'SAFE';
  if (workflow.commitMode === 'CONFIRM') return 'CONFIRM';
  // LIVE-declared workflow:
  if (workspace.settings.liveDisabled) return 'CONFIRM';
  if (!workflow.liveEligible) return 'CONFIRM';
  if (!armingMatched) return 'CONFIRM';
  return 'LIVE';
}

function SaveWorkflowModal({
  steps: initialSteps,
  workspace,
  onCancel,
  onSaved,
}: {
  steps: Step[];
  workspace: Workspace;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [steps, setSteps] = useState<Step[]>(initialSteps);
  const [name, setName] = useState('');
  const [commitMode, setCommitMode] = useState<CommitMode>('SAFE');
  const [pageId, setPageId] = useState<string>('__new__');
  const [newPageName, setNewPageName] = useState('Recorded');
  const [buttonLabel, setButtonLabel] = useState('');

  const originKey = `${window.location.protocol}//${window.location.host}`;
  const origin = workspace.origins[originKey];

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...steps];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setSteps(next);
  };
  const remove = (idx: number) => {
    const next = [...steps];
    next.splice(idx, 1);
    setSteps(next);
  };
  const insertWait = (idx: number) => {
    const next = [...steps];
    next.splice(idx, 0, {
      id: newId('step'),
      type: 'WAIT_FOR_DOM',
      condition: 'QUIET',
      timeoutMs: 2000,
      quietMs: 250,
    });
    setSteps(next);
  };

  const hasInjectText = steps.some((s) => s.type === 'INJECT_TEXT');

  const save = async () => {
    if (!name.trim()) {
      alert('Name the workflow first.');
      return;
    }
    if (!buttonLabel.trim()) {
      alert('Give the button a label.');
      return;
    }
    if (!origin) {
      alert(
        `No origin entry for ${originKey}. Open the editor → Settings → Permissions to enable it first.`,
      );
      return;
    }

    const wf: Workflow = {
      id: newId('wf'),
      name: name.trim(),
      origin: originKey,
      steps,
      commitMode,
      liveEligible: false,
      successCount: 0,
      liveRunCount: 0,
      createdAt: Date.now(),
      lastEditedAt: Date.now(),
      hasDraftRisk: hasInjectText,
    };

    const button: DeckButton = {
      id: newId('btn'),
      label: buttonLabel.trim(),
      icon: '🎬',
      color: '#6366f1',
      action: { kind: 'WORKFLOW', workflowId: wf.id },
    };

    let pages = origin.pages;
    if (pageId === '__new__') {
      const np = {
        id: newId('page'),
        name: newPageName.trim() || 'Recorded',
        buttons: [button],
      };
      pages = [...pages, np];
    } else {
      pages = pages.map((p) =>
        p.id === pageId ? { ...p, buttons: [...p.buttons, button] } : p,
      );
    }

    const next: Workspace = {
      ...workspace,
      origins: {
        ...workspace.origins,
        [originKey]: { ...origin, pages },
      },
      workflows: { ...workspace.workflows, [wf.id]: wf },
    };
    await saveWorkspace(next);
    onSaved();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 2147483647,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
      }}
    >
      <div
        style={{
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: 12,
          width: 520,
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 16,
          border: '1px solid #1e293b',
        }}
      >
        <h3 style={{ margin: 0, marginBottom: 8 }}>Save recorded workflow</h3>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 0 }}>
          {steps.length} captured step{steps.length === 1 ? '' : 's'} on{' '}
          <code>{originKey}</code>
          {hasInjectText && (
            <>
              {' '}— this workflow injects text. Drafts may be left in fields if
              the workflow is aborted partway; the executor records prior values
              for one-click rollback.
            </>
          )}
        </p>

        <label style={{ display: 'block', fontSize: 11, marginTop: 8 }}>
          Workflow name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
          placeholder="e.g. UTI safety-net send"
        />

        <label style={{ display: 'block', fontSize: 11, marginTop: 8 }}>
          Commit mode
        </label>
        <select
          value={commitMode}
          onChange={(e) => setCommitMode(e.target.value as CommitMode)}
          style={input}
        >
          <option value="SAFE">SAFE — halt before Submit (recommended)</option>
          <option value="CONFIRM">CONFIRM — pause and prompt before Submit</option>
          <option value="LIVE">LIVE — runs end-to-end (requires arming)</option>
        </select>

        <label style={{ display: 'block', fontSize: 11, marginTop: 8 }}>
          Page
        </label>
        <select
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          style={input}
          disabled={!origin}
        >
          {origin?.pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="__new__">+ New page…</option>
        </select>
        {pageId === '__new__' && (
          <input
            value={newPageName}
            onChange={(e) => setNewPageName(e.target.value)}
            style={input}
            placeholder="New page name"
          />
        )}

        <label style={{ display: 'block', fontSize: 11, marginTop: 8 }}>
          Button label
        </label>
        <input
          value={buttonLabel}
          onChange={(e) => setButtonLabel(e.target.value)}
          style={input}
          placeholder="Short label shown on the button"
        />

        <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>Steps</div>
        <ol style={{ paddingLeft: 0, margin: '6px 0' }}>
          {steps.map((s, i) => (
            <li
              key={s.id}
              style={{
                listStyle: 'none',
                border: '1px solid #1e293b',
                borderRadius: 4,
                padding: 6,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
              }}
            >
              <span style={{ color: '#64748b', width: 18 }}>{i + 1}</span>
              <span style={{ flex: 1, fontFamily: 'ui-monospace, monospace' }}>
                {describeStep(s)}
              </span>
              <button onClick={() => move(i, -1)} style={iconBtn} disabled={i === 0}>
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                style={iconBtn}
                disabled={i === steps.length - 1}
              >
                ↓
              </button>
              <button onClick={() => insertWait(i)} style={iconBtn} title="Insert wait above">
                ⧗
              </button>
              <button onClick={() => remove(i)} style={iconBtn}>
                ×
              </button>
            </li>
          ))}
          {steps.length === 0 && (
            <p style={{ fontSize: 11, color: '#94a3b8' }}>No steps captured.</p>
          )}
        </ol>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onCancel} style={{ ...promptBtn, background: '#1f2937', color: '#e2e8f0' }}>
            Discard
          </button>
          <button
            onClick={save}
            style={{ ...promptBtn, background: '#22c55e', color: '#052e1b' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function describeStep(s: Step): string {
  switch (s.type) {
    case 'NAVIGATE':
      return `NAVIGATE ${s.url}`;
    case 'CLICK':
      return `CLICK ${describeBundle(s.target)}`;
    case 'INJECT_TEXT':
      return `INJECT_TEXT ${describeBundle(s.target)} ← ${
        s.isClinicalSearch
          ? JSON.stringify(s.text)
          : `<${s.text.length} chars redacted>`
      }`;
    case 'WAIT_FOR_DOM':
      return `WAIT_FOR_DOM ${s.condition}${s.target ? ' ' + describeBundle(s.target) : ''} t=${s.timeoutMs}`;
    case 'RUN_WORKFLOW':
      return `RUN_WORKFLOW ${s.workflowId}`;
  }
}

function describeBundle(b: { css?: string; ariaName?: { role?: string; name: string }; text?: string }): string {
  if (b.css) return `css="${b.css}"`;
  if (b.ariaName) return `aria=${b.ariaName.role ?? '*'}[${b.ariaName.name}]`;
  if (b.text) return `text="${b.text}"`;
  return '<empty>';
}

const input: React.CSSProperties = {
  width: '100%',
  background: '#020617',
  color: '#e2e8f0',
  border: '1px solid #1e293b',
  borderRadius: 4,
  padding: '4px 6px',
  fontSize: 12,
  marginTop: 2,
};

import { useEffect, useMemo, useState } from 'react';
import type {
  AuditEntry,
  CommitMode,
  Workflow,
  Workspace,
} from '@/shared/types';
import {
  exportWorkspace,
  importWorkspace,
  loadAuditLog,
  loadWorkspace,
  saveWorkspace,
  updateSettings,
  watchWorkspace,
} from '@/shared/storage';

type Tab = 'pages' | 'workflows' | 'audit' | 'settings';

export function App() {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [tab, setTab] = useState<Tab>('pages');

  useEffect(() => {
    void loadWorkspace().then(setWs);
    return watchWorkspace(setWs);
  }, []);

  if (!ws) return <div className="p-8">Loading…</div>;

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-slate-800 p-4 flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-wider">TRISKA</h1>
        <p className="text-xs text-slate-400 mb-4">
          Stream Deck for clinical web apps.
        </p>
        <NavBtn active={tab === 'pages'} onClick={() => setTab('pages')}>
          Pages
        </NavBtn>
        <NavBtn active={tab === 'workflows'} onClick={() => setTab('workflows')}>
          Workflows
        </NavBtn>
        <NavBtn active={tab === 'audit'} onClick={() => setTab('audit')}>
          Audit log
        </NavBtn>
        <NavBtn active={tab === 'settings'} onClick={() => setTab('settings')}>
          Settings
        </NavBtn>
      </aside>
      <main className="flex-1 p-6">
        {tab === 'pages' && <PagesView ws={ws} />}
        {tab === 'workflows' && <WorkflowsView ws={ws} />}
        {tab === 'audit' && <AuditView />}
        {tab === 'settings' && <SettingsView ws={ws} />}
      </main>
    </div>
  );
}

function NavBtn({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-3 py-2 rounded text-sm ${
        active ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function PagesView({ ws }: { ws: Workspace }) {
  const origins = Object.values(ws.origins);
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Pages</h2>
      {origins.length === 0 && (
        <p className="text-slate-400 text-sm">
          No origins yet. Switch to Settings → Permissions to enable one.
        </p>
      )}
      {origins.map((o) => (
        <section key={o.origin} className="border border-slate-800 rounded p-4">
          <header className="flex items-baseline justify-between">
            <div>
              <h3 className="font-semibold">{o.label}</h3>
              <code className="text-xs text-slate-400">{o.origin}</code>
            </div>
          </header>
          <div className="mt-3 grid gap-3">
            {o.pages.map((p) => (
              <div key={p.id} className="border border-slate-900 rounded p-3">
                <div className="text-sm font-medium mb-2">{p.name}</div>
                <ul className="grid grid-cols-3 gap-2 text-xs">
                  {p.buttons.map((b) => (
                    <li key={b.id} className="border border-slate-800 rounded p-2">
                      <div className="font-semibold">
                        {b.icon} {b.label}
                      </div>
                      <div className="text-slate-400">
                        {b.action.kind === 'WORKFLOW'
                          ? ws.workflows[b.action.workflowId]?.name ?? '?'
                          : b.action.step.type}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function WorkflowsView({ ws }: { ws: Workspace }) {
  const wfs = useMemo(() => Object.values(ws.workflows), [ws]);
  const [filter, setFilter] = useState('');
  const filtered = wfs.filter((w) =>
    w.name.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <div>
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="text-lg font-semibold">Workflows</h2>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-sm"
        />
      </header>
      <table className="w-full text-sm">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="py-2">Name</th>
            <th>Origin</th>
            <th>Mode</th>
            <th>LIVE-eligible</th>
            <th>Runs</th>
            <th>LIVE runs</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((wf) => (
            <WorkflowRow key={wf.id} wf={wf} ws={ws} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WorkflowRow({ wf, ws }: { wf: Workflow; ws: Workspace }) {
  const setMode = async (mode: CommitMode) => {
    const next = { ...ws, workflows: { ...ws.workflows, [wf.id]: { ...wf, commitMode: mode, lastEditedAt: Date.now() } } };
    await saveWorkspace(next);
  };
  const toggleEligible = async () => {
    const willEligible = !wf.liveEligible;
    if (willEligible && wf.successCount < 3) {
      const ok = window.confirm(
        `This workflow has only ${wf.successCount} successful runs in SAFE/CONFIRM.\n` +
          'Marking it LIVE-eligible before three successful runs is discouraged.\n\n' +
          'Continue anyway?',
      );
      if (!ok) return;
    }
    if (willEligible && !ws.settings.liveTutorialCompleted) {
      const ok = window.confirm(
        'Before flagging anything LIVE, please read the LIVE arming model:\n\n' +
          '• Runs end-to-end including the Submit step.\n' +
          '• Per-execution arming required (5-second window, auto-disarm).\n' +
          '• Selector miss aborts immediately. No fuzzy retry.\n' +
          '• Every LIVE run is logged with a red flag.\n\n' +
          'Mark tutorial as read and continue?',
      );
      if (!ok) return;
      await updateSettings({ liveTutorialCompleted: true });
    }
    const next = {
      ...ws,
      workflows: {
        ...ws.workflows,
        [wf.id]: { ...wf, liveEligible: willEligible, lastEditedAt: Date.now() },
      },
    };
    await saveWorkspace(next);
  };
  return (
    <tr className="border-t border-slate-900">
      <td className="py-2">{wf.name}</td>
      <td className="text-slate-400 text-xs">{wf.origin}</td>
      <td>
        <select
          value={wf.commitMode}
          onChange={(e) => setMode(e.target.value as CommitMode)}
          className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5"
        >
          <option value="SAFE">SAFE</option>
          <option value="CONFIRM">CONFIRM</option>
          <option value="LIVE">LIVE</option>
        </select>
      </td>
      <td>
        <input
          type="checkbox"
          checked={wf.liveEligible}
          onChange={toggleEligible}
          disabled={ws.settings.liveDisabled}
        />
      </td>
      <td>{wf.successCount}</td>
      <td className={wf.liveRunCount > 0 ? 'text-red-400 font-semibold' : ''}>
        {wf.liveRunCount}
      </td>
      <td />
    </tr>
  );
}

function AuditView() {
  const [log, setLog] = useState<AuditEntry[]>([]);
  useEffect(() => {
    void loadAuditLog().then((l) => setLog([...l].reverse()));
  }, []);
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Audit log</h2>
      <ul className="space-y-1 text-sm">
        {log.map((e) => (
          <li
            key={e.id}
            className={`border rounded p-2 ${
              e.liveFlag
                ? 'border-red-500 bg-red-950/30'
                : 'border-slate-800'
            }`}
          >
            <div className="flex justify-between">
              <span>
                {e.liveFlag && <span className="text-red-400">⬤ </span>}
                <strong>{e.workflowName}</strong>{' '}
                <span className="text-slate-400 text-xs">({e.mode})</span>
              </span>
              <span className="text-slate-400 text-xs">
                {new Date(e.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="text-xs text-slate-400">
              {e.origin} · {e.outcome}
              {e.failedSelector ? ` · failed: ${e.failedSelector}` : ''}
              {e.patientHint ? ` · ${e.patientHint}` : ''}
            </div>
          </li>
        ))}
        {log.length === 0 && (
          <p className="text-slate-400 text-sm">No entries yet.</p>
        )}
      </ul>
    </div>
  );
}

function SettingsView({ ws }: { ws: Workspace }) {
  const [exportText, setExportText] = useState<string | null>(null);
  const [importText, setImportText] = useState('');

  const setLiveDisabled = async (v: boolean) => {
    await updateSettings({ liveDisabled: v });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-semibold">Settings</h2>

      <section className="border border-slate-800 rounded p-4 space-y-2">
        <h3 className="font-semibold">LIVE kill switch</h3>
        <p className="text-sm text-slate-400">
          Disables LIVE-eligible flagging across the workspace. Use this on
          shared devices.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ws.settings.liveDisabled}
            onChange={(e) => setLiveDisabled(e.target.checked)}
            disabled={ws.settings.liveDisabledLocked}
          />
          LIVE disabled
          {ws.settings.liveDisabledLocked && (
            <span className="text-xs text-slate-500">(locked by admin)</span>
          )}
        </label>
      </section>

      <section className="border border-slate-800 rounded p-4 space-y-2">
        <h3 className="font-semibold">Export / import</h3>
        <p className="text-sm text-slate-400">
          Workspace JSON. May contain free-text injections (e.g. SNOMED queries)
          captured by the recorder. Review before sharing.
        </p>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 bg-slate-800 rounded text-sm"
            onClick={async () => setExportText(await exportWorkspace())}
          >
            Generate export
          </button>
          {exportText && (
            <a
              className="px-3 py-1 bg-sky-700 rounded text-sm"
              download="triska-workspace.json"
              href={`data:application/json,${encodeURIComponent(exportText)}`}
            >
              Download
            </a>
          )}
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Paste workspace JSON here…"
          className="w-full h-28 bg-slate-900 border border-slate-800 rounded p-2 text-xs font-mono"
        />
        <button
          className="px-3 py-1 bg-amber-700 rounded text-sm"
          onClick={async () => {
            if (!window.confirm('This replaces your workspace. Continue?')) return;
            try {
              await importWorkspace(importText);
              setImportText('');
              alert('Imported.');
            } catch (e) {
              alert(`Import failed: ${(e as Error).message}`);
            }
          }}
        >
          Import (replace)
        </button>
      </section>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Trash2,
  FolderOpen,
  ShieldCheck,
  Layers,
  SearchCheck,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import type { Analysis, HistoryPage } from '@/lib/types';
import { Upload, WakeMessage } from './Upload';
import { RiskBadge } from './RiskBadge';
import { Skeleton } from './Skeleton';
export function Dashboard() {
  const { api, waking } = useApi();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [target, setTarget] = useState<Analysis | null>(null);
  const reload = useCallback(() => setRefresh((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    async function load() {
      try {
        const result = await api.list(page, controller.signal);
        if (controller.signal.aborted) return;
        setData(result);
        setError('');
        setLoading(false);
        if (result.analyses.some((a) => ['pending', 'processing'].includes(a.status)))
          timer = setTimeout(load, 2000);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Could not load your analyses.');
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [api, page, refresh]);
  async function remove() {
    if (!target) return;
    setDeleting(true);
    try {
      await api.remove(target.id);
      setTarget(null);
      if (data?.analyses.length === 1 && page > 1) setPage((p) => p - 1);
      else reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the analysis.');
      setTarget(null);
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A BETTER READ ON YOUR CONTRACTS</span>
          <h1>Your review starts here.</h1>
          <p>Spot the risks. Understand the details. Sign with more confidence.</p>
        </div>
        <span className="outline-label">
          <ShieldCheck size={15} />
          Private by default
        </span>
      </div>
      <div className="dashboard-grid">
        <Upload
          waking={waking}
          onUpload={async (file, onProgress, signal) => {
            const result = await api.upload(file, onProgress, signal);
            router.push(`/analyses/${result.id}`);
          }}
        />
        <aside className="review-guide">
          <span className="eyebrow">FROM FINE PRINT TO CLARITY</span>
          <h2>
            A second look.
            <br />A better perspective.
          </h2>
          <p>Turn a dense contract into a review you can actually use.</p>
          <div className="guide-item">
            <span>
              <Layers size={20} />
            </span>
            <div>
              <h3>Every clause, considered</h3>
              <p>Organized across eight key areas of contract risk.</p>
            </div>
          </div>
          <div className="guide-item">
            <span>
              <SearchCheck size={20} />
            </span>
            <div>
              <h3>Context behind each flag</h3>
              <p>Compare language with 128 curated reference clauses.</p>
            </div>
          </div>
          <div className="guide-item">
            <span>
              <ShieldCheck size={20} />
            </span>
            <div>
              <h3>A practical path forward</h3>
              <p>Clear explanations and suggestions for safer wording.</p>
            </div>
          </div>
          <div className="guide-disclaimer">
            A helpful starting point for review. For legal decisions, consult a qualified
            professional.
          </div>
        </aside>
      </div>
      <section id="history" className="history-panel">
        <div className="panel-title">
          <div>
            <h2>
              Analysis history <span className="count-pill">{data?.total ?? '—'}</span>
            </h2>
            <p>Your contracts, with the context that matters.</p>
          </div>
          <button className="icon-button" aria-label="Refresh history" onClick={reload}>
            <RefreshCw size={17} />
          </button>
        </div>
        {error && (
          <p role="alert" className="error-message">
            {error}{' '}
            <button className="text-link" onClick={reload}>
              Try again
            </button>
          </p>
        )}
        {waking && !loading && <WakeMessage />}
        {loading && !data ? (
          <Skeleton />
        ) : data?.analyses.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>CONTRACT</th>
                    <th>DATE ADDED</th>
                    <th>OVERALL RISK</th>
                    <th>STATUS</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.analyses.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link className="file-link" href={`/analyses/${a.id}`}>
                          <span className="file-icon">
                            <FileText size={19} />
                          </span>
                          <div>
                            <strong>{a.file_name}</strong>
                            <span className="micro muted">
                              {a.file_type.toUpperCase()} document
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td>
                        {new Date(a.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        {a.overall_risk ? (
                          <RiskBadge risk={a.overall_risk} />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-label ${a.status}`}>
                          {a.status === 'completed'
                            ? 'Completed'
                            : a.status === 'failed'
                              ? 'Failed'
                              : a.status === 'pending'
                                ? 'Queued'
                                : 'Processing'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          disabled={['pending', 'processing'].includes(a.status)}
                          onClick={() => setTarget(a)}
                          aria-label={`Delete ${a.file_name}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Showing {(page - 1) * 10 + 1}–{Math.min(page * 10, data.total)} of {data.total}{' '}
                contracts
              </span>
              <div>
                <button
                  className="icon-button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>
                <span>{page}</span>
                <button
                  className="icon-button"
                  disabled={page * 10 >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        ) : !error ? (
          <div className="empty-state">
            <span className="empty-icon">
              <FolderOpen size={26} />
            </span>
            <h3>A fresh start for your contracts</h3>
            <p>Your analyses will appear here. Upload your first contract above.</p>
          </div>
        ) : null}
      </section>
      {target && (
        <DeleteDialog
          fileName={target.file_name}
          busy={deleting}
          onCancel={() => setTarget(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}
function DeleteDialog({
  fileName,
  busy,
  onCancel,
  onConfirm,
}: {
  fileName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = document.getElementById('delete-dialog');
    const buttons = dialog?.querySelectorAll<HTMLButtonElement>('button');
    buttons?.[0]?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
      if (e.key === 'Tab' && buttons?.length) {
        if (e.shiftKey && document.activeElement === buttons[0]) {
          e.preventDefault();
          buttons[buttons.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
          e.preventDefault();
          buttons[0].focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [onCancel, busy]);
  return (
    <div className="modal-backdrop">
      <div
        id="delete-dialog"
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
      >
        <Trash2 size={24} />
        <h2 id="delete-title">Delete this analysis?</h2>
        <p id="delete-description">
          The report for <strong>{fileName}</strong> and all its clauses will be permanently
          deleted.
        </p>
        <div className="modal-actions">
          <button className="button secondary" disabled={busy} onClick={onCancel}>
            Keep analysis
          </button>
          <button className="button danger" disabled={busy} onClick={onConfirm}>
            {busy ? 'Deleting…' : 'Delete analysis'}
          </button>
        </div>
      </div>
    </div>
  );
}

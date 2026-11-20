'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  CheckCircle2,
  LoaderCircle,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  ChevronLeft,
  SlidersHorizontal,
} from 'lucide-react';
import { useAnalysis } from '@/hooks/useAnalysis';
import { categories, type Risk } from '@/lib/types';
import { RiskBadge } from './RiskBadge';
import { WakeMessage } from './Upload';
import { Skeleton } from './Skeleton';
export function AnalysisDetail({ id }: { id: string }) {
  const { analysis, error, notice, waking, retry } = useAnalysis(id);
  const [risk, setRisk] = useState('all');
  const [category, setCategory] = useState('all');
  if (error)
    return (
      <div className="state-panel">
        <AlertTriangle size={32} />
        <h1>We couldn’t load this report.</h1>
        <p role="alert">{error}</p>
        <button className="button" onClick={retry}>
          Try again
        </button>
        <Link className="text-link" href="/dashboard">
          Back to workspace
        </Link>
      </div>
    );
  if (!analysis)
    return (
      <>
        {waking && <WakeMessage />}
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
        <Skeleton />
      </>
    );
  const clauses = (analysis.clauses || []).filter(
    (c) =>
      (risk === 'all' || c.risk_level === risk) && (category === 'all' || c.category === category),
  );
  const running = ['pending', 'processing'].includes(analysis.status);
  return (
    <>
      <Link className="back-link" href="/dashboard">
        <ChevronLeft size={16} />
        All analyses
      </Link>
      <div className="page-heading report-heading">
        <div>
          <span className="eyebrow">CONTRACT RISK REPORT</span>
          <h1>{analysis.file_name}</h1>
          <p>
            <FileText size={15} />
            {analysis.file_type.toUpperCase()} document<span>·</span>
            {new Date(analysis.created_at).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        {analysis.overall_risk && <RiskBadge risk={analysis.overall_risk} />}
      </div>
      {waking && <WakeMessage />}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {running ? (
        <section className="processing-panel" aria-live="polite">
          <span className="upload-icon">
            <LoaderCircle className="spin" size={30} />
          </span>
          <h2>
            {analysis.status === 'pending'
              ? 'Your contract is in the queue.'
              : 'Giving the fine print a closer look.'}
          </h2>
          <p>
            We’ll update this page as soon as your report is ready. Longer contracts can take a few
            minutes.
          </p>
          <ol className="stepper">
            <li className="done">
              <CheckCircle2 size={19} />
              Contract received
            </li>
            <li className={analysis.status === 'processing' ? 'current' : ''}>
              <span className="step-dot" />
              Reviewing clauses
            </li>
            <li>
              <span className="step-dot" />
              Report ready
            </li>
          </ol>
          <p className="muted micro">
            You can leave this page and find your report in analysis history.
          </p>
        </section>
      ) : analysis.status === 'failed' ? (
        <section className="state-panel">
          <AlertTriangle size={30} />
          <h2>This analysis couldn’t finish.</h2>
          <p role="alert">{analysis.error_message}</p>
          <Link className="button" href="/dashboard">
            Upload another contract
          </Link>
        </section>
      ) : (
        <>
          <section className="report-summary" aria-label="Report summary">
            <div className="summary-intro">
              <span className="tiny-icon">
                <BookOpen size={22} />
              </span>
              <div>
                <h2>The details, at a glance.</h2>
                <p>{analysis.summary?.total} clauses reviewed across your contract</p>
              </div>
            </div>
            <div className="risk-counts">
              {(['safe', 'caution', 'risky'] as Risk[]).map((level) => (
                <button
                  key={level}
                  className={`risk-count ${level} ${risk === level ? 'selected' : ''}`}
                  aria-pressed={risk === level}
                  onClick={() => setRisk(risk === level ? 'all' : level)}
                >
                  <strong>{analysis.summary?.[level] ?? 0}</strong>
                  <RiskBadge risk={level} />
                </button>
              ))}
            </div>
          </section>
          {!!analysis.summary?.inconclusive && (
            <p className="notice">
              <AlertTriangle size={18} />
              {analysis.summary.inconclusive} clauses had insufficient reference similarity and are
              flagged for review. Similarity measures wording, not legal certainty.
            </p>
          )}
          {analysis.summary?.segmentation_fallback && (
            <p className="notice">
              Section-based segmentation was used. Check that clause boundaries and categories match
              the original document.
            </p>
          )}
          <div className="clause-toolbar">
            <h2>
              Clause-by-clause review <span className="count-pill">{clauses.length}</span>
            </h2>
            <div>
              <SlidersHorizontal size={17} />
              <label className="sr-only" htmlFor="risk-filter">
                Filter by risk
              </label>
              <select id="risk-filter" value={risk} onChange={(e) => setRisk(e.target.value)}>
                <option value="all">All risk levels</option>
                <option value="safe">Safe</option>
                <option value="caution">Caution</option>
                <option value="risky">Risky</option>
              </select>
              <label className="sr-only" htmlFor="category-filter">
                Filter by category
              </label>
              <select
                id="category-filter"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">All categories</option>
                {[...categories, 'Other'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="clause-list">
            {clauses.map((c) => (
              <article key={c.id} className={`clause-card border-${c.risk_level}`}>
                <header>
                  <div>
                    <span className="clause-position">CLAUSE {c.position + 1}</span>
                    <h3>{c.category}</h3>
                  </div>
                  <RiskBadge risk={c.risk_level} />
                </header>
                <p className="clause-text">{c.text}</p>
                <div className="clause-meta">
                  <span>
                    {c.similarity_score === null
                      ? 'No reference match'
                      : `${Math.round(c.similarity_score * 100)}% reference similarity`}
                  </span>
                  {c.matched_baseline_id && <span>Reference #{c.matched_baseline_id}</span>}
                  {c.semantic_signal === 'inconclusive' && <span>Inconclusive match</span>}
                </div>
                {c.rule_flags.length > 0 && (
                  <div className="flag-list">
                    {c.rule_flags.map((flag, i) => (
                      <span key={`${flag.name}-${i}`} className="flag-chip">
                        <AlertTriangle size={12} />
                        {flag.name} · {flag.severity}
                      </span>
                    ))}
                  </div>
                )}
                {c.explanation && (
                  <div className="explanation">
                    <h4>
                      <Lightbulb size={17} />
                      Why it deserves a closer look
                    </h4>
                    <p>{c.explanation}</p>
                    {c.suggested_rewording && (
                      <div className="rewording">
                        <h4>Suggested wording</h4>
                        <p>{c.suggested_rewording}</p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
            {clauses.length === 0 && (
              <div className="empty-state">
                <h3>No clauses match these filters.</h3>
                <button
                  className="text-link"
                  onClick={() => {
                    setRisk('all');
                    setCategory('all');
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          <p className="report-disclaimer">
            <ShieldDisclaimer />
            ClauseGuard provides informational analysis, not legal advice. Suggested wording may
            need adjustment for your agreement and jurisdiction. Consult a qualified legal
            professional before relying on this report.
          </p>
        </>
      )}
    </>
  );
}
function ShieldDisclaimer() {
  return <BookOpen size={18} aria-hidden="true" />;
}

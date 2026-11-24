import type { AnalysisProgress as Progress } from '@/lib/types';

const stages = {
  extracting: 'Reading your document…',
  segmenting: 'Identifying contract clauses…',
  embedding: 'Preparing clauses for review…',
  reviewing: 'Reviewing risks and preparing suggested wording…',
  saving: 'Saving your completed report…',
};

export function AnalysisProgress({ progress }: { progress?: Progress | null }) {
  if (!progress) return null;
  const total = progress.total;
  const completed = Math.max(0, Math.min(progress.completed, total ?? 0));
  return (
    <div className="analysis-progress" role="status">
      <p>{stages[progress.stage]}</p>
      {total !== null && total > 0 && (
        <>
          <strong>{completed} of {total} clauses reviewed</strong>
          <progress aria-label="Clauses reviewed" value={completed} max={total} />
          <span className="muted micro">
            {progress.stage === 'saving'
              ? 'All clauses reviewed. Your report will open shortly.'
              : 'Each completed clause includes its risk assessment and any suggested wording.'}
          </span>
        </>
      )}
    </div>
  );
}

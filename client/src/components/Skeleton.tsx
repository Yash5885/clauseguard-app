export function Skeleton() {
  return (
    <div className="skeleton" role="status" aria-label="Loading">
      <div />
      <div />
      <div />
      <span className="sr-only">Loading your workspace…</span>
    </div>
  );
}

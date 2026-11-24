import { render, screen } from '@testing-library/react';
import { AnalysisProgress } from './AnalysisProgress';

test('shows the current stage without inventing a total before segmentation', () => {
  render(<AnalysisProgress progress={{ stage: 'segmenting', completed: 0, total: null }} />);
  expect(screen.getByRole('status')).toHaveTextContent('Identifying contract clauses');
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});

test('updates the real clause counter and distinguishes saving from completion', () => {
  const { rerender } = render(<AnalysisProgress progress={{ stage: 'reviewing', completed: 3, total: 12 }} />);
  expect(screen.getByText('3 of 12 clauses reviewed')).toBeInTheDocument();
  expect(screen.getByRole('progressbar')).toHaveAttribute('value', '3');
  expect(screen.getByRole('progressbar')).toHaveAttribute('max', '12');
  rerender(<AnalysisProgress progress={{ stage: 'saving', completed: 12, total: 12 }} />);
  expect(screen.getByText('12 of 12 clauses reviewed')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Saving your completed report');
});

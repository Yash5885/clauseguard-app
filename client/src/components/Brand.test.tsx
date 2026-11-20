import { render, screen } from '@testing-library/react';
import { Brand } from './Brand';
test('links to the product home', () => {
  render(<Brand />);
  expect(screen.getByRole('link', { name: 'ClauseGuard home' })).toHaveAttribute('href', '/');
});

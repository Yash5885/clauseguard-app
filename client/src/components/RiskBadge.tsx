import { CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { Risk } from '@/lib/types';
const icons = { safe: CheckCircle2, caution: AlertTriangle, risky: ShieldAlert };
export function RiskBadge({ risk }: { risk: Risk }) {
  const Icon = icons[risk];
  return (
    <span className={`badge ${risk}`} aria-label={`Risk level: ${risk}`}>
      <Icon size={14} aria-hidden="true" />
      {risk === 'safe' ? 'Safe' : risk === 'caution' ? 'Caution' : 'Risky'}
    </span>
  );
}

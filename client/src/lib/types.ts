export type Risk = 'safe' | 'caution' | 'risky';
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface RuleFlag {
  name: string;
  severity: 'medium' | 'high';
}
export interface Clause {
  id: string;
  position: number;
  category: string;
  text: string;
  risk_level: Risk;
  similarity_score: number | null;
  matched_baseline_id: string | null;
  rule_flags: RuleFlag[];
  semantic_signal: Risk | 'inconclusive';
  explanation: string | null;
  suggested_rewording: string | null;
}
export interface Analysis {
  id: string;
  file_name: string;
  file_type: 'pdf' | 'docx';
  status: AnalysisStatus;
  error_message: string | null;
  overall_risk: Risk | null;
  summary: {
    safe: number;
    caution: number;
    risky: number;
    total: number;
    inconclusive: number;
    segmentation_fallback: boolean;
  } | null;
  created_at: string;
  completed_at: string | null;
  clauses?: Clause[];
}
export interface HistoryPage {
  analyses: Analysis[];
  page: number;
  limit: number;
  total: number;
}
export const categories = [
  'Payment Terms',
  'IP Rights',
  'Liability',
  'Termination',
  'Confidentiality',
  'Indemnification',
  'Governing Law & Dispute Resolution',
  'Non-Compete & Non-Solicitation',
];

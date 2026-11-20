const { scoreRisk } = require('../src/services/riskScorer');
const { runRules } = require('../src/services/ruleEngine');
const rules = require('../src/config/rules.json');
const match = (risk_level, similarity = 0.8, id = '1') => ({ id, risk_level, similarity });
const high = { name: 'high', severity: 'high' };
const medium = { name: 'medium', severity: 'medium' };
test.each([
  [[match('safe')], [], 'safe', 'safe'],
  [[match('caution')], [], 'caution', 'caution'],
  [[match('risky')], [], 'risky', 'risky'],
  [[match('safe', 0.59)], [], 'caution', 'inconclusive'],
  [[], [], 'caution', 'inconclusive'],
  [[match('safe', 0.6)], [], 'safe', 'safe'],
  [[match('safe')], [high], 'caution', 'safe'],
  [[match('safe')], [high, high], 'risky', 'safe'],
  [[match('risky')], [medium], 'risky', 'risky'],
  [[match('safe')], [medium], 'caution', 'safe'],
  [[match('safe', -0.5)], [high, high], 'risky', 'inconclusive'],
  [[match('safe', 0.8), match('risky', 0.8)], [], 'risky', 'risky'],
  [[match('risky', 0.9), match('safe', 0.8), match('safe', 0.8)], [], 'safe', 'safe'],
])('scores vote and escalation branches', (matches, flags, risk, signal) => {
  expect(scoreRisk(matches, flags)).toMatchObject({ risk_level: risk, semantic_signal: signal });
});
test('respects thresholds and top-k without mutating input', () => {
  const input = [match('risky', 0.7), match('safe', 0.9)];
  expect(scoreRisk(input, [], { topK: 1 }).risk_level).toBe('safe');
  expect(input[0].risk_level).toBe('risky');
  expect(scoreRisk([match('safe', 0.8)], [], { unknownThreshold: 0.9 }).semantic_signal).toBe(
    'inconclusive',
  );
  expect(scoreRisk([], []).similarity_score).toBeNull();
  expect(scoreRisk([match('safe')], []).matched_baseline_id).toBe('1');
});
const cases = [
  ['Supplier has unlimited liability.', 'Liability is capped at annual fees.'],
  [
    'Customer may terminate at its sole discretion.',
    'Either party may terminate for material breach.',
  ],
  ['The agreement automatically renews without notice.', 'Renewal requires written consent.'],
  ['Invoices are payable within 90 days.', 'Invoices are payable within 60 days.'],
  ['Payment is pay-when-paid.', 'Payment is due on receipt.'],
  [
    'All information is confidential in perpetuity.',
    'Trade secrets remain confidential in perpetuity; public information is excluded.',
  ],
  [
    'Contractor assigns all present and future intellectual property.',
    'Only project deliverables are assigned.',
  ],
  [
    'Contractor shall not work for a competitor for two years.',
    'A non-compete lasts six months within the county.',
  ],
  [
    'Contractor shall not engage in competing activity for six months.',
    'Contractor shall not engage in competing activity within the county for six months.',
  ],
  [
    'Supplier shall indemnify Customer for Customer sole negligence.',
    'Each party indemnifies claims caused by its own negligence.',
  ],
  [
    'Supplier alone shall indemnify Customer for all claims.',
    'Each party shall indemnify the other for its own misconduct.',
  ],
  [
    'Customer may modify all terms without notice.',
    'Customer may not modify terms without consent.',
  ],
  ['Supplier waives trial by jury.', 'Neither party waives trial by jury.'],
  [
    'Customer may choose any foreign jurisdiction as venue.',
    'The parties agree to remote neutral arbitration.',
  ],
];
test.each(rules.map((rule, i) => [rule, cases[i]]))(
  'rule: $name has positive and negative coverage',
  (rule, [positive, negative]) => {
    const category = rule.category === '*' ? 'Termination' : rule.category;
    expect(runRules(category, positive, [rule])).toHaveLength(1);
    expect(runRules(category, negative, [rule])).toHaveLength(0);
    if (rule.category !== '*') expect(runRules('Other', positive, [rule])).toHaveLength(0);
  },
);

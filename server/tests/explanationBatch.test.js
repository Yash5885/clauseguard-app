const { createExplanationService } = require('../src/services/explanationService');
const { AppError } = require('../src/utils/errors');
const inputs = [0, 1].map((n) => ({ clause: `Clause ${n}`, matches: [{ id: `baseline-${n}`, text: `Reference ${n}` }], score: { risk_level: 'risky', rule_flags: [], semantic_signal: 'risky' } }));
const item = (clause_id) => ({ clause_id, explanation: `Explanation for clause ${clause_id} with enough detail.`, suggested_rewording: `Balanced wording ${clause_id}.` });
test('generates one batch, grounds each clause separately, and restores IDs to input order', async () => {
  const generate = jest.fn().mockResolvedValue({ text: JSON.stringify({ items: [item(1), item(0)] }) });
  const result = await createExplanationService({ generate }).batch(inputs);
  expect(generate).toHaveBeenCalledTimes(1);
  expect(generate.mock.calls[0][0]).toContain('baseline-0');
  expect(generate.mock.calls[0][0]).toContain('baseline-1');
  expect(result[0].explanation).toContain('clause 0');
  expect(result[1].suggested_rewording).toBe('Balanced wording 1.');
  expect(result.every((r) => /not legal advice/i.test(r.explanation))).toBe(true);
});
test.each([
  [item(0)],
  [item(0), item(0)],
  [item(0), item(3)],
])('rejects missing, duplicate or unknown clause IDs instead of attaching the wrong explanation', async (...items) => {
  const generate = jest.fn().mockResolvedValue({ text: JSON.stringify({ items }) });
  await expect(createExplanationService({ generate }).batch(inputs)).rejects.toThrow();
  expect(generate).toHaveBeenCalledTimes(2);
});
test('does not retry an exhausted quota or fall back to individual generation', async () => {
  const error = new AppError(503, 'GEMINI_DAILY_LIMIT', 'Daily quota exhausted');
  const generate = jest.fn().mockRejectedValue(error);
  await expect(createExplanationService({ generate }).batch(inputs)).rejects.toBe(error);
  expect(generate).toHaveBeenCalledTimes(1);
});

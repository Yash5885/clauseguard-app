const fs = require('node:fs');
const path = require('node:path');
const { extractText } = require('../src/services/textExtractor');
const { validateFile } = require('../src/services/fileValidator');
const { runRules } = require('../src/services/ruleEngine');
test.each(['nda', 'freelance-agreement', 'one-sided-service-agreement'])(
  'demo %s PDF is valid and fully extractable',
  async (name) => {
    const buffer = fs.readFileSync(path.join(__dirname, '../../samples', `${name}.pdf`));
    expect(await validateFile({ buffer, originalname: `${name}.pdf` })).toBe('pdf');
    const text = await extractText(buffer, 'pdf');
    expect(text).toContain('Signed');
    expect(text.length).toBeGreaterThan(2000);
  },
);
test('perpetual confidentiality without exception is flagged', () => {
  expect(
    runRules(
      'Confidentiality',
      'All information remains confidential in perpetuity without exception.',
    ),
  ).toContainEqual({ name: 'Perpetual confidentiality without exceptions', severity: 'high' });
});

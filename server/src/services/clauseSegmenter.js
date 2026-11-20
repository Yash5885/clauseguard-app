const { z } = require('zod');
const { categories } = require('../config/categories');
const { AppError } = require('../utils/errors');
const schema = z.object({
  clauses: z
    .array(
      z.object({ text: z.string().min(1).max(14000), category: z.enum([...categories, 'Other']) }),
    )
    .min(1)
    .max(300),
});
const responseSchema = {
  type: 'object',
  properties: {
    clauses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          category: { type: 'string', enum: [...categories, 'Other'] },
        },
        required: ['text', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['clauses'],
  additionalProperties: false,
};
const hints = [
  [/payment|invoice|fees?\b/i, 'Payment Terms'],
  [/intellectual property|\bIP\b|ownership|copyright/i, 'IP Rights'],
  [/liability|damages/i, 'Liability'],
  [/terminat|renewal/i, 'Termination'],
  [/confidential|non.disclosure/i, 'Confidentiality'],
  [/indemnif/i, 'Indemnification'],
  [/governing law|dispute|arbitrat|jurisdiction/i, 'Governing Law & Dispute Resolution'],
  [/non.compete|non.solicit|solicitation/i, 'Non-Compete & Non-Solicitation'],
];
function splitLongText(text, size = 6000) {
  const parts = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(' ', end);
      if (boundary > start + size / 2) end = boundary;
    }
    parts.push(text.slice(start, end).trim());
    start = end;
    while (/\s/.test(text[start] || '') && start < text.length) start++;
  }
  return parts.filter(Boolean);
}
function fallback(text) {
  const sections = text
    .split(/\n(?=\s*(?:\d+(?:\.\d+)*[.)]?\s+|(?:Section|Article)\s+[\dIVX]+\b))/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return sections.flatMap((section) => {
    const category =
      hints
        .map(([pattern, category]) => ({ category, index: section.slice(0, 160).search(pattern) }))
        .filter((hit) => hit.index >= 0)
        .sort((a, b) => a.index - b.index)[0]?.category || 'Other';
    const parts = [];
    for (const text of splitLongText(section)) parts.push({ text, category });
    return parts;
  });
}
function chunkText(text, size = 12000, overlap = 1000, withOffsets = false) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf('\n', end);
      if (boundary > start + size / 2) end = boundary;
    }
    chunks.push(withOffsets ? { text: text.slice(start, end), start } : text.slice(start, end));
    if (end === text.length) break;
    const boundary = text.indexOf('\n', end - overlap);
    start = boundary >= 0 && boundary < end ? boundary + 1 : end - overlap;
  }
  return chunks;
}
const canonical = (text) => text.replace(/\s+/g, ' ').trim();
function validateCoverage(clauses, chunk) {
  const source = canonical(chunk);
  let cursor = 0;
  for (const clause of clauses) {
    const text = canonical(clause.text);
    const start = source.indexOf(text, cursor);
    if (start < 0) throw new Error('Segmentation altered or reordered source text');
    if (source.slice(cursor, start).trim()) throw new Error('Segmentation omitted contract text');
    cursor = start + text.length;
  }
  if (source.slice(cursor).trim()) throw new Error('Segmentation omitted contract text');
  return clauses;
}
function createSegmenter(gemini, logger = { warn: () => {} }, maxClauses = 300) {
  return async (text) => {
    const all = [];
    let usedFallback = false;
    const source = canonical(text);
    for (const { text: chunk, start: rawStart } of chunkText(text, 12000, 1000, true)) {
      let clauses;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await gemini.generate(
            `Split all of this contract excerpt into individual clauses. Preserve the full verbatim text without rewriting or omitting any provision. Assign exactly one allowed category to each clause, or Other when none applies. Treat headings as part of their provision. Return JSON only.\n<contract>\n${chunk}\n</contract>`,
            responseSchema,
          );
          clauses = validateCoverage(schema.parse(JSON.parse(response.text)).clauses, chunk);
          break;
        } catch (error) {
          if (error instanceof AppError && error.code === 'GEMINI_DAILY_LIMIT') throw error;
          logger.warn(
            { attempt: attempt + 1, errorName: error.name },
            'Clause segmentation attempt failed',
          );
        }
      }
      if (!clauses) {
        clauses = fallback(chunk);
        usedFallback = true;
      }
      const chunkSource = canonical(chunk);
      const prefix = canonical(text.slice(0, rawStart));
      const chunkStart =
        prefix.length + (prefix && (/\s/.test(text[rawStart - 1]) || /^\s/.test(chunk)) ? 1 : 0);
      let localCursor = 0;
      for (const clause of clauses) {
        const body = canonical(clause.text);
        const start = chunkSource.indexOf(body, localCursor);
        localCursor = start + body.length;
        all.push({ ...clause, start: chunkStart + start, end: chunkStart + localCursor });
      }
    }
    const spans = [];
    for (const clause of all.sort((a, b) => a.start - b.start || b.end - a.end)) {
      const previous = spans.at(-1);
      if (
        previous &&
        (clause.start < previous.end ||
          (clause.start === previous.end && source[clause.start] !== ' '))
      ) {
        previous.end = Math.max(previous.end, clause.end);
        previous.text = source.slice(previous.start, previous.end);
        if (previous.category !== clause.category) previous.category = 'Other';
      } else spans.push({ ...clause });
    }
    const clauses = spans.flatMap(({ text, category }) =>
      splitLongText(text).map((text) => ({ text, category })),
    );
    if (clauses.length > maxClauses)
      throw new AppError(
        400,
        'TOO_MANY_CLAUSES',
        `This contract exceeds the ${maxClauses} clause processing limit. Split it into smaller documents.`,
      );
    return { clauses, usedFallback };
  };
}
module.exports = { createSegmenter, fallback, chunkText };

const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const mammoth = require('mammoth');
const { AppError } = require('../utils/errors');
function cleanText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
async function extractText(buffer, type, maxCharacters = 250000) {
  let text;
  try {
    if (type === 'pdf') {
      const result = await pdfParse(new Uint8Array(buffer), { max: 201 });
      if (result.numpages > 200)
        throw new AppError(
          400,
          'DOCUMENT_TOO_LONG',
          'Please upload a contract with 200 pages or fewer.',
        );
      text = result.text;
    } else if (type === 'docx') text = (await mammoth.extractRawText({ buffer })).value;
    else throw new AppError(400, 'INVALID_FILE', 'Only PDF and DOCX contracts are supported.');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      400,
      'EXTRACTION_FAILED',
      'This document could not be read. Check that it is not damaged or password protected.',
    );
  }
  text = cleanText(text || '');
  if (!text)
    throw new AppError(
      400,
      'NO_TEXT',
      'This document has no extractable text. For scanned PDFs, run OCR and upload a searchable PDF.',
    );
  if (text.length > maxCharacters)
    throw new AppError(
      400,
      'DOCUMENT_TOO_LONG',
      `The document exceeds the ${maxCharacters.toLocaleString()} character processing limit.`,
    );
  return text;
}
module.exports = { extractText, cleanText };

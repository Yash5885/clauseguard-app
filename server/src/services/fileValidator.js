const path = require('node:path');
const yauzl = require('yauzl');
const { AppError } = require('../utils/errors');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const invalid = (message) => new AppError(400, 'INVALID_FILE', message);
function validateDocx(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(invalid('This DOCX is not a valid document archive.'));
      let found = false,
        total = 0,
        count = 0,
        settled = false;
      const fail = (message) => {
        if (settled) return;
        settled = true;
        zip.close();
        reject(invalid(message));
      };
      zip.on('error', () => fail('This DOCX archive is damaged.'));
      zip.on('entry', (entry) => {
        total += entry.uncompressedSize;
        count++;
        if (total > 30 * 1024 * 1024 || count > 2000 || entry.generalPurposeBitFlag & 1)
          return fail('This DOCX is encrypted or expands beyond the processing limit.');
        if (entry.fileName === 'word/document.xml' && entry.uncompressedSize > 0) found = true;
        zip.readEntry();
      });
      zip.on('end', () => {
        if (settled) return;
        settled = true;
        found
          ? resolve()
          : reject(invalid('This ZIP does not contain a DOCX document (word/document.xml).'));
      });
      zip.readEntry();
    });
  });
}
async function validateFile(file) {
  if (!file?.buffer?.length) throw invalid('Choose a PDF or DOCX contract to upload.');
  if (file.buffer.length > MAX_FILE_SIZE)
    throw new AppError(400, 'FILE_TOO_LARGE', 'Files must be 10 MB or smaller.');
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!['.pdf', '.docx'].includes(extension))
    throw invalid('Only PDF and DOCX contracts are supported.');
  if (extension === '.pdf') {
    if (file.buffer.subarray(0, 4).toString('ascii') !== '%PDF')
      throw invalid('The file contents do not match a PDF document.');
    return 'pdf';
  }
  if (!file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
    throw invalid('The file contents do not match a DOCX document.');
  await validateDocx(file.buffer);
  return 'docx';
}
module.exports = { validateFile, MAX_FILE_SIZE };

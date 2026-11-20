const path = require('node:path');
const yauzl = require('yauzl');
const { AppError } = require('../utils/errors');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const invalid = (message) => new AppError(400, 'INVALID_FILE', message);
function validateDocx(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, zip) => {
        if (error) return reject(invalid('This DOCX is not a valid document archive.'));
        let found = false,
          total = 0,
          actualTotal = 0,
          count = 0,
          settled = false;
        let activeStream;
        const filenames = new Set();
        const fail = (message) => {
          if (settled) return;
          settled = true;
          activeStream?.destroy();
          zip.close();
          reject(invalid(message));
        };
        zip.on('error', () => fail('This DOCX archive is damaged.'));
        zip.on('entry', (entry) => {
          total += entry.uncompressedSize;
          count++;
          if (total > 30 * 1024 * 1024 || count > 2000 || entry.generalPurposeBitFlag & 1)
            return fail('This DOCX is encrypted or expands beyond the processing limit.');
          if (path.posix.normalize(entry.fileName) !== entry.fileName)
            return fail('This DOCX contains ambiguous archive paths.');
          if (filenames.has(entry.fileName))
            return fail('This DOCX contains duplicate archive entries.');
          filenames.add(entry.fileName);
          if (((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000)
            return fail('This DOCX contains unsupported symbolic links.');
          zip.openReadStream(entry, (streamError, stream) => {
            if (settled) {
              stream?.destroy();
              return;
            }
            if (streamError) return fail('This DOCX archive is damaged.');
            activeStream = stream;
            let entryBytes = 0;
            stream.on('error', () =>
              fail('This DOCX has damaged entries or incorrect declared sizes.'),
            );
            stream.on('data', (chunk) => {
              entryBytes += chunk.length;
              actualTotal += chunk.length;
              if (actualTotal > 30 * 1024 * 1024)
                fail('This DOCX expands beyond the processing limit.');
            });
            stream.on('end', () => {
              if (settled) return;
              activeStream = null;
              if (entry.fileName === 'word/document.xml' && entryBytes > 0) found = true;
              zip.readEntry();
            });
          });
        });
        zip.on('end', () => {
          if (settled) return;
          settled = true;
          found
            ? resolve()
            : reject(invalid('This ZIP does not contain a DOCX document (word/document.xml).'));
        });
        zip.readEntry();
      },
    );
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

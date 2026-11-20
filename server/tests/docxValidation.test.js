const fs = require('node:fs');
const path = require('node:path');
const { deflateRawSync } = require('node:zlib');
const { validateFile } = require('../src/services/fileValidator');

const valid = () => fs.readFileSync(path.join(__dirname, 'fixtures/contract.docx'));
const upload = (buffer) => validateFile({ buffer, originalname: 'contract.docx' });

function centralDirectory(buffer, name) {
  for (let offset = 0; offset < buffer.length - 46; offset++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    const length = buffer.readUInt16LE(offset + 28);
    if (buffer.toString('utf8', offset + 46, offset + 46 + length) === name) return offset;
  }
  throw new Error(`Archive entry not found: ${name}`);
}

function crc32(buffer) {
  let checksum = 0xffffffff;
  for (const byte of buffer) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit++) checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function archive(entries) {
  const local = [],
    central = [];
  let offset = 0;
  for (const { name, text, declaredSize } of entries) {
    const filename = Buffer.from(name);
    const data = Buffer.from(text);
    const compressed = deflateRawSync(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(crc32(data), 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(declaredSize ?? data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50);
    directory.writeUInt16LE(20, 4);
    header.copy(directory, 6, 4, 30);
    directory.writeUInt32LE(offset, 42);
    local.push(header, filename, compressed);
    central.push(directory, filename);
    offset += header.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

test('accepts a valid DOCX after streaming every entry', async () => {
  await expect(upload(valid())).resolves.toBe('docx');
});
test('rejects alternate archive paths that could shadow the main document', async () => {
  const buffer = archive([
    { name: 'word/document.xml', text: '<document>First</document>' },
    { name: 'word/./document.xml', text: '<document>Second</document>' },
  ]);
  await expect(upload(buffer)).rejects.toThrow('ambiguous archive paths');
});

test('rejects forged small central-directory sizes before extraction', async () => {
  const buffer = valid();
  buffer.writeUInt32LE(1, centralDirectory(buffer, 'word/document.xml') + 24);
  await expect(upload(buffer)).rejects.toThrow('declared sizes');
});

test('stops an oversized compressed entry whose metadata claims a small size', async () => {
  const buffer = archive([
    { name: 'word/document.xml', text: 'x'.repeat(31 * 1024 * 1024), declaredSize: 1024 },
  ]);
  expect(buffer.length).toBeLessThan(10 * 1024 * 1024);
  await expect(upload(buffer)).rejects.toThrow('declared sizes');
});

test('retains the aggregate uncompressed size and entry count caps', async () => {
  const buffer = valid();
  buffer.writeUInt32LE(31 * 1024 * 1024, centralDirectory(buffer, 'word/document.xml') + 24);
  await expect(upload(buffer)).rejects.toThrow('processing limit');
  const entries = Array.from({ length: 2001 }, (_, index) => ({
    name: `part-${index}.xml`,
    text: '',
  }));
  await expect(upload(archive(entries))).rejects.toThrow('processing limit');
});

test('rejects duplicate document entries and symbolic links', async () => {
  const duplicate = archive([
    { name: 'word/document.xml', text: '<doc/>' },
    { name: 'word/document.xml', text: '<different/>' },
  ]);
  await expect(upload(duplicate)).rejects.toThrow('duplicate');
  const symlink = valid();
  symlink.writeUInt32LE(
    (0o120777 << 16) >>> 0,
    centralDirectory(symlink, 'word/document.xml') + 38,
  );
  await expect(upload(symlink)).rejects.toThrow('symbolic links');
});

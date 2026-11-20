const fs=require('node:fs');
const path=require('node:path');
const {validateFile,MAX_FILE_SIZE}=require('../src/services/fileValidator');
const {extractText,cleanText}=require('../src/services/textExtractor');
const {fallback,chunkText,createSegmenter}=require('../src/services/clauseSegmenter');
const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures',name));
test.each(['pdf','docx'])('validates and extracts actual %s document',async type=>{const buffer=fixture(`contract.${type}`);expect(await validateFile({buffer,originalname:`test.${type}`})).toBe(type);expect(await extractText(buffer,type)).toContain('Payment Terms');});
test.each([
 [{buffer:Buffer.from('%PDF-file'),originalname:'file.exe'},'Only PDF'],
 [{buffer:Buffer.from('invalid'),originalname:'file.pdf'},'contents do not match'],
 [{buffer:Buffer.from('%PDF-'),originalname:'file.docx'},'contents do not match'],
 [{buffer:Buffer.alloc(MAX_FILE_SIZE+1),originalname:'file.pdf'},'10 MB'],
 [null,'Choose a PDF'],
])('rejects invalid uploads',async(file,message)=>{await expect(validateFile(file)).rejects.toThrow(message);});
test('rejects ordinary ZIP files renamed as DOCX',async()=>{await expect(validateFile({buffer:fixture('not-docx.zip'),originalname:'file.docx'})).rejects.toThrow('word/document.xml');});
test('reports empty and damaged PDFs helpfully',async()=>{await expect(extractText(fixture('empty.pdf'),'pdf')).rejects.toThrow('no extractable text');await expect(extractText(Buffer.from('%PDF-xxx'),'pdf')).rejects.toThrow('could not be read');});
test('enforces extracted text bounds and cleans whitespace',async()=>{expect(cleanText(' a  b \r\n\r\n\r\nc ')).toBe('a b\n\nc');await expect(extractText(fixture('contract.docx'),'docx',5)).rejects.toThrow('processing limit');});
test('fallback preserves numbered sections and assigns categories',()=>{const result=fallback('1. Payment Terms\nPay in 30 days.\n2. Liability\nUnlimited liability.');expect(result).toHaveLength(2);expect(result[1].category).toBe('Liability');});
test('long chunks overlap without losing the end of the input',()=>{const text='abc '.repeat(10000);const chunks=chunkText(text);expect(chunks.length).toBeGreaterThan(2);expect(chunks.at(-1).endsWith('abc ')).toBe(true);});
test('retries invalid JSON once then falls back',async()=>{const generate=jest.fn().mockResolvedValue({text:'invalid'});const result=await createSegmenter({generate})('1. Payment Terms\nPay within 30 days.');expect(generate).toHaveBeenCalledTimes(2);expect(result.usedFallback).toBe(true);expect(result.clauses[0].category).toBe('Payment Terms');});
test('accepts valid verbatim segmentation and rejects invented content',async()=>{const text='1. Liability\nLiability is capped.';const generate=jest.fn().mockResolvedValue({text:JSON.stringify({clauses:[{text,category:'Liability'}]})});expect((await createSegmenter({generate})(text)).usedFallback).toBe(false);generate.mockResolvedValue({text:JSON.stringify({clauses:[{text:'Invented clause',category:'Liability'}]})});expect((await createSegmenter({generate})(text)).usedFallback).toBe(true);});

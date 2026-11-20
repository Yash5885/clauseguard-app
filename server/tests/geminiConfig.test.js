const mockGenerate = jest.fn().mockResolvedValue({ text: '{}' });
const mockEmbed = jest.fn().mockResolvedValue({ embeddings: [] });
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest
    .fn()
    .mockImplementation(() => ({
      models: { generateContent: mockGenerate, embedContent: mockEmbed },
    })),
}));
const { createGemini } = require('../src/services/gemini');
test('uses the configured text model without changing the embedding model', async () => {
  const service = createGemini({
    GEMINI_API_KEY: 'test',
    GEMINI_CONCURRENCY: 1,
    GEMINI_GENERATION_MODEL: 'gemini-3.8-flash',
  });
  await service.generate('test', { type: 'object' });
  await service.embed(['test'], 'RETRIEVAL_QUERY');
  expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.8-flash' }));
  expect(mockEmbed).toHaveBeenCalledWith(
    expect.objectContaining({ model: 'gemini-embedding-001' }),
  );
});

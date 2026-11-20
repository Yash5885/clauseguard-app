function normalize(values) {
  if (!Array.isArray(values) || values.length !== 768 || !values.every(Number.isFinite))
    throw new Error('Invalid embedding dimensions');
  const magnitude = Math.sqrt(values.reduce((sum, n) => sum + n * n, 0));
  if (!magnitude) throw new Error('Embedding must have nonzero magnitude');
  return values.map((v) => v / magnitude);
}
function createEmbeddingService(gemini) {
  return async function embed(texts, taskType = 'RETRIEVAL_QUERY') {
    const vectors = [];
    for (let offset = 0; offset < texts.length; offset += 16) {
      const batch = texts.slice(offset, offset + 16);
      const result = await gemini.embed(batch, taskType);
      if (result.embeddings?.length !== batch.length)
        throw new Error('Embedding response length mismatch');
      vectors.push(...result.embeddings.map((e) => normalize(e.values)));
    }
    return vectors;
  };
}
module.exports = { normalize, createEmbeddingService };

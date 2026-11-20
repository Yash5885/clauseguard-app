const { z } = require('zod');
const path = require('node:path');
const { validateFile } = require('../services/fileValidator');
const { AppError } = require('../utils/errors');
function parse(schema, value) {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new AppError(400, 'INVALID_REQUEST', 'Check the analysis ID and pagination parameters.');
  return parsed.data;
}
const paging = z.object({
  page: z.coerce.number().int().positive().max(100000).default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
function createAnalysisController({ repository, queue, pipeline }) {
  return {
    async create(req, res) {
      const type = await validateFile(req.file);
      const reservation = queue.reserve();
      try {
        const name =
          path
            .basename(req.file.originalname.replace(/\\/g, '/'))
            .replace(/[\x00-\x1f\x7f]/g, '')
            .slice(0, 255) || `contract.${type}`;
        const analysis = await repository.create(req.userId, name, type);
        const buffer = req.file.buffer;
        reservation.submit(() => pipeline(analysis, buffer));
        res.status(202).json({ id: analysis.id, status: analysis.status });
      } finally {
        reservation.release();
      }
    },
    async list(req, res) {
      const { page, limit } = parse(paging, req.query);
      res.json(await repository.list(req.userId, page, limit));
    },
    async get(req, res) {
      res.json(await repository.get(req.userId, parse(z.uuid(), req.params.id)));
    },
    async remove(req, res) {
      await repository.remove(req.userId, parse(z.uuid(), req.params.id));
      res.status(204).end();
    },
  };
}
module.exports = { createAnalysisController };

const { Router } = require('express');
const multer = require('multer');
const { asyncRoute } = require('../utils/errors');
const { MAX_FILE_SIZE } = require('../services/fileValidator');
const { createAnalysisController } = require('../controllers/analyses');
function createAnalysisRouter(deps) {
  const router = Router();
  const c = createAnalysisController(deps);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 0, parts: 2 },
  });
  router.post('/analyses', upload.single('file'), asyncRoute(c.create));
  router.get('/analyses', asyncRoute(c.list));
  router.get('/analyses/:id', asyncRoute(c.get));
  router.delete('/analyses/:id', asyncRoute(c.remove));
  return router;
}
module.exports = { createAnalysisRouter };

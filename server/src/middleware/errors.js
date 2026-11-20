const { AppError } = require('../utils/errors');
function errorHandler(logger) {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === 'LIMIT_FILE_SIZE') error = new AppError(400, 'FILE_TOO_LARGE', 'Files must be 10 MB or smaller.');
    if (error.name === 'MulterError') error = new AppError(400, 'INVALID_UPLOAD', 'Upload exactly one file using the file field.');
    const safe = error instanceof AppError;
    logger.error({ err: error, requestId: req.id }, 'Request failed');
    res.status(safe ? error.status : 500).json({error:{code:safe ? error.code : 'INTERNAL_ERROR',message:safe ? error.message : 'Something went wrong. Please try again.',request_id:req.id}});
  };
}
module.exports = { errorHandler };

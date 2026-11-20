const { loadConfig } = require('./config');
const pino = require('pino');
const { createApp } = require('./app');
const config = loadConfig();
const logger = pino({level:config.LOG_LEVEL,redact:['req.headers.authorization','GEMINI_API_KEY','CLERK_SECRET_KEY','DATABASE_URL']});
createApp({config,logger}).listen(config.PORT,()=>logger.info({port:config.PORT},'API listening'));

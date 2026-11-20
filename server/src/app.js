const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const { randomUUID } = require('node:crypto');
const { errorHandler } = require('./middleware/errors');
const { AppError } = require('./utils/errors');
function createApp({ config, logger, auth, router }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req,res,next) => { req.id = randomUUID(); res.setHeader('X-Request-ID',req.id); next(); });
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_URL, allowedHeaders:['Content-Type','Authorization'], methods:['GET','POST','DELETE','OPTIONS'] }));
  app.use(express.json({limit:'32kb'}));
  app.get('/health', (req,res) => res.json({status:'ok'}));
  app.use('/api', rateLimit({windowMs:60000,limit:90,standardHeaders:'draft-7',legacyHeaders:false,handler:(req,res)=>res.status(429).json({error:{code:'RATE_LIMIT',message:'Too many requests. Please wait a minute.'}})}));
  if (auth) app.use('/api',auth);
  if (router) app.use('/api',router);
  app.use((req,res,next)=>next(new AppError(404,'NOT_FOUND','Not found.')));
  app.use(errorHandler(logger));
  return app;
}
module.exports = { createApp };

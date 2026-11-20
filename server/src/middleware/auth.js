const {clerkMiddleware,getAuth}=require('@clerk/express');
const {AppError}=require('../utils/errors');
function createAuth(config) {
 return [clerkMiddleware({publishableKey:config.CLERK_PUBLISHABLE_KEY,secretKey:config.CLERK_SECRET_KEY,authorizedParties:[config.CLIENT_URL]}),(req,res,next)=>{
  const {userId}=getAuth(req);
  if(!userId)return next(new AppError(401,'UNAUTHORIZED','Sign in to access your contracts.'));
  req.userId=userId;next();
 }];
}
module.exports={createAuth};

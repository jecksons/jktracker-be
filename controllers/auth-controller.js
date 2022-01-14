const jwt = require('jsonwebtoken');
const config = require('../config');
const userController = require('./user-controller');
const utilsLib = require('../services/utils_lib');
const {v4: uuidv4} = require('uuid');
const { ErBadRequest, ErNotFound, HttpStatusCode, ErUnauthorized } = require('../services/error_classes');
const User = require('../models/user');

const SQL_INS_TOKEN = `
   insert into refresh_token
   (
      token,
      id_user,
      expire_date,
      created_at
   )
   values(?, ?, ?, SYSDATE())
   `;

const SQL_SEL_TOKEN = `
   select 
      token,
      id_user,
      expire_date
   from 
      refresh_token
   where
      token = ?
   `;

const SQL_DEL_TOKEN = `
   delete
   from 
      refresh_token
   where
      token = ?   
   `;

const verifyClientVersion = (req, res, next) => {
   let clientVersion =  parseInt(req.headers['x-client-version']);
   if (clientVersion > 0) {
      if (clientVersion < config.web.clientVersion) {
         return res.status(HttpStatusCode.UPGRADE_REQUIRED).json({message: `Upgrade to client ${config.web.clientVersion}`});
      }      
   } 
   next();
}

const verifyToken = (req, res, next) => {
   let token = req.headers['x-access-token'];
   if (!token) {
      return res.status(HttpStatusCode.UNAUTHORIZED).json({message: 'No token provided!'});
   }
   jwt.verify(token, config.web.jwtSecret, (err, decoded) => {
      if (err) {
         if (err instanceof jwt.TokenExpiredError) {
            return res.status(HttpStatusCode.UNAUTHORIZED).json({message: 'Unauthorized! Access token is expired!'});
         }
         return res.status(HttpStatusCode.UNAUTHORIZED).json({message: 'Unauthorized!'});
      }
      req.id_user = decoded.id_user;
      verifyClientVersion(req, res, next);
   } );
}


const createRefreshToken = async (user, conn)  => {
   let expiredTime = new Date();
   const token = uuidv4();
   expiredTime.setSeconds(expiredTime.getSeconds() + config.web.jwtRefreshExpireTime);
   const refToken = {
      userId: user.id, 
      expireDate: expiredTime, 
      token: token
   };      
   await conn.query(SQL_INS_TOKEN, [refToken.token, refToken.userId, refToken.expireDate]);
   return token;
}

const signInId = async (userId, conn) => {
   try {
      let user = await userController.getUserById(userId, conn, true);
      let token = jwt.sign({id_user: user.id}, config.web.jwtSecret, {expiresIn: config.web.jwtExpireTime});      
      user.accessToken = token;   
      user.refreshToken = await createRefreshToken(user, conn);
      return user;
   }
   finally {
      await conn.close();
   }   
}


const getRefreshTokenById = async (token, conn) => {
   const rows = await conn.query(SQL_SEL_TOKEN, [token]);
   if (!(rows.length > 0)) {
      throw new ErNotFound('Token not found!');
   }
   return {
      token: rows[0].token,
      userId: rows[0].id_user,
      expireDate: rows[0].expire_date
   };
}

const checkExpiryDate = (dateExpiry)  => {
   if (dateExpiry.getTime() < (new Date().getTime())) {
      throw new ErUnauthorized('Refresh token is expired. A new signin is required!');
   }
}

const removeTokenById = async (token, conn) => {
   const rows = await conn.query(SQL_DEL_TOKEN, [token]);
}



const getNewTokenByRefreshToken = async (requestToken, conn) => {
   try {      
      if (!requestToken) {
         throw new ErBadRequest('No refresh token is informed!');         
      }      
      const dbToken = await getRefreshTokenById(requestToken, conn);
      try {
         checkExpiryDate(dbToken.expireDate);
      }
      catch (err) {
         if (err instanceof ErUnauthorized) {
            await removeTokenById(dbToken.token, conn);
         }
         throw err;
      }
      let token = jwt.sign({id_user: dbToken.userId}, config.web.jwtSecret, {expiresIn: config.web.jwtExpireTime});
      return {
         accessToken: token,
         refreshToken: dbToken.token
      }
   } 
   finally {
      await conn.close();
   }   
}


const refreshTokenReq = (req, res, conn) => {
   const {refreshToken: requestToken} = req.body;
   getNewTokenByRefreshToken(requestToken, conn)
   .then((ret) => res.status(200).json(ret))
   .catch((err) => utilsLib.resError(err, res));
}

const signIn = async (req, res, conn) => {
   try {
      const user = await signInId(req.body.id, conn);
      return res.status(200).json(user);    
   }
   catch (err) {
      return utilsLib.resError(err, res);
   } 
}


const signInDemo = async (req, res, conn) => {
   try {
      const user = await signInId(1, conn);
      return res.status(200).json(user);    
   }
   catch (err) {
      return utilsLib.resError(err, res);
   } 
}

const signInEmail = async (req, res, conn) => {      
   try {
      let user = new User(req.body);            
      user = await userController.updateUserByEmail(user, conn);      
      const signedUser = await signInId(user.id, conn);
      return res.status(200).json(signedUser);    
   }
   catch (err) {
      await conn.close();
      return utilsLib.resError(err, res);
   } 
}





module.exports = {
   verifyToken: verifyToken,
   verifyClientVersion: verifyClientVersion,
   signIn: signIn,
   signInDemo: signInDemo,
   signInEmail: signInEmail,
   refreshTokenReq: refreshTokenReq
};
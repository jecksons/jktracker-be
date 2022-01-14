const  HttpStatusCode  = {
   OK:  200,
   BAD_REQUEST: 400,
   UNAUTHORIZED: 401,
   NOT_FOUND: 404,
   FORBIDDEN: 403,
   UNPROCESSABLE_ENTITY: 422,
   UPGRADE_REQUIRED: 426,
   INTERNAL_SERVER: 500,   
}

class BaseError extends Error {

   constructor(message, httpCode) {
       super(message);
       this.httpCode = httpCode;        
   }
}


class ErForbidden extends BaseError {
   constructor(message) {
       super(message, HttpStatusCode.FORBIDDEN);
   }
}

class ErUnauthorized extends BaseError {
   constructor(message) {
       super(message, HttpStatusCode.UNAUTHORIZED);
   }
}

class ErNotFound extends BaseError {
   constructor(message) {
       super(message, HttpStatusCode.NOT_FOUND);
   }
}



class ErUnprocEntity extends BaseError {
   constructor(message) {
       super(message, HttpStatusCode.UNPROCESSABLE_ENTITY);
   }
}

class ErUpgradeRequired extends BaseError {
   constructor(message) {
       super(message, HttpStatusCode.UPGRADE_REQUIRED);
   }
}


class ErBadRequest extends BaseError {
   constructor(message) {
       super(message, HttpStatusCode.BAD_REQUEST);
   }
}

class ErInternalServer extends BaseError {
   constructor(message) {
       super(message, HttpStatusCode.INTERNAL_SERVER);
   }
}

module.exports = {
   HttpStatusCode, BaseError, ErNotFound, ErUnprocEntity,
   ErBadRequest, ErInternalServer, ErForbidden, ErUnauthorized, ErUpgradeRequired
};
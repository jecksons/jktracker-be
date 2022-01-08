const  HttpStatusCode  = {
   OK:  200,
   BAD_REQUEST: 400,
   NOT_FOUND: 404,
   UNPROCESSABLE_ENTITY: 422,
   INTERNAL_SERVER: 500,   
}

class BaseError extends Error {

   constructor(message, httpCode) {
       super(message);
       this.httpCode = httpCode;        
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
   HttpStatusCode, BaseError, ErNotFound, ErUnprocEntity, ErBadRequest, ErInternalServer
};
const authController = require('../controllers/auth-controller')

module.exports = (app, handleRequestDB) => {   
   
   app.get('/auth/signin-demo/', [authController.verifyClientVersion], (req, res) => handleRequestDB(req, res, authController.signInDemo));
   app.get('/auth/signin/', [authController.verifyClientVersion], (req, res) => handleRequestDB(req, res, authController.signIn));
   app.post('/auth/signin-email/', [authController.verifyClientVersion], (req, res) => handleRequestDB(req, res, authController.signInEmail));
   app.post('/auth/refresh-token/', [authController.verifyClientVersion], (req, res) => handleRequestDB(req, res, authController.refreshTokenReq));   

}
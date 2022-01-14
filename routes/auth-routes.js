const authController = require('../controllers/auth-controller')

module.exports = (app, handleRequestDB) => {   
   
   app.get('/auth/signin-demo/', (req, res) => handleRequestDB(req, res, authController.signInDemo));
   app.get('/auth/signin/', (req, res) => handleRequestDB(req, res, authController.signIn));
   app.post('/auth/signin-email/', (req, res) => handleRequestDB(req, res, authController.signInEmail));
   app.post('/auth/refresh-token/', (req, res) => handleRequestDB(req, res, authController.refreshTokenReq));   

}
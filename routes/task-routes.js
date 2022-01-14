const TaskController = require('../controllers/task-controller');
const authController = require('../controllers/auth-controller');

module.exports = (app, handleRequestDB) => {
   app.use(function(req, res, next) {
      res.header(
        "Access-Control-Allow-Headers",
        "x-access-token, Origin, Content-Type, Accept"
      );
      next();
    });

   app.get('/tasks/', [authController.verifyToken], (req, res) => handleRequestDB(req, res, TaskController.getAllReq));
   app.post('/tasks/', [authController.verifyToken], (req, res) => handleRequestDB(req, res, TaskController.saveTaskReq));
   app.get('/tasks/tracked-time/', [authController.verifyToken], (req, res) => handleRequestDB(req, res, TaskController.getTrackedTimeReq ));
   app.post('/tasks/track/', [authController.verifyToken],  (req, res) => handleRequestDB(req, res, TaskController.startStopTrackReq ));

}
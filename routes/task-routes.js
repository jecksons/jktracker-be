const TaskController = require('../controllers/task-controller');
const authController = require('../controllers/auth-controller');

module.exports = (app, handleRequestDB) => {
   app.use(function(req, res, next) {
      res.header(
        "Access-Control-Allow-Headers",
        "x-access-token, x-client-version, Origin, Content-Type, Accept"
      );
      next();
    });

   app.get('/tasks/', [authController.verifyToken], (req, res) => handleRequestDB(req, res, TaskController.getAllReq));
   app.get('/tasks/code/:id', [authController.verifyToken],  (req, res) => handleRequestDB(req, res, TaskController.getTaskByCodeReq ));
   app.get('/tasks/id/:id', [authController.verifyToken],  (req, res) => handleRequestDB(req, res, TaskController.getTaskByIdReq ));
   app.delete('/tasks/id/:id', [authController.verifyToken],  (req, res) => handleRequestDB(req, res, TaskController.deleteTaskReq ));
   app.get('/tasks/tracked-time-task/:id', [authController.verifyToken],  (req, res) => handleRequestDB(req, res, TaskController.getTaskRecordedTimesReq ));   
   app.post('/tasks/', [authController.verifyToken], (req, res) => handleRequestDB(req, res, TaskController.saveTaskReq));
   app.post('/tasks/time-record/', [authController.verifyToken], (req, res) => handleRequestDB(req, res, TaskController.saveTimeRecordReq));
   app.delete('/tasks/time-record/:id', [authController.verifyToken], (req, res) => handleRequestDB(req, res, TaskController.deleteTaskRecordTimeReq));
   app.get('/tasks/tracked-time/', [authController.verifyToken], (req, res) => handleRequestDB(req, res, TaskController.getTrackedTimeReq ));
   app.post('/tasks/track/', [authController.verifyToken],  (req, res) => handleRequestDB(req, res, TaskController.startStopTrackReq ));   

}
const controller = require('../controllers/task-controller'),
   connFactory = require('../services/connection-db'),
   config = require('../config');
const TimeRecord = require('../models/time-record');
const { ErBadRequest, ErNotFound } = require('../services/error_classes');
const UtilsLib = require('../services/utils_lib');

const id_user_demo = 1;

let newTask = {
   description: 'Task example from test'
};

const newTaskOK = {...newTask, id_user: id_user_demo};

test('Fail with no user.', async () => {
   const conn = connFactory.getConnection(config);
   expect.assertions(1);
   try {
      const ret = await controller.saveTask(newTask, conn);
   } catch (e) {      
      expect(e.message).toMatch('idUser is required!');
   }
});

test('Delete an invalid task.', async () => {
   expect.assertions(1);
   const conn = connFactory.getConnection(config);
   try {
      await controller.deleteTask(999999999, id_user_demo, conn);
   } catch (err) {
      expect(err).toBeInstanceOf(ErNotFound);
   }
});

test('Create a new task.', async () => {
   expect.assertions(2);
   let conn = connFactory.getConnection(config);
   const ret = await controller.saveTask({...newTaskOK}, conn);
   expect(ret).not.toBeNull();
   if (ret) {
      expect(ret.id).toBeGreaterThan(0);      
      conn = connFactory.getConnection(config);      
      await controller.deleteTask(ret.id, newTaskOK.id_user, conn);
   }   
});

test('Start and finish a time record.', async () => {
   expect.assertions(5);
   let conn = connFactory.getConnection(config);
   const tsk = await controller.saveTask({...newTaskOK}, conn);
   conn = connFactory.getConnection(config);
   let ret = await controller.startStopTrack(id_user_demo, tsk.id, 'S', conn);
   expect(ret.currentTask).not.toBeNull();
   expect(ret.currentTask.id).toBe(tsk.id);   
   conn = connFactory.getConnection(config);
   ret = await controller.startStopTrack(id_user_demo, tsk.id, 'F', conn);
   expect(ret.previousTask).not.toBeNull();
   expect(ret.previousTask.id).toBe(tsk.id);
   expect(ret.currentTask).toBeUndefined();
   conn = connFactory.getConnection(config);
   await controller.deleteTask(tsk.id, id_user_demo, conn);
});


test('Register a time record.', async () => {
   expect.assertions(3);
   let conn = connFactory.getConnection(config);
   const tsk = await controller.saveTask({...newTaskOK}, conn);   
   const timeRec = new TimeRecord();
   timeRec.start_time = new Date();
   timeRec.end_time = UtilsLib.addDays(timeRec.start_time, 1 / 24);
   timeRec.id_task = tsk.id;
   conn = connFactory.getConnection(config);
   let ret = await controller.saveTimeRecord(timeRec, id_user_demo, conn);
   expect(ret.id).toBeGreaterThan(0);         
   conn = connFactory.getConnection(config);
   const recTimes = await controller.getTaskRecordedTimes(tsk.id, conn);
   expect(recTimes.results.length).toBe(1);
   expect(recTimes.results[0].id).toBe(ret.id);
   conn = connFactory.getConnection(config);
   await controller.deleteTask(tsk.id, id_user_demo, conn);
});



test('Fail to register an invalid time record.', async () => {
   expect.assertions(1);
   let conn = connFactory.getConnection(config);
   const tsk = await controller.saveTask({...newTaskOK}, conn);   
   const timeRec = new TimeRecord();
   timeRec.end_time = new Date();
   timeRec.start_time = UtilsLib.addDays(timeRec.end_time, 1 / 24);   
   timeRec.id_task = tsk.id;
   conn = connFactory.getConnection(config);
   try {
      const ret = await controller.saveTimeRecord(timeRec, id_user_demo, conn);      
   } catch (err) {
      expect(err.message).toMatch('The start time cannot be greater than the end time');
   }   
   conn = connFactory.getConnection(config);
   await controller.deleteTask(tsk.id, id_user_demo, conn);
});
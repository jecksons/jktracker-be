const { ErBadRequest, ErNotFound, ErInternalServer, ErUnprocEntity } = require("../services/error_classes");
const UtilsLib = require("../services/utils_lib");
const Task = require('../models/task');
const TimeRecord = require('../models/time-record');

const SQL_INS_TASK = `
      insert into task
      (
         description,
         id_task_parent,
         id_task_status,
         due_date,
         priority,
         estimated_time,
         id_user,
         unique_code,
         created_at
      )
      values(?, ?, ?, ?, ?, ?, ?, ?, sysdate())
   `;

const SQL_SEL_TASK = `
      select 
         tsk.id_task,
         tsk.description,
         tsk.id_task_parent,
         tsk.id_task_status,
         tsk.due_date,
         tsk.priority,
         tsk.estimated_time,
         tsk.unique_code,
         case
            when exists
                     (
                        select
                           1
                        from
                           task chi
                        where
                           chi.id_task_parent = tsk.id_task
                     ) then
               1
            else
               0
         end has_childs,
         round(
         (
            select 
               sum(( unix_timestamp(ifnull(end_time, sysdate())) -  unix_timestamp(start_time)) / 60 / 60 / 24) total_time
            from 
               task_time_track trk
            where 
               trk.id_task = tsk.id_task
               and trk.end_time is not null
         ), 8) tracked_time,
         round(
         (
            select 
               sum(( unix_timestamp(ifnull(end_time, sysdate())) - unix_timestamp(start_time)) / 60 / 60 / 24) total_time
            from 
               task chi      
            join task_time_track trk on (trk.id_task = chi.id_task and trk.end_time is not null)
            where 
               chi.id_task_parent = tsk.id_task               
         ), 8) tracked_time_childs,
         round(
         (
            select 
               sum(ifnull(chi.estimated_time, 0)) total_time
            from 
               task chi      
            where 
               chi.id_task_parent = tsk.id_task
         ), 8) estimated_time_childs,
         (
            select 
               trk.start_time
            from 
               task_time_track trk
            where 
               trk.id_task = tsk.id_task      
               and trk.end_time is null
         ) start_time_tracking
      from 
         task tsk
      where
         1 = 1
         /*filter*/
      order by    
         /*sort_order*/
         ifnull(tsk.priority, 9999),
         tsk.id_task
   `;

const SQL_SEL_TRACKED_TIME =  `
      with
         trk as
         (
            select 
               trk.*
            from
               task_time_track trk
            join task tsk on (trk.id_task = tsk.id_task and tsk.id_user = ?)
            where
               date(trk.start_time) between ?  and ?
               and trk.end_time is not null
            union 
            select 
               trk.*
            from
               task_time_track trk
            join task tsk on (trk.id_task = tsk.id_task and tsk.id_user = ?)
            where
               date(trk.end_time) between ?  and ?
         ),
         tot as
         (
            select
               SUM((UNIX_TIMESTAMP(trk.end_time) - UNIX_TIMESTAMP(trk.start_time)) / 60 / 60) hrs,
               date(trk.start_time)  dt_start_time,
               (dayofweek(trk.start_time) -1) dt_week,
               trk.id_task
            from
               trk
            group by
               date(trk.start_time),
               (dayofweek(trk.start_time) -1),
               trk.id_task
         )
      select
         tot.*,
         sum(tot.hrs) over() total_hrs,
         sum(tot.hrs) over(partition by tot.dt_start_time) total_day_hrs,
         tsk.description task_description,
         par.description task_parent_description,
         row_number() over(partition by tot.dt_start_time order by tot.hrs desc) rn_day
      from
         tot
      left join task tsk on (tot.id_task = tsk.id_task)
      left join task par on (par.id_task = tsk.id_task_parent)
   `;

const SQL_SEL_ACTIVE_TASK = `
      select
         trk.id_task,
         trk.start_time,
         tsk.description,
         trk.id_task_time_track
      from
         task_time_track trk,
         task tsk
      where
         trk.end_time is null
         and trk.id_task = tsk.id_task
         and tsk.id_user = ?
   `;

const SQL_SEL_TASKS_BY_CODE = `
      with
         par as
         (
            select
               chi.id_task
            from
               task chi
            where
               chi.unique_code = ?
               and chi.id_task_parent is null
               and chi.id_user = ?
            union all 
            select
               chi.id_task_parent
            from
               task chi
            where
               chi.unique_code = ?
               and chi.id_task_parent is not null
               and chi.id_user = ?
         ),
         tsk as
         (
            select 
               tsk.description,
               tsk.id_task,
               tsk.id_task_parent,
               tsk.id_task_status,
               tsk.estimated_time,
               tsk.priority,
               tsk.unique_code
            from
               task tsk   
            join par on (par.id_task = tsk.id_task_parent)   
            union all
            select 
               tsk.description,
               tsk.id_task,
               tsk.id_task_parent,
               tsk.id_task_status,
               tsk.estimated_time,
               tsk.priority,
               tsk.unique_code
            from
               task tsk   
            join par on (par.id_task = tsk.id_task)      
         ),
         itm as
         (
            select
               tsk.*,
               round(
               (
                  select 
                     sum(( unix_timestamp(ifnull(trk.end_time, sysdate())) -  unix_timestamp(trk.start_time)) / 60 / 60 / 24) total_time
                  from 
                     task_time_track trk
                  where 
                     trk.id_task = tsk.id_task
               ), 8) tracked_time
            from
               tsk
         )
      select
         itm.*,
         sum(ifnull(itm.estimated_time, 0)) over() total_estimated,
         sum(ifnull(itm.tracked_time, 0)) over() total_tracked
      from
         itm
      order by
         ifnull(itm.id_task_parent, -1),
         case
            when itm.id_task_status = 'O' then 1
            when itm.id_task_status = 'F' then 2
         else
            3
         end,
         ifnull(itm.priority , 9999999)
   `;   

const SQL_SEL_RECORDED_TIMES = `
      with
         trk as
         (
            select 
               trk.id_task_time_track,
               trk.start_time,         
               trk.end_time,
               yearweek(trk.start_time) week,
               (( unix_timestamp(ifnull(trk.end_time, sysdate())) -  unix_timestamp(trk.start_time)) / 60 / 60 / 24) recorded_time
            from 
               task_time_track trk
            where
               id_task = ?
         )
      select
         trk.*,
         sum(trk.recorded_time) over() total_time,
         sum(trk.recorded_time) over(partition by trk.week) total_time_week,
         row_number() over(partition by trk.week order by trk.start_time) rownumber_week,
         count(1) over(partition by trk.week) rows_week
      from
         trk   
   `;

const SQL_DEL_TASK = `
      delete from task
      where 
         id_task = ?
   `;

const SQL_INS_TIME_TRACK = `
      insert into task_time_track
      (
         id_task, 
         start_time,
         end_time
      )   
      values
      (
         ?,
         ?,
         ?
      )
   `;

const SQL_UPD_TIME_TRACK = `
      update
         task_time_track
      set   
         start_time = ?,
         end_time = ?
      where
         id_task_time_track = ?
   `;

const SQL_SEL_CHECK_TIME_RECORD = `
      select
         1
      from
         task_time_track trk
      join task tsk on (tsk.id_task = trk.id_task and tsk.id_user = ?)
      where
         trk.id_task_time_track = ?
   `;

const SQL_DEL_TIME_RECORD = `
      delete from task_time_track trk
      where
         trk.id_task_time_track = ?
   `;

class TaskController {


   static async startTrackingNT(idUser, idTask, conn) {
      const sqlIns = `
         insert into task_time_track
         (
            id_task,
            start_time
         )
         values
         (
            ?,
            SYSDATE()
         )      
      `;
      const sqlRet = `
         select
            start_time
         from
            task_time_track
         where
            id_task_time_track = ?      
      `;
      const updRows = await conn.query(sqlIns, [idTask]);
      return await TaskController.getActiveTask(idUser, conn);
   }
   
   static async stopAllTrackingTimesNT(idUser, conn) {
      const rows = await conn.query(SQL_SEL_ACTIVE_TASK, [idUser]);
      if (rows.length > 0) {
         for (let i =0; i < rows.length; i++) {
            await conn.query(`
                  update 
                     task_time_track
                  set
                     end_time = sysdate()
                  where
                     id_task_time_track = ?
               `, [rows[i].id_task_time_track]);
         }
      }      
   }

   static async stopTrackingTimeNT(idTaskTimeTrack, conn) {
      await conn.query(`
         update 
            task_time_track
         set
            end_time = sysdate()
         where
            id_task_time_track = ?
      `, [idTaskTimeTrack]);
   }

   static async startStopTrack(idUser, idTask, action, conn) {
      let transStarted = false;
      try {
         if (!action) {
            throw new ErBadRequest('Action is not informed!');
         }
         if (action !== 'S' && action !== 'F') {
            throw new ErBadRequest('Action must be S (for start) or F (for finish)!');
         }
         if (action === 'S') {
            if (!(idTask > 0)) {
               throw new ErBadRequest('For start action, its needed to provide the task number!');
            }
         }
         if (!(idUser > 0)) {
            throw new ErBadRequest('IdUser must be provided!');
         }
         await conn.beginTransaction();
         const previousTask = await TaskController.getActiveTask(idUser, conn);
         if (previousTask) {
            await TaskController.stopTrackingTimeNT(previousTask.id_task_time_track, conn);
         }         
         let ret = {
            previousTask: null
         };
         if (previousTask) {
            const tskItems = await  TaskController.getByFilterNT(idUser, 'tsk.id_task = ?', [previousTask.id], conn);
            if (tskItems.length > 0) {
               ret.previousTask = tskItems[0];
            }
         }               
         if (action === 'S') {
            await TaskController.startTrackingNT(idUser, idTask, conn);
            const tskActive = await  TaskController.getByFilterNT(idUser, 'tsk.id_task = ?', [idTask], conn);
            if (tskActive.length > 0) {
               ret.currentTask =  tskActive[0];           
            }            
            ret.serverDate = new Date();
         } else {
            ret.message = 'Stopped with success!';
         }         
         if (ret.currentTask?.id_task_parent > 0) {
            const tskParent = await  TaskController.getByFilterNT(idUser, 'tsk.id_task = ?', [ret.currentTask?.id_task_parent], conn);
            if (tskParent.length > 0) {
               ret.currentTask.parent_data = tskParent[0];
            }            
         }
         if (ret.previousTask?.id_task_parent > 0) {
            const tskParent = await TaskController.getByFilterNT(idUser, 'tsk.id_task = ?', [ret.previousTask?.id_task_parent], conn);
            if (tskParent.length > 0) {
               ret.previousTask.parent_data = tskParent[0];
            }            
         }
         await conn.commit();
         return ret;
      } 
      catch(err) {
         if (transStarted) {
            await conn.rollback();            
         }
         throw err;
      }
      finally {
         await conn.close();
      }
   }

   static async getTaskById(idTask, idUser, conn) {
      try {
         return await TaskController.getByIdNT(idTask, idUser, conn);
      } finally {
         await conn.close();
      }     
   }

   static async getTaskByCode(idUser, taskCode, conn) {
      try {
         const rows = await conn.query(SQL_SEL_TASKS_BY_CODE, [taskCode, idUser, taskCode, idUser]);
         if (rows.length > 0) {
            const items = rows.map((itm) => ({
               id: itm.id_task,
               description: itm.description,
               id_task_parent: itm.id_task_parent,
               id_task_status: itm.id_task_status,
               estimated_time: itm.estimated_time,
               priority: itm.priority,
               unique_code: itm.unique_code,
               tracked_time: itm.tracked_time ?? 0
            }));
            return {
               results: items,
               total: {
                  tracked: rows[0].total_tracked,
                  estimated: rows[0].total_estimated
               }
            };
         }
         throw new ErNotFound('No task found!');
      } finally {
         await conn.close();
      }
   }

   static async getSaveOptions(task, conn) {
      let values = [];
      let sql  = '';
      if (task.id > 0) {
         const functUpd = (field) => {
            if (sql !== '') {
               sql += ', ';
            }
            sql += ` ${field} = ?`;
            values.push(task[field]);
         };
         if (task.description) {
            functUpd('description');
         }
         if (task.id_task_parent > 0) {
            functUpd('id_task_parent');
         }
         if (task.id_task_status) {
            functUpd('id_task_status');
         }
         if (task.hasOwnProperty('due_date')) {
            functUpd('due_date');
         }
         if (task.priority) {
            functUpd('priority');
         }
         if (task.estimated_time) {
            functUpd('estimated_time');
         }
         if (values.length === 0) {
            throw new ErBadRequest('No values to update!');
         }
         sql = `update task set ${sql} where id_task = ?`;
         values.push(task.id);
      } else {
         if (!task.description || task.description === '') {
            throw new ErBadRequest('Description is required!');
         }
         if (!(task.id_user > 0)) {
            throw new ErBadRequest('idUser is required!');
         }
         task.unique_code = await UtilsLib.getUniqueString(15, conn);
         sql = SQL_INS_TASK;
         values = [
            task.description,
            task.id_task_parent,
            task.id_task_status ?? 'O',
            task.due_date,
            task.priority,
            task.estimated_time,
            task.id_user,
            task.unique_code
         ];         
      }
      return {sql: sql, values: values};
   }

   static async getByIdNT(idTask, idUser, conn) {      
      const itms = await TaskController.getByFilterNT(idUser, 'tsk.id_task = ?', [idTask], conn);
      if (itms.length > 0) {
         return itms[0];
      }
      throw new ErNotFound('No task found with this id.');
   }

   static async getByFilterNT(idUser, filter, values, conn, sortOrder) {
      let sql = ' and tsk.id_user = ? ';
      sql += 'and ' + filter;
      let valuesSql = [idUser, ...values];      
      sql = SQL_SEL_TASK.replace('/*filter*/',  sql);
      if (sortOrder) {
         sql = sql.replace('/*sort_order*/', sortOrder);
      }
      const rows = await conn.query(sql, valuesSql);
      if (rows.length > 0) {
         return rows.map((itm) => ({
            id: itm.id_task,
            description: itm.description,
            id_task_parent: itm.id_task_parent,
            id_task_status: itm.id_task_status,
            due_date: itm.due_date,
            priority: itm.priority,
            estimated_time: itm.estimated_time,
            has_childs: itm.has_childs === 1,
            tracked_time: itm.tracked_time ?? 0,
            tracked_time_childs: itm.tracked_time_childs ?? 0,
            estimated_time_childs: itm.estimated_time_childs ?? 0,
            start_time_tracking: itm.start_time_tracking,
            unique_code: itm.unique_code
         }));
      }
      return [];
   }

   static async saveTask(task, conn) {
      let transStarted = false;
      try {
         const options = await TaskController.getSaveOptions(task, conn);
         await conn.beginTransaction();
         transStarted = true;
         const rows = await conn.query(options.sql, options.values);
         if (task.id > 0) {
            if (!(rows.affectedRows > 0)) {
               throw new ErNotFound('No task found with this id!');
            }
         } else {
            task.id = rows.insertId;
         }
         await conn.commit();
         const ret = await TaskController.getByFilterNT(task.id_user, 'id_task = ?', [task.id], conn);
         if (ret.length > 0) {
            return ret[0];
         } else {
            throw new ErInternalServer('The server was unable to retrieve the updated task.')
         }
      } 
      catch (err) {
         if (transStarted) {
            await conn.rollback();
         }
         throw err;
      }
      finally {
         await conn.close();
      }
   }

   static async getActiveTask(idUser, conn) {
      const rows = await conn.query(SQL_SEL_ACTIVE_TASK, [idUser]);
      if (rows.length > 0) {
         return {
            id: rows[0].id_task,
            start_time_tracking: rows[0].start_time,
            description: rows[0].description,
            id_task_time_track: rows[0].id_task_time_track,
            server_date: new Date()
         };
      }
   }

   static async getAll(idUser, query, conn) {
      try {
         let filters = '';
         let values = [];
         let sortOrder;
         if (query.id_parent > 0) {
            filters = ' id_task_parent = ? ';
            values.push(query.id_parent);
         } else {
            filters = ' id_task_parent is null ';
         }
         if (query.status) {
            filters += ' and tsk.id_task_status = ?';
            values.push(query.status);            
         } else {
            sortOrder = `
               case
                  when tsk.id_task_status = 'O' then 1
                  when tsk.id_task_status = 'F' then 2
               else
                  3
               end,
            `;
         }
         const tasks = await TaskController.getByFilterNT(idUser, filters, values, conn, sortOrder);                  
         let ret = {
            results: tasks 
         };         
         ret.activeTask = await TaskController.getActiveTask(idUser, conn);         
         return ret;         
      }
      finally {
         await conn.close();
      }
   }


   static async getTrackedTime(idUser, query, conn) {
      try {
         if (!query.weekFrom) {
            throw new ErBadRequest('weekFrom is not informed!');
         }
         if (!UtilsLib.strIsValidDate(query.weekFrom)) {
            throw new ErBadRequest('weekFrom is not in a correct format (yyyy/mm/dd hh:mm:ss)!');
         }
         let dtFrom = new Date(query.weekFrom + ' 00:00:00');
         if (dtFrom.getDay() === 0) {
            dtFrom = UtilsLib.addDays(dtFrom, 6 * -1);
         } else {
            dtFrom = UtilsLib.addDays(dtFrom, (dtFrom.getDay()-1) * -1);
         }         
         const dtTo = UtilsLib.addDays(dtFrom, 6);
         const rows = await conn.query(SQL_SEL_TRACKED_TIME, [
            idUser,
            dtFrom,
            dtTo,
            idUser,
            dtFrom,
            dtTo
         ]);
         let ret = {
            totalTime: 0,
	     orhet: 4,
            days: [],
            period: {
               from: dtFrom,
               to: dtTo
            }
         };
         if (rows.length > 0) {
            ret.totalHours = rows[0].total_hrs;
            let currDay;
            rows.forEach((itm) => {               
               if (itm.rn_day === 1) {
                  currDay = {
                     date: itm.dt_start_time,
                     totalHours: itm.total_day_hrs,
                     tasks: []
                  };
                  ret.days.push(currDay);
               }
               currDay.tasks.push({
                  id: itm.id_task,
                  hours: itm.hrs,
                  description: itm.task_parent_description ? `${itm.task_description} (${itm.task_parent_description})`  : itm.task_description
               });
            });            
         }
         return ret;
      }
      finally {
         await conn.close();
      }
   }

   static async getTaskRecordedTimes(idTask, conn) {
      try {
         const rows = await conn.query(SQL_SEL_RECORDED_TIMES, [idTask]);
         let ret = {
            results: [],
            totalTime: 0
         };
         if (rows.length > 0 ){            
            ret.results = rows.map((itm) => {
               let retItm = {
                  id: itm.id_task_time_track,
                  start_time: itm.start_time,
                  end_time: itm.end_time,
                  week: itm.week,
                  recorded_time: itm.recorded_time,                  
               }
               if (itm.rownumber_week === 1) {
                  retItm.total_time_week = itm.total_time_week;
                  retItm.firstFromWeek = true;
               }
               return retItm;
            });
         }
         return ret;
      } finally {
         await conn.close();
      }
   }

   static async saveTimeRecord(timeRec, idUser, conn) {
      let transStarted = false;
      try {         
         if (!timeRec.start_time) {
            throw new ErBadRequest('No start time is informed!');
         }
         if (!timeRec.end_time) {
            throw new ErBadRequest('No end time is informed!');
         }
         if (!(timeRec.start_time instanceof Date) || !(timeRec.end_time instanceof Date)) {
            throw new ErBadRequest('No start time and end time must be a Date!');
         }
         /* just to check if the task data is ok */
         const tsk = await TaskController.getByIdNT(timeRec.id_task, idUser, conn);
         if (timeRec.start_time.getTime() > timeRec.end_time.getTime()) {
            throw new ErUnprocEntity('The start time cannot be greater than the end time!');
         }
         const sql = timeRec.id > 0 ? SQL_UPD_TIME_TRACK : SQL_INS_TIME_TRACK;
         let values = [];
         if (timeRec.id > 0) {
            values = [timeRec.start_time, timeRec.end_time, timeRec.id];
         } else {
            values = [tsk.id, timeRec.start_time, timeRec.end_time];
         }
         await conn.beginTransaction();
         transStarted = true;
         const updRows = await conn.query(sql, values);
         if (timeRec.id > 0) {
            if (!(updRows.affectedRows > 0)) {
               throw new ErNotFound('No time record found with this id!');
            }
         } else {
            timeRec.id = updRows.insertId;
         }
         await conn.commit();
         return timeRec;
      } catch (err) {
         if (transStarted) {
            await conn.rollback();            
         }
         throw err;
      }      
      finally {
         await conn.close();
      }
   }

   static async deleteTimeRecord(idTimeRec, idUser, conn) {
      let transStarted = false;
      try {
         const rows = await conn.query(SQL_SEL_CHECK_TIME_RECORD, [idUser, idTimeRec]);
         if (!(rows.length > 0)) {
            throw ErNotFound('No time record found with this id');
         }
         await conn.beginTransaction();
         transStarted = true;
         const updRows = await conn.query(SQL_DEL_TIME_RECORD, [idTimeRec]);
         if (!(updRows.affectedRows > 0)) {
            throw new ErNotFound('No time record found with this id!');
         }         
         await conn.commit();
         return {message: 'Successfully deleted!'};
      } catch (err) {
         if (transStarted) {
            await conn.rollback();            
         }
         throw err;
      }      
      finally {
         await conn.close();
      }
   }

   static async deleteTask(idTask, idUser, conn) {
      let transStarted = false;
      try {
         const tsk = await TaskController.getByIdNT(idTask, idUser, conn);
         await conn.beginTransaction();
         transStarted = true;
         const rows = await conn.query(SQL_DEL_TASK, [tsk.id]);         
         if (rows.affectedRows = 1) {
            await conn.commit();
            return {message: 'Deleted with success!'};
         }
         throw new ErUnprocEntity('It was unable to delete!');
      } catch(err) {
         if (transStarted) {
            await conn.rollback();            
         }
         throw err;
      } finally {
         await conn.close();
      }
   }
   
   static startStopTrackReq(req, res, conn) {
      TaskController.startStopTrack(req.id_user, req.body.id_task, req.body.action, conn)
      .then((ret) => res.status(200).json(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }

   
   static saveTaskReq(req, res, conn) {
      const tsk = new Task(req.body);
      tsk.id_user = req.id_user;
      TaskController.saveTask(tsk, conn)
      .then((ret) => res.status(200).json(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }

   static getAllReq(req, res, conn) {      
      TaskController.getAll(req.id_user, req.query, conn)
      .then((ret) => res.status(200).json(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }


   static getTrackedTimeReq(req, res, conn) {      
      TaskController.getTrackedTime(req.id_user, req.query, conn)
      .then((ret) => res.status(200).json(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }

   static getTaskByCodeReq(req, res, conn) {
      TaskController.getTaskByCode(req.id_user, req.params.id, conn)
      .then((ret) => res.status(200).send(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }

   static getTaskByIdReq(req, res, conn) {
      TaskController.getTaskById(req.params.id, req.id_user, conn)
      .then((ret) => res.status(200).send(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }
   
   
   static getTaskRecordedTimesReq(req, res, conn) {
      TaskController.getTaskRecordedTimes(req.params.id, conn)
      .then((ret) => res.status(200).send(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }

   static saveTimeRecordReq(req, res, conn) {
      const timeRec = new TimeRecord(req.body);
      TaskController.saveTimeRecord(timeRec, req.id_user, conn)
      .then((ret) => res.status(200).send(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }

   static deleteTaskRecordTimeReq(req, res, conn) {
      TaskController.deleteTimeRecord(req.params.id, req.id_user, conn)
      .then((ret) => res.status(200).send(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }

   static deleteTaskReq(req, res, conn) {
      TaskController.deleteTask(req.params.id, req.id_user, conn)
      .then((ret) => res.status(200).send(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }


}

module.exports = TaskController;
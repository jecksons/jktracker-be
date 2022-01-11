const { ErBadRequest, ErNotFound, ErInternalServer, ErUnprocEntity } = require("../services/error_classes");
const UtilsLib = require("../services/utils_lib");

const SQL_INS_TASK = `
      insert into task
      (
         description,
         id_task_parent,
         id_task_status,
         due_date,
         priority,
         estimated_time
      )
      values(?, ?, ?, ?, ?, ?)
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
         ifnull(tsk.priority, 9999),
         tsk.id_task
   `;

const SQL_SEL_TRACKED_TIME =  `
      with
         trk as
         (
            select 
               *
            from
               task_time_track trk
            where
               date(trk.start_time) between ?  and ?
               and trk.end_time is not null
            union 
            select 
               *
            from
               task_time_track trk
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
         tsk.description
      from
         task_time_track trk,
         task tsk
      where
         trk.end_time is null
         and trk.id_task = tsk.id_task
   `;
   

class Task {

   constructor(jsonBase) {
      this.id = 0;
      if (jsonBase) {
         if (jsonBase.id > 0) {
            this.id = jsonBase.id;
         }
         if (jsonBase.description) {
            this.description = jsonBase.description;
         }
         if (jsonBase.id_task_status) {
            this.id_task_status = jsonBase.id_task_status;
         }
         if (jsonBase.hasOwnProperty('due_date')) {
            this.due_date = null;
            if (jsonBase.due_date) {
               this.due_date = new Date(jsonBase.due_date);
            }            
         }
         if (jsonBase.priority) {
            this.priority = parseInt(jsonBase.priority);
         }
         if (jsonBase.estimated_time) {
            this.estimated_time = parseFloat(jsonBase.estimated_time);
         }
         if (jsonBase.id_task_parent > 0) {
            this.id_task_parent = parseInt(jsonBase.id_task_parent);
         }
      }

   }

   static async startTrackingNT(idTask, conn) {
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
      const insId = updRows.insertId;
      const rows = await conn.query(sqlRet, [insId]);
      if (rows.length > 0) {
         return {id_task: idTask, start_time: rows[0].start_time};
      }
      throw new ErUnprocEntity('The server was unable to retrieve the tracking time.');
   }

   static async stopAllTrackingTimesNT(conn) {
      await conn.query(`
         update 
            task_time_track
         set
            end_time = sysdate()
         where
            end_time is null            
      `, []);
   }

   static async startStopTrack(idTask, action, conn) {
      let transStarted = false;
      try {
         if (!action) {
            throw new ErBadRequest('Action is not informed!');
         }
         console.log(action);
         if (action !== 'S' && action !== 'F') {
            throw new ErBadRequest('Action must be S (for start) or F (for finish)!');
         }
         if (action === 'S') {
            if (!(idTask > 0)) {
               throw new ErBadRequest('For start action, its needed to provide the task number!');
            }
         }
         await conn.beginTransaction();
         await Task.stopAllTrackingTimesNT(conn);
         let ret = {};
         if (action === 'S') {
            ret = await Task.startTrackingNT(idTask, conn);            
         } else {
            ret = {message: 'Stopped with success!'};
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

   

   static getSaveOptions(task) {
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
         sql = SQL_INS_TASK;
         values = [
            task.description,
            task.id_task_parent,
            task.id_task_status ?? 'O',
            task.due_date,
            task.priority,
            task.estimated_time
         ];         
      }
      return {sql: sql, values: values};
   }

   static async getByFilterNT(filter, values, conn) {
      const sql = SQL_SEL_TASK.replace('/*filter*/', 'and ' + filter);
      const rows = await conn.query(sql, values);
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
            start_time_tracking: itm.start_time_tracking
         }));
      }
      return [];
   }

   static async saveTask(task, conn) {
      let transStarted = false;
      try {
         const options = Task.getSaveOptions(task);
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
         const ret = await Task.getByFilterNT('id_task = ?', [task.id], conn);
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

   static async getAll(query, conn) {
      try {
         let filters = '';
         let values = [];
         if (query.id_parent > 0) {
            filters = ' id_task_parent = ? ';
            values.push(query.id_parent);
         } else {
            filters = ' id_task_parent is null ';
            if (query.status) {
               filters += ' and tsk.id_task_status = ?';
               values.push(query.status);
            }
         }
         const tasks = await Task.getByFilterNT(filters, values, conn);         
         const rows = await conn.query(SQL_SEL_ACTIVE_TASK, []);
         let ret = {
            results: tasks,
            activeTask: null 
         };         
         if (rows.length > 0) {
            ret.activeTask = {
               id: rows[0].id_task,
               start_time: rows[0].start_time,
               description: rows[0].description
            };
         }
         return ret;         
      }
      finally {
         await conn.close();
      }
   }

   static async getTrackedTime(query, conn) {
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
            dtFrom,
            dtTo,
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
   
   static startStopTrackReq(req, res, conn) {
      Task.startStopTrack(req.body.id_task, req.body.action, conn)
      .then((ret) => res.status(200).json(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }

   
   static saveTaskReq(req, res, conn) {
      const tsk = new Task(req.body);
      Task.saveTask(tsk, conn)
      .then((ret) => res.status(200).json(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }

   static getAllReq(req, res, conn) {      
      Task.getAll(req.query, conn)
      .then((ret) => res.status(200).json(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }


   static getTrackedTimeReq(req, res, conn) {      
      Task.getTrackedTime(req.query, conn)
      .then((ret) => res.status(200).json(ret))
      .catch((err) => UtilsLib.resError(err, res));
   }


}

module.exports = Task;
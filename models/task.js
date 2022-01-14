
   

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

}

module.exports = Task;
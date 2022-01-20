class TimeRecord {

   constructor (jsonBase) {
      this.id = 0;
      if (jsonBase) {
         if (jsonBase.id) {
            this.id = parseInt(jsonBase.id);
         }
         if (jsonBase.start_time) {
            this.start_time = new Date(jsonBase.start_time);
         }
         if (jsonBase.end_time) {
            this.end_time = new Date(jsonBase.end_time);
         }
         if (jsonBase.id_task) {
            this.id_task = parseInt(jsonBase.id_task);
         }
      }
   }


}

module.exports = TimeRecord;
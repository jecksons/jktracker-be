
class User {
   constructor (jsonBase) {
      this.id = 0;
      if (jsonBase.id > 0) {
         this.id = jsonBase.id;
      } else  if (jsonBase.id_user > 0) {
         this.id = jsonBase.id_user;
      }
      if (jsonBase.description) {
         this.description = jsonBase.description;
      }
      if (jsonBase.email) {
         this.email = jsonBase.email;
      }
   }

}

module.exports = User;
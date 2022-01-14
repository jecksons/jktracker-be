const utilsLib = require('../services/utils_lib');
const User = require('../models/user');
const { ErNotFound, ErBadRequest } = require('../services/error_classes');

const SQL_SEL_USER = `
      select 
         id_user,
         description,
         email
      from 
         user usr
      where
         1 = 1`;

const SQL_UPD_USER = `
      update
         user
      set
         description = substr(?, 1, 100)
      where
         id_user = ?
   `;

const SQL_INS_USER = `
      insert into user
      (  
         description,
         email
      )
      values(substr(?, 1, 100), ?)
`;


const getUserById = async (userId, conn, keepConn) => {
   try {
      const sql = SQL_SEL_USER + ' and usr.id_user = ?';
      const rows = await conn.query(sql, [userId]);
      if (!(rows.length > 0)) {
         throw new ErNotFound('No user found with this id!');
      }
      return new User(rows[0]);
   }
   finally {
      if (!keepConn) {
         await conn.close();
      }      
   }
}

const saveUser = async (user, conn) => {
   if (!user.description || user.description === '')  {
      throw new ErBadRequest('User description is required!');
   }
   let sql;
   let values = [];
   if (user.id > 0) {
      sql = SQL_UPD_USER;
      values = [user.description, user.id];
   } else {
      if (!user.email || user.email === '')  {
         throw new ErBadRequest('User email is required!');
      }
      if (!utilsLib.validateEmail(user.email) ) {
         throw new ErBadRequest('The given email is invalid!');
      }
      sql = SQL_INS_USER;
      values = [user.description, user.email];
   }
   const rows = await conn.query(sql, values);
   if (user.id > 0) {
      if (!(rows.affectedRows > 0)) {
         throw new ErNotFound('No user found with this id!');
      }
      return user;
   } else {
      user.id = rows.insertId;
      return user; 
   }

}

const updateUserByEmail = async (user, conn) => {
   const sql = SQL_SEL_USER + ' and usr.email = ?';
   const rows = await conn.query(sql, [user.email]);
   user.id = 0;
   if (rows.length > 0) {
      user.id = rows[0].id_user;         
   }
   user = await saveUser(user, conn);
   return user;      
}


const getUserByIdReq = (req, res, conn) => {
   getUserById(req.params.id, conn)
   .then((ret => res.status(200).json(ret)))
   .catch((err) => utilsLib.resError(err, res));
}


module.exports = {
   getUserById: getUserById,
   getUserByIdReq: getUserByIdReq,
   updateUserByEmail: updateUserByEmail
};
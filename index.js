const dotenv = require('dotenv');
dotenv.config();
const config = require('./config');

const express = require('express'),
    mysql = require('mysql'),
    util = require('util'),
    cors = require('cors'),
    Promise = require('promise');


let app = express();

app.use(express.json());
app.use(cors());


function getConnection(){
    const conn = mysql.createConnection(config);
    return {
        query(sql, args) {
            return util.promisify(conn.query).call(conn, sql, args); ;
        },
        close(){
            if (conn.state !== 'disconnected')
                return util.promisify(conn.end).call(conn);
        },
        beginTransaction() {
            return util.promisify(conn.beginTransaction).call(conn);
        },
        commit() {
            return util.promisify(conn.commit).call(conn);
        },
        rollback() {
            return util.promisify(conn.rollback).call(conn);
        },
        connect(errFunct) {
            return conn.connect(errFunct);
        }
    }
}    

app.use((err, req, res, callback) => {
    if (err.type === "entity.parse.failed") {
        res.status(400).send({error: "Invalid json object"});
    } else {
        res.status(400).send(err);
    }    
}) 

function handleRequestDB(req, res, callback) {    
    const conn = getConnection();
    callback(req, res, conn);
}

require('./routes/task-routes')(app, handleRequestDB);
require('./routes/auth-routes')(app, handleRequestDB);


app.listen(config.web.port, function() {
    console.log(`JkTracker server is running on ${config.web.port}`);
});
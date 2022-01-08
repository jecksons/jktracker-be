const express = require('express'),
    mysql = require('mysql'),
    util = require('util'),
    cors = require('cors'),
    config = require('./config'),
    Promise = require('promise');
const Task = require('./models/task');

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


app.route('/tasks/')
   .get((req, res) => handleRequestDB(req, res, Task.getAllReq) )
   .post((req, res) => handleRequestDB(req, res, Task.saveTaskReq) );

app.get('/tasks/tracked-time/', (req, res) => handleRequestDB(req, res, Task.getTrackedTimeReq ));

app.post('/tasks/track/', (req, res) => handleRequestDB(req, res, Task.startStopTrackReq ));



app.listen(config.web.port, function() {
    console.log(`JkTracker server is running on ${config.host}`);
});
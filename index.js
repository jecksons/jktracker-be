const dotenv = require('dotenv');
dotenv.config();
const config = require('./config');

const express = require('express'),
    cors = require('cors'),
    connDB = require('./services/connection-db');


let app = express();

app.use(express.json());
app.use(cors());


app.use((err, req, res, callback) => {
    if (err.type === "entity.parse.failed") {
        res.status(400).send({error: "Invalid json object"});
    } else {
        res.status(400).send(err);
    }    
}) 

function handleRequestDB(req, res, callback) {    
    const conn = connDB.getConnection(config);
    callback(req, res, conn);
}

require('./routes/task-routes')(app, handleRequestDB);
require('./routes/auth-routes')(app, handleRequestDB);


app.listen(config.web.port, function() {
    console.log(`JkTracker server is running on ${config.web.port}`);
});
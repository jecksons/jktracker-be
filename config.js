const env = process.env.NODE_ENV || 'dev';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'dev';
const DB_PASSWORD = process.env.DB_PASSWORD || '4mFN9LC8#S$$vW4';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_NAME = process.env.DB_NAME || 'jktracker';

const config = {
    connectionLimit: 100,
    debug: false,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    env: env,
    web: {},
    host: DB_HOST
};


config.web.port = process.env.WEB_PORT || 9000;


module.exports = config;
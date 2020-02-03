/*global Logger,Config,MySQL*/

var mysql = require('mysql');

var config = Config.mysql;
    config.multipleStatements = true;
    config.connectionLimit = 10;

var pool = mysql.createPool(Config.mysql);

pool.getConnection((err, connection) => {
    if (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST')
            Logger.error(new Error('Database connection was closed.'));
        if (err.code === 'ER_CON_COUNT_ERROR')
            Logger.error(new Error('Database has too many connections.'));
        if (err.code === 'ECONNREFUSED')
            Logger.error(new Error('Database connection was refused.'));
    }
    
    if (connection)
      connection.release();
});

module.exports = pool;
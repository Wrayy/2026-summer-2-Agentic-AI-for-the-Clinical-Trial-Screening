const mysql = require('mysql2');
const dbConfig = require("../config/db.config");
var db;
module.exports = {
  // This method return connected db obejct.
  connect: function () {
    db = mysql.createConnection(dbConfig.connectionString);
    db.connect(function(err) {
      if (err) {
        console.log(console.error('error: ' + err.message));
        return false;
      }
  
      // console.log('Connected to the MySQL server.');
      return true;
    });
    return db;
  },
  // This method execute query based on existing connection
  queryWithDB: function(query, db) {
    let result = new Promise( ( resolve, reject ) => {
      db.query(query, (err, result)=>{
        if (err){
          return reject( err );
        }
        resolve( result );
      });
    })
    return result;
  },
  // This method establishes a one-time connection for the input query.
  // Duc edit to use dbConfig.js instead of hardcoded values
  query: function(query) {
    let conn = mysql.createConnection({
      host: dbConfig.HOST,
      user: dbConfig.USER,
      password: dbConfig.PASSWORD,
      database: dbConfig.DB,
      port: dbConfig.PORT
    });
    conn.connect(function(err) {
      if (err) {
        console.log(console.error('error: ' + err.message));
        return false;
      }
  
     // console.log('Connected to the MySQL server.dbConfig.HOST: ' + dbConfig.HOST);
      
      return true;
    });

    let result = new Promise( ( resolve, reject ) => {
      conn.query(query, (err, result)=>{
        if (err){
          return reject( err );
        }
        resolve( result );
      });
    })
    conn.end();
    return result;
  }
};
const knex = require('knex');
const dbConfig = require("./app/config/db.config");

const knexClient = dbConfig.dialect === 'mysql' ? 'mysql2' : dbConfig.dialect;

const db=knex({
    client: knexClient,
    connection: {
      host : dbConfig.HOST,
      port : dbConfig.PORT,
      user : dbConfig.USER,
      password : dbConfig.PASSWORD,
      database : dbConfig.DB
    }
  });
console.log(dbConfig.HOST);
module.exports = db;

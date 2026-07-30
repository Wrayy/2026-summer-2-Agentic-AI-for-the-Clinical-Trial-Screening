// db.js
const { Sequelize } = require("sequelize");
const dbConfig = require("./app/config/db.config");

const sequelize = new Sequelize(
  dbConfig.DB,
  dbConfig.USER,
  dbConfig.PASSWORD,
  {
    host: dbConfig.HOST,
    dialect: dbConfig.dialect,
    port: dbConfig.PORT,
    pool: {
      max: dbConfig.pool.max,
      min: dbConfig.pool.min,
      acquire: dbConfig.pool.acquire,
      idle: dbConfig.pool.idle
    }
  }
);

sequelize.authenticate()
  .then(() => {
    console.log("Database connection has been established successfully.");
    console.log(dbConfig.HOST);
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;
db.PatientsRegistration = require("./app/models/PatientsRegistration")(sequelize, Sequelize);
db.DoctorTask = require("./app/models/DoctorTask")(sequelize, Sequelize);
db.DoctorAvailableTimeSegment = require("./app/models/DoctorAvailableTimeSegment")(sequelize, Sequelize);
db.DoctorAppointmentRequest = require("./app/models/DoctorAppointmentRequest")(sequelize, Sequelize);
db.ClinicalStaffTask = require("./app/models/ClinicalStaffTask")(sequelize, Sequelize);
db.AdminTask = require("./app/models/AdminTask")(sequelize, Sequelize);

module.exports = db;

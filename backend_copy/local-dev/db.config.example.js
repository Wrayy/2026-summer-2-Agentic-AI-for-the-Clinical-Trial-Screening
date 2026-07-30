// Copy this file to backend_copy/app/config/db.config.js.
// Keep db.config.js local only. Do not commit real credentials.

module.exports = {
  HOST: "localhost",
  USER: "root",
  PASSWORD: "your-local-mysql-password",
  DB: "clinical_trial_matching_poc",
  PORT: 3306,
  dialect: "mysql",
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  timezone: "+00:00",
};

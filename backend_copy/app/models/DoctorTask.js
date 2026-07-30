module.exports = (sequelize, Sequelize) => {
  const DoctorTask = sequelize.define(
    "DoctorTask",
    {
      Doctor: {
        type: Sequelize.INTEGER,
        field: 'doctor',
      },
      Patient: {
        type: Sequelize.INTEGER,
        field: 'patient',
      },
      Start: {
        type: Sequelize.DATE,
        field: 'start',
      },
      End: {
        type: Sequelize.DATE,
        field: 'end',
      },
      Description: {
        type: Sequelize.TEXT,
        field: 'description',
      },
    },
    {
      tableName: 'doctor_tasks',
      timestamps: false,
    }
  );

  return DoctorTask;
};

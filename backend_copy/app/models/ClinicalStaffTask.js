module.exports = (sequelize, Sequelize) => {
  const ClinicalStaffTask = sequelize.define(
    "ClinicalStaffTask",
    {
      Staff: {
        type: Sequelize.INTEGER,
        field: 'staff',
      },
      Status:{
        type: Sequelize.TINYINT,
        field: 'status',
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
      tableName: 'clinical_staff_tasks',
      timestamps: false,
    }
  );

  return ClinicalStaffTask;
};

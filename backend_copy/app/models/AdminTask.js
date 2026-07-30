module.exports = (sequelize, Sequelize) => {
  const AdminTask = sequelize.define(
    "AdminTask",
    {
      Admin: {
        type: Sequelize.INTEGER,
        field: 'admin',
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
      tableName: 'admin_tasks',
      timestamps: false,
    }
  );

  return AdminTask;
};

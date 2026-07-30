module.exports = (sequelize, Sequelize) => {
    const DoctorAvailableTimeSegment = sequelize.define(
      "DoctorAvailableTimeSegment",
      {
        Doctor: {
          type: Sequelize.INTEGER,
          field: 'doctor',
        },
        Patient: {
          type: Sequelize.INTEGER,
          field: 'patient',
        },
        Category: {
          type: Sequelize.TINYINT,
          field: 'category',
        },
        Status: {
          type: Sequelize.TINYINT,
          field: 'status',
        },
        BookCount: {
          type: Sequelize.INTEGER,
          field: 'book_count',
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
        tableName: 'doctor_available_time_segments',
        timestamps: false,
      }
    );
  
    return DoctorAvailableTimeSegment;
  };
  
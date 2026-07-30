
module.exports = (sequelize, Sequelize) => {
    const DoctorAppointmentRequest = sequelize.define("DoctorAppointmentRequest", {
      Patient: {
        type: Sequelize.INTEGER,
        field: 'patient',
      },
      TimeSegment:{
        type: Sequelize.INTEGER,
        field: 'time_segment',
      },
      Category: {
        type: Sequelize.TINYINT,
        field: 'category',
      },
      Status:{
        type: Sequelize.TINYINT,
        field: 'status',
      },
      Description:{
        type: Sequelize.TEXT,
        field: 'description',
      },
    },{
        tableName: 'doctor_appointment_requests',
        timestamps: false,
    });
    return DoctorAppointmentRequest;
  };
  
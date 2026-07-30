const db = require("../../db");
const { Op, QueryTypes } = require("sequelize");

exports.getPatients = async (req, res) => {
  try {
    const { loginData } = req.body;
    const result = await db.sequelize.query(
      "SELECT patient_id AS id, (SELECT concat_ws(' ', FName, MName, LName) FROM patients_registration as tp WHERE tp.id=t1.patient_id) AS name FROM doctor_recordauthorized AS t1 WHERE doctor_id=$id",
      {
        bind: { id: loginData.id },
        type: QueryTypes.SELECT,
      }
    );

    res.json({ status: "OK", result });
  } catch (error) {
    console.error("Error getPatients:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.getDoctors = async (req, res) => {
  try {
    const { loginData } = req.body;
    const result = await db.sequelize.query(
      "SELECT id, concat_ws(' ', Fname, Mname, Lname) AS name FROM doctors_registration",
      {
        bind: {},
        type: QueryTypes.SELECT,
      }
    );

    res.json({ status: "OK", result });
  } catch (error) {
    console.error("Error getDoctors:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.doctorGetRecentPatients = async (req, res) => {
  try {
    const { loginData, start, end } = req.body;
    const timeSegments = (
      await db.sequelize.query(
        "SELECT *, (SELECT concat_ws(' ', FName, MName, LName) FROM patients_registration as tp WHERE tp.id=t1.patient) AS patientName FROM doctor_available_time_segments AS t1 WHERE doctor=$doctor AND end>=$time AND status=-1 AND start<=$end AND end>=$start ORDER BY start ASC",
        {
          bind: { doctor: loginData.id, time: new Date(), start, end },
          type: QueryTypes.SELECT,
        }
      )
    ).map((record) => ({
      ...record,
      patient: { id: record.patient, name: record.patientName },
    }));

    res.json({ status: "OK", result: timeSegments });
  } catch (error) {
    console.error("Error doctorGetCalendar:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.doctorGetCalendar = async (req, res) => {
  try {
    const { loginData, start, end } = req.body;
    const timeSegments = (
      await db.sequelize.query(
        "SELECT t1.*, concat_ws(' ', td.Fname, td.Mname, td.Lname) AS doctorName, concat_ws(' ', tp.FName, tp.MName, tp.LName) AS patientName, tp.Age AS patientAge FROM doctor_available_time_segments AS t1 LEFT JOIN doctors_registration AS td ON td.id = t1.doctor LEFT JOIN patients_registration AS tp ON tp.id = t1.patient WHERE t1.doctor = $doctor AND t1.start <= $end AND t1.end >= $start",
        {
          bind: { start, end, doctor: loginData.id },
          type: QueryTypes.SELECT,
        }
      )
    ).map((record) => ({
      ...record,
      doctor: { id: record.doctor, name: record.doctorName },
      patient: { id: record.patient, name: record.patientName },
    }));

    res.json({ status: "OK", result: timeSegments });
  } catch (error) {
    console.error("Error doctorGetCalendar:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.patientGetCalendar = async (req, res) => {
  try {
    const { loginData, start, end } = req.body;
    const result = await db.sequelize.query(
      "SELECT *, (SELECT concat_ws(' ', Fname, Mname, Lname) FROM doctors_registration as td WHERE td.id=t1.doctor) AS doctorName, (SELECT status FROM doctor_appointment_requests AS tr WHERE tr.patient=$patient_id AND tr.time_segment=t1.id) AS appointmentStatus, (SELECT description FROM doctor_appointment_requests AS tr WHERE tr.patient=$patient_id AND tr.time_segment=t1.id) AS patientDescription FROM doctor_available_time_segments AS t1 WHERE start<=$end AND end>=$start AND EXISTS (SELECT 1 FROM doctor_recordauthorized AS ta WHERE ta.doctor_id=t1.doctor AND ta.patient_id=$patient_id)",
      {
        bind: { start, end, patient_id: loginData.id },
        type: QueryTypes.SELECT,
      }
    );

    res.json({
      status: "OK",
      result: result.map((record) => ({
        ...record,
        doctor: { id: record.doctor, name: record.doctorName },
      })),
    });
  } catch (error) {
    console.error("Error patientGetCalendar:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

//patientMainPageGetCalendar
// exports.patientMainPageGetCalendar = async (req, res) => {
//   try {
//     const { loginData, start, end } = req.body;
//     const result = await db.sequelize.query(
//       "SELECT da.*, dr.Fname, dr.Lname FROM doctor_available_time_segments AS da JOIN doctors_registration AS dr ON da.doctor = dr.id WHERE da.patient = :patientId AND da.start BETWEEN :start AND :end",
//       {
//         replacements: {
//           patientId: loginData.id,
//           start: start,
//           end: end,
//         },
//         type: QueryTypes.SELECT,
//       }
//     );

//     res.json({
//       status: "OK",
//       result: result.map((record) => ({
//         ...record,
//         type: 2,
//         doctor: {
//           id: record.doctor_id,
//           name: `${record.Fname} ${record.Lname}`,
//         },
//       })),
//     });
//   } catch (error) {
//     console.error("Error patientGetCalendar:", error);
//     res.status(500).json({ status: "InternalServerError" });
//   }
// };

exports.getTimeSegmentDetail = async (req, res) => {
  try {
    const { loginData, id } = req.body;
    const timeSegment = (
      await db.sequelize.query(
        "SELECT *, (SELECT concat_ws(' ', Fname, Mname, Lname) FROM doctors_registration as td WHERE td.id=t1.doctor) AS doctorName FROM doctor_available_time_segments AS t1 WHERE id=$id",
        {
          bind: { id },
          type: QueryTypes.SELECT,
        }
      )
    )[0];
    console.log(timeSegment);
    const requests = await db.sequelize.query(
      "SELECT *, (SELECT concat_ws(' ', FName, MName, LName) FROM patients_registration as tp WHERE tp.id=t1.patient) AS patientName FROM doctor_appointment_requests AS t1 WHERE time_segment=$time_segment_id",
      {
        bind: { time_segment_id: timeSegment.id },
        type: QueryTypes.SELECT,
      }
    );

    res.json({
      status: "OK",
      result: {
        ...timeSegment,
        requests: requests.map((record) => ({
          ...record,
          patient: { id: record.patient, name: record.patientName },
        })),
      },
    });
  } catch (error) {
    console.error("Error getTimeSegmentDetail:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.doctorCreateAvailableTimeSegment = async (req, res) => {
  try {
    const { loginData, category, start, end, description } = req.body;
    const timeSegment = db.DoctorAvailableTimeSegment.build({
      Doctor: loginData.id,
      Patient: null,
      Category: category,
      Status: 0,
      BookCount: 0,
      Start: start,
      End: end,
      Description: description,
    });

    await timeSegment.save();

    res.json({ status: "OK", result: timeSegment.id });
  } catch (error) {
    console.error("Error doctorCreateAvailableTimeSegment:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.getAppointmentRequestId = async (req, res) => {
  try {
    const { timeSegmentId } = req.body;
    console.log("timeSegmentId", timeSegmentId);
    const result = await db.sequelize.query(
      "SELECT id FROM doctor_appointment_requests WHERE time_segment = $timeSegmentId",
      {
        bind: { timeSegmentId },
        type: QueryTypes.SELECT,
      }
    );

    console.log("result", result);

    if (result.length > 0) {
      res.json({ status: "OK", result: result[0].id });
    } else {
      res.status(404).json({ status: "NotFound" });
    }
  } catch (error) {
    console.error("Error getAppointmentRequestId:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.doctorApproveRequest = async (req, res) => {
  try {
    console.log("req.body", req.body);
    return await db.sequelize.transaction(async (t) => {
      const { loginData, id } = req.body;
      const request = await db.DoctorAppointmentRequest.findOne({
        where: { id },
        transaction: t,
      });
      if (request.Status !== 0) {
        throw new Error("Not Approvable");
      }
      request.Status = 1;

      const timeSegment = await db.DoctorAvailableTimeSegment.findOne({
        where: { id: request.TimeSegment },
        transaction: t,
      });
      timeSegment.Category = request.Category;
      timeSegment.Status = -1;
      timeSegment.Patient = request.Patient;
      await timeSegment.save({ transaction: t });

      const requests = await db.DoctorAppointmentRequest.update(
        { Status: -1 },
        {
          where: {
            TimeSegment: { [Op.eq]: request.TimeSegment },
            id: { [Op.ne]: request.id },
          },
          transaction: t,
        }
      );

      await request.save({ transaction: t });
      res.json({ status: "OK" });
    });
  } catch (error) {
    console.error("Error doctorApproveRequest:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.patientSearchForTimeSegments = async (req, res) => {
  try {
    const { loginData, start, end } = req.body;
    const result = await db.sequelize.query(
      "SELECT *, (SELECT concat_ws(' ', Fname, Mname, Lname) FROM doctors_registration as td WHERE td.id=t1.doctor) AS doctorName, (SELECT status FROM doctor_appointment_requests AS tr WHERE tr.patient=$patient_id AND tr.time_segment=t1.id) AS appointmentStatus FROM doctor_available_time_segments AS t1 WHERE start<=$end AND end>=$start AND EXISTS (SELECT 1 FROM doctor_recordauthorized AS ta WHERE ta.doctor_id=t1.doctor AND ta.patient_id=$patient_id)",
      {
        bind: { start, end, patient_id: loginData.id },
        type: QueryTypes.SELECT,
      }
    );

    res.json({
      status: "OK",
      result: result.map((record) => ({
        ...record,
        doctor: { id: record.doctor, name: record.doctorName },
      })),
    });
  } catch (error) {
    console.error("Error patientSearchForTimeSegments:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.patientBookTime = async (req, res) => {
  try {
    return await db.sequelize.transaction(async (t) => {
      const { loginData, id, category, description } = req.body;
      const timeSegment = await db.DoctorAvailableTimeSegment.findOne({
        where: { id: id },
        transaction: t,
      });
      if (timeSegment.Status < 0) {
        res.json({ status: "AlreadyBooked" });
        throw new Error("AlreadyBooked");
      }
      await timeSegment.update({ Status: 1 }, { transaction: t });
      await timeSegment.increment("BookCount", { by: 1, transaction: t });

      const request = db.DoctorAppointmentRequest.build({
        Patient: loginData.id,
        TimeSegment: timeSegment.id,
        Category: category,
        Status: 0,
        Description: description,
      });
      await request.save({ transaction: t });

      res.json({ status: "OK", result: request.id });
    });
  } catch (error) {
    console.error("Error patientBookTime:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

/*
exports.doctorDeleteAvailableTimeSegment = async (req, res) => {
  try {
    const { user } = await parseUserToken(req.body.token);
    const timesegment = await db.DoctorsAvailableTimeSegment.findOne({
      where: {
        id: req.body.id,
        Doctor: user.id,
      },
    });
    await timesegment.destroy();

    res.json({ status: 'OK' });
  } catch (error) {
    console.error("Error doctorGetAvailableTimeSegments:", error);
    res.status(500).json({ status: 'InternalServerError' });
  }
};
*/

exports.cancelAppointmentRequest = async (req, res) => {
  try {
    await db.sequelize.transaction(async (t) => {
      const { loginData, id } = req.body;
      const timeSegment = await db.DoctorAvailableTimeSegment.findOne({
        where: { id },
        transaction: t,
      });
      const request = await db.DoctorAppointmentRequest.findOne({
        where: {
          TimeSegment: timeSegment.id,
          patient: loginData.id,
        },
        transaction: t,
      });

      await timeSegment.decrement("BookCount", { by: 1, transaction: t });
      if (timeSegment.BookCount > 1) {
        await timeSegment.update({ Status: 1 }, { transaction: t });
      } else {
        await timeSegment.update({ Status: 0 }, { transaction: t });
      }

      if (request.Status === 1) {
        await timeSegment.update({ Patient: null }, { transaction: t });
        await db.DoctorAppointmentRequest.update(
          { Status: 0 },
          {
            where: {
              TimeSegment: { [Op.eq]: request.TimeSegment },
              id: { [Op.ne]: request.id },
            },
            transaction: t,
          }
        );
      }
      await request.destroy({ transaction: t });
      await timeSegment.save({ transaction: t });

      res.json({ status: "OK" });
    });
  } catch (error) {
    console.error("Error cancelAppointmentRequest:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.clinicalStaffGetDoctorCalendar = async (req, res) => {
  try {
    const { loginData, doctor, start, end } = req.body;
    const timeSegments = (
      await db.sequelize.query(
        "SELECT *, (SELECT concat_ws(' ', Fname, Mname, Lname) FROM doctors_registration as td WHERE td.id=t1.doctor) AS doctorName, (SELECT concat_ws(' ', FName, MName, LName) FROM patients_registration as tp WHERE tp.id=t1.patient) AS patientName FROM doctor_available_time_segments AS t1 WHERE doctor=$doctor AND start<=$end AND end>=$start",
        {
          bind: { start, end, doctor },
          type: QueryTypes.SELECT,
        }
      )
    ).map((record) => ({
      ...record,
      doctor: { id: record.doctor, name: record.doctorName },
      patient: { id: record.patient, name: record.patientName },
    }));

    res.json({ status: "OK", result: timeSegments });
  } catch (error) {
    console.error("Error clinicalStaffGetDoctorCalendar:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.clinicalStaffGetRecentPatients = async (req, res) => {
  try {
    const { loginData, doctorId, start, end } = req.body;
    const timeSegments = (
      await db.sequelize.query(
        "SELECT *, (SELECT concat_ws(' ', FName, MName, LName) FROM patients_registration as tp WHERE tp.id=t1.patient) AS patientName FROM doctor_available_time_segments AS t1 WHERE doctor=$doctor AND end>=$time AND status=-1 AND start<=$end AND end>=$start ORDER BY start ASC",
        {
          bind: { doctor: doctorId, time: new Date(), start, end },
          type: QueryTypes.SELECT,
        }
      )
    ).map((record) => ({
      ...record,
      patient: { id: record.patient, name: record.patientName },
    }));

    res.json({ status: "OK", result: timeSegments });
  } catch (error) {
    console.error("Error clinicalStaffGetRecentPatients:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.doctorGetMiniCalendar = async (req, res) => {
  try {
    const { loginData, start, end, timezone } = req.body;
    const workDates = (
      await db.sequelize.query(
        "SELECT DATE(CONVERT_TZ(start, 'UTC', $timezone)) as work_date FROM doctor_available_time_segments AS t1 WHERE doctor=$doctor AND start<=$end AND end>=$start AND category=1 GROUP BY work_date",
        {
          bind: { start, end, timezone, doctor: loginData.id },
          type: QueryTypes.SELECT,
        }
      )
    ).map((record) => record.work_date);

    res.json({ status: "OK", result: workDates });
  } catch (error) {
    console.error("Error doctorGetMiniCalendar:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.patientMainPageGetCalendar = async (req, res) => {
  try {
    const { loginData, start, end, timezone } = req.body;
    const result = await db.sequelize.query(
      "SELECT da.*, dr.Fname, dr.Lname FROM doctor_available_time_segments AS da JOIN doctors_registration AS dr ON da.doctor = dr.id WHERE da.patient = :patientId AND CONVERT_TZ(da.start, :timezone, 'UTC') BETWEEN :start AND :end",
      {
        replacements: {
          patientId: loginData.id,
          start: start,
          end: end,
          timezone,
        },
        type: QueryTypes.SELECT,
      }
    );

    res.json({
      status: "OK",
      result: result.map((record) => ({
        ...record,
        type: 2,
        doctor: {
          id: record.doctor_id,
          name: `${record.Fname} ${record.Lname}`,
        },
      })),
    });
  } catch (error) {
    console.error("Error patientGetCalendar:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.doctorGetTasks = async (req, res) => {
  try {
    const { loginData, start, end } = req.body;
    const timeSegments = (
      await db.sequelize.query(
        "SELECT *, (SELECT concat_ws(' ', Fname, Mname, Lname) FROM doctors_registration as td WHERE td.id=t1.doctor) AS doctorName, (SELECT concat_ws(' ', FName, MName, LName) FROM patients_registration as tp WHERE tp.id=t1.patient) AS patientName FROM doctor_available_time_segments AS t1 WHERE doctor=$doctor AND start<=$end AND end>=$start AND category=1",
        {
          bind: { start, end, doctor: loginData.id },
          type: QueryTypes.SELECT,
        }
      )
    ).map((record) => ({
      ...record,
      doctor: { id: record.doctor, name: record.doctorName },
      patient: { id: record.patient, name: record.patientName },
    }));

    res.json({ status: "OK", result: timeSegments });
  } catch (error) {
    console.error("Error doctorGetTasks:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.clinicalStaffCreateAvailableTimeSegment = async (req, res) => {
  try {
    const { loginData, doctorId, category, start, end, description } = req.body;
    const timeSegment = db.DoctorAvailableTimeSegment.build({
      Doctor: doctorId,
      Patient: null,
      Category: category,
      Status: 0,
      BookCount: 0,
      Start: start,
      End: end,
      Description: description,
    });

    await timeSegment.save();

    res.json({ status: "OK", result: timeSegment.id });
  } catch (error) {
    console.error("Error clinicalStaffCreateAvailableTimeSegment:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

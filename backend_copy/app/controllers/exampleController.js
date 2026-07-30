const db = require("../../db");
const { Op, QueryTypes } = require("sequelize");

exports.test = async (req, res) => {
  try {
    const result = await db.sequelize.query(
      "select distinct concat_ws(' ', a.FName, a.MName, a.LName) as Name, a.id, a.Age, a.Gender, substring(max(b.appointment_time),1,10) as Last_appointment,substring(d.start,1,10) as start, d.end, case when c.status = 0 then 'Not Available' when c.status = 1 then 'Available' when c.status = -1 then 'Not available' else c.status end as status from patients_registration  as a left join doctor_appointment as b on a.id = b.patient_id left join doctor_appointment_requests as c on a.id = c.patient left join doctor_available_time_segments as d on a.id = d.patient and c.status = d.status and d.start<=d.end group by Name, start, end order by Name, start asc;",
      {
        type: QueryTypes.SELECT,
      }
    );

    res.json({ status: "OK", result });
  } catch (error) {
    console.error("Error test:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

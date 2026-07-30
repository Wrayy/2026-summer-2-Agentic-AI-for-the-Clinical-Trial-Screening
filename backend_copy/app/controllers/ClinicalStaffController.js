const db = require("../../db");
const { Op, QueryTypes } = require("sequelize");

exports.getTasks = async (req, res) => {
  try {
    const { loginData, start, end } = req.body;
    const result = await db.sequelize.query(
      "SELECT * FROM clinical_staff_tasks as t1 WHERE staff=$staff AND start<$end AND end>=$start",
      {
        bind: { staff: loginData.id, start, end },
        type: QueryTypes.SELECT,
      }
    );

    res.json({ status: "OK", result });
  } catch (error) {
    console.error("Error getTasks:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.getMiniCalendar = async (req, res) => {
  try {
    const { loginData, start, end, timezone } = req.body;
    const workDates = (
      await db.sequelize.query(
        "SELECT DATE(CONVERT_TZ(start, 'UTC', $timezone)) as work_date FROM clinical_staff_tasks AS t1 WHERE staff=$staff AND start<$end AND end>=$start GROUP BY work_date",
        {
          bind: { staff: loginData.id, start, end, timezone },
          type: QueryTypes.SELECT,
        }
      )
    ).map((record) => (record.work_date));

    res.json({ status: "OK", result: workDates });
  } catch (error) {
    console.error("Error doctorGetCalendar:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.addTask = async (req, res) => {
  try {
    const { loginData, start, end, description } = req.body;
    const task = db.ClinicalStaffTask.build({
      Staff: loginData.id,
      Status: 0,
      Start: start,
      End: end,
      Description: description,
    });

    await task.save();

    res.json({ status: "OK", result: task.id });
  } catch (error) {
    console.error("Error addTask:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.changeTask = async (req, res) => {
  try {
    const { loginData, id, status } = req.body;
    const task = await db.ClinicalStaffTask.findOne({
      where: { id },
    });
    task.Status = status;
    await task.save();

    res.json({ status: "OK" });
  } catch (error) {
    console.error("Error changeTask:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

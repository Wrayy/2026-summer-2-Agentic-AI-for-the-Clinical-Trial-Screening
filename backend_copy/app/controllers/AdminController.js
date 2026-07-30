const db = require("../../db");
const { Op, QueryTypes } = require("sequelize");

exports.getSystemStatus = async (req, res) => {
  try {
    const { loginData, start, end } = req.body;
    const [{ doctor_count }] = await db.sequelize.query("SELECT count(1) as doctor_count FROM doctors_registration", { type: QueryTypes.SELECT });
    const [{ patient_count }] = await db.sequelize.query("SELECT count(1) as patient_count FROM patients_registration", { type: QueryTypes.SELECT });
    const [{ clinical_staff_count }] = await db.sequelize.query("SELECT count(1) as clinical_staff_count FROM clinical_staff_registration", { type: QueryTypes.SELECT });
    const [{ hospital_count }] = await db.sequelize.query("SELECT count(1) as hospital_count FROM hospital_admin", { type: QueryTypes.SELECT });

    res.json({ status: "OK", result:{
      doctor_count,
      patient_count,
      clinical_staff_count,
      hospital_count,
    } });
  } catch (error) {
    console.error("Error getTasks:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const { loginData, start, end } = req.body;
    const result = await db.sequelize.query(
      "SELECT * FROM admin_tasks as t1 WHERE admin=$admin AND start<$end AND end>=$start",
      {
        bind: { admin: loginData.id, start, end },
        type: QueryTypes.SELECT,
      }
    );

    res.json({ status: "OK", result });
  } catch (error) {
    console.error("Error getTasks:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

exports.addTask = async (req, res) => {
  try {
    const { loginData, start, end, description } = req.body;
    const task = db.AdminTask.build({
      Admin: loginData.id,
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
    const task = await db.AdminTask.findOne({
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

exports.deleteTask = async (req, res) => {
  try {
    const { loginData, id } = req.body;
    const task = await db.AdminTask.findOne({
      where: { id },
    });
    await task.destroy();

    res.json({ status: "OK" });
  } catch (error) {
    console.error("Error deleteTask:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
};

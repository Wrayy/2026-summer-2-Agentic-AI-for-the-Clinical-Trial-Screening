const dbConfig = require("../../app/config/db.config");

const db = require("../../db");
const { QueryTypes } = require("sequelize");

exports.getContactUs = async (req, res) => {

  console.log("contact")

  try {
    const contact = await db.sequelize.query(
      "SELECT * FROM contact_us where contact_reply = 0 ORDER BY contact_time DESC",
      { type: QueryTypes.SELECT }
    );
    res.json(contact);
  } catch (error) {
    console.error("Error fetching contact:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getReviews = async (req, res) => {

  console.log("reviews")

  try {
    const reviews = await db.sequelize.query(
      "SELECT * FROM userreviews",
      { type: QueryTypes.SELECT }
    );
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


exports.getDocHelp = async (req, res) => {

  console.log("reviews")

  try {
    const reviews = await db.sequelize.query(
      "SELECT * FROM doctors_help where help_reply = 0 ORDER BY help_time DESC",
      { type: QueryTypes.SELECT }
    );
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


exports.getClinicHelp = async (req, res) => {

  console.log("reviews")

  try {
    const reviews = await db.sequelize.query(
      "SELECT * FROM clinic_help where help_reply = 0 ORDER BY help_time DESC",
      { type: QueryTypes.SELECT }
    );
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


exports.getJoinUs = async (req, res) => {

  console.log("reviews")

  try {
    const reviews = await db.sequelize.query(
      "SELECT * FROM join_us_request ORDER BY submit_time DESC",
      { type: QueryTypes.SELECT }
    );
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};



exports.getDocTaskStaff = async (req, res) => {

  console.log("reviews")

  try {
    const reviews = await db.sequelize.query(
      "SELECT * FROM doctor_task_request where check_status = 0 ORDER BY request_time DESC",
      { type: QueryTypes.SELECT }
    );
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};



exports.getPatientMessageStaff = async (req, res) => {

  console.log("reviews")

  try {
    const reviews = await db.sequelize.query(
      "SELECT * FROM message_pat_to_clinicalstaff ORDER BY time_stamp DESC",
      { type: QueryTypes.SELECT }
    );
    res.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};



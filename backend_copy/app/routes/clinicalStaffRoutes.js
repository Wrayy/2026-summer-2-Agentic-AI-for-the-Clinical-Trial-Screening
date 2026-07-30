const express = require("express");
const router = express.Router();

const clinicalStaffController = require("../controllers/ClinicalStaffController");

router.post("/getTasks", clinicalStaffController.getTasks);
router.post("/getMiniCalendar", clinicalStaffController.getMiniCalendar);
router.post("/addTask", clinicalStaffController.addTask);
router.post("/changeTask", clinicalStaffController.changeTask);

module.exports = router;

// app/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt-nodejs");
const login = require("../controllers/login");
const patientRegistration = require("../controllers/PatientRegistration");
const doctorRegistration = require("../controllers/DoctorRegistration");
const hospitalAdminRegistration = require("../controllers/HospitalAdminRegistration");
const labAdminRegistration = require("../controllers/LabAdminRegistration");
const labApp = require("../controllers/LabApp");
const ClinicalReasoning = require("../controllers/ClinicalReasoning");
const userController = require("../controllers/userController");
const contactController = require("../controllers/contactController");
const activeOnlineUser = require("../controllers/ActiveOnlineUser");
const inactiveUser = require("../controllers/InactiveUser");
const db = require("../../db_login");
const specialitiesController = require("../controllers/specialitiesController");
const TasksController = require("../controllers/TasksController");
const PatientPanelController = require("../controllers/PatientPanelController");


router.post("/ClinicalReasoning", (req, res) => {
  ClinicalReasoning.handelSubmit(req, res, db, bcrypt);
});

router.get("/getDoctors", userController.getDoctors);
router.post("/getPatientProfile", userController.getPatientProfile);
router.post("/getPatientPeriodicMeasurements", userController.getPatientPeriodicMeasurements);
router.post("/getPatientDoctor", userController.getPatientDoctor);
router.post("/setPatientProfile", userController.setPatientProfile);
router.post("/setPatientPassword", userController.setPatientPassword);
router.post("/getDoctorProfile", userController.getDoctorProfile);
router.post("/setDoctorProfile", userController.setDoctorProfile);
router.post("/setDoctorPassword", userController.setDoctorPassword);
router.get("/", userController.getAllUsers);
router.get("/patients", userController.getAllPatients);

router.post("/login", (req, res) => {
  login.handelLogin(req, res, db, bcrypt);
});
router.post("/PatientRegistration", (req, res) => {
  patientRegistration.handelSubmit(req, res, db, bcrypt);
});
router.post("/DoctorRegistration", (req, res) => {
  doctorRegistration.handelSubmit(req, res, db, bcrypt);
});
router.post("/HospitalAdminRegistration", (req, res) => {
  hospitalAdminRegistration.handelSubmit(req, res, db, bcrypt);
});
router.post("/LabAdminRegistration", (req, res) => {
  labAdminRegistration.handelSubmit(req, res, db, bcrypt);
});
router.post("/LabApp", (req, res) => {
  labApp.handelSubmit(req, res, db, bcrypt);
});
router.post("/activeOnlineUser", (req, res) => {
  activeOnlineUser.handelSubmit(req, res, db);
});
router.post("/inactiveUser", (req, res) => {
  inactiveUser.handelSubmit(req, res, db);
});
router.get("/specialities", specialitiesController.getAllSpecialities);
router.get("/contact", contactController.getContactUs);
router.get("/reviews", contactController.getReviews);
router.get("/doctorhelp", contactController.getDocHelp);
router.get("/clinichelp", contactController.getClinicHelp);
router.get("/joinus", contactController.getJoinUs);
router.get("/doctaskStaff", contactController.getDocTaskStaff);
router.get("/patientMessageStaff", contactController.getPatientMessageStaff);
router.get("/tasks", TasksController.getAllTasks);
router.get("/tasks/:id", TasksController.getTaskByPatientDetails);
router.get("/tasks/:FName", TasksController.getTaskByPatientDetails);
router.post("/tasks/add", TasksController.createTask);
router.put("/tasks/:id", TasksController.updateTask);
router.delete("/tasks/:id", TasksController.deleteTask);
router.post("/getPatientPortalInfoById", (req, res) => {
  PatientPanelController.getPatientPortalInfoById(req, res, db);
});
router.post("/raspberrySendData", (req, res) => {
  PatientPanelController.getDataFromRaspberry(req, res);
});

router.get("/getRaspberryData", PatientPanelController.getRaspberryData);
router.get("/readSerialPortData", PatientPanelController.readSerialPortData);
router.get("/PressureChartEvents", PatientPanelController.getPressureData);


router.post("/getPatientList", userController.getPatientList);
router.post("/getUnverifiedDoctors", userController.getUnverifiedDoctors);
router.post("/verifyDoctor", userController.verifyDoctor);
router.post("/getTickets", userController.getTickets);

router.post("/getClinicalTrialsList", userController.getClinicalTrialsList);
router.post("/getDetailedClinicalTrialsList", userController.getDetailedClinicalTrialsList);
router.post("/checkExistingClinicalTrialsId", userController.checkExistingClinicalTrialsId);
router.post("/getNextClinicalTrialId", userController.getNextClinicalTrialId);
router.post("/updateClinicalTrialStatus", userController.updateClinicalTrialStatus);
router.post("/createNewClinicalTrials", userController.createNewClinicalTrials);
router.post("/getSpecificClinicalTrialsInfo", userController.getSpecificClinicalTrialsInfo);

router.post("/getSpecificClinicalTrialsPatients", userController.getSpecificClinicalTrialsPatients);
router.post("/getSpecificClinicalTrialsInvitingPatients", userController.getSpecificClinicalTrialsInvitingPatients);
router.post("/getSpecificClinicalTrialsApplyingPatients", userController.getSpecificClinicalTrialsApplyingPatients);
router.post("/getSpecificClinicalTrialsMatchedPatients", userController.getSpecificClinicalTrialsMatchedPatients);
router.post("/getClinicalTrialsMatchedPatients", userController.getClinicalTrialsMatchedPatients);

router.post("/getPharmaceuticals_Notifications", userController.getPharmaceuticals_Notifications);
router.post("/updatePharmaceuticalsNotificationStatus", userController.updatePharmaceuticalsNotificationStatus);
router.post("/getPharmaceuticals_ActionsStatus", userController.getPharmaceuticals_ActionsStatus);
router.post("/getPharmaceuticals_DashboardSummary", userController.getPharmaceuticals_DashboardSummary);
router.post("/getPharmaceuticals_PatientSource", userController.getPharmaceuticals_PatientSource);
router.post("/PharmaceuticalsViewPatientProfile", userController.PharmaceuticalsViewPatientProfile);
router.post("/checkExistingActions", userController.checkExistingActions);
router.post("/PharmaceuticalsActionCreate", userController.PharmaceuticalsActionCreate);
router.post("/PharmaceuticalsRequestCreate", userController.PharmaceuticalsRequestCreate);
router.post("/getWebStaffActions", userController.getWebStaffActions);
router.post("/getPharmaceuticals_DetailedActions", userController.getPharmaceuticals_DetailedActions);
router.post("/getSyntheticData", userController.getSyntheticPatients);

router.post("/updateResponseReadStatus", userController.updateResponseReadStatus);
router.post("/updateRequestReadStatus", userController.updateRequestReadStatus);
router.post("/updateActionResponse", userController.updateActionResponse);
router.post("/MessageSend", userController.MessageSend);
router.post("/getMessagesByTypeAndId", userController.getMessagesByTypeAndId);
router.post("/MessageReadStatusUpdate", userController.MessageReadStatusUpdate);
module.exports = router;

const express = require("express");
const router = express.Router();

const appointmentController = require("../controllers/appointmentController");

router.post("/doctorGetCalendar", appointmentController.doctorGetCalendar);

router.post("/patientGetCalendar", appointmentController.patientGetCalendar);
router.post("/getTimeSegmentDetail", appointmentController.getTimeSegmentDetail);
router.post("/doctorCreateAvailableTimeSegment", appointmentController.doctorCreateAvailableTimeSegment);
router.post("/doctorApproveRequest", appointmentController.doctorApproveRequest);
router.post("/getAppointmentRequestId", appointmentController.getAppointmentRequestId);
router.post("/patientSearchForTimeSegments", appointmentController.patientSearchForTimeSegments);
router.post("/patientBookTime", appointmentController.patientBookTime);
router.post("/getDoctors", appointmentController.getDoctors);
router.post("/getPatients", appointmentController.getPatients);
router.post("/cancelAppointmentRequest", appointmentController.cancelAppointmentRequest);
router.post("/patientMainPageGetCalendar", appointmentController.patientMainPageGetCalendar);
router.post("/doctorGetRecentPatients", appointmentController.doctorGetRecentPatients);
router.post("/clinicalStaffGetRecentPatients", appointmentController.clinicalStaffGetRecentPatients);
router.post("/doctorGetMiniCalendar", appointmentController.doctorGetMiniCalendar);

router.post("/clinicalStaffGetDoctorCalendar", appointmentController.clinicalStaffGetDoctorCalendar);
router.post("/doctorGetTasks", appointmentController.doctorGetTasks);
router.post("/clinicalStaffCreateAvailableTimeSegment", appointmentController.clinicalStaffCreateAvailableTimeSegment);

module.exports = router;

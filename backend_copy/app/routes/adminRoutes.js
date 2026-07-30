const express = require("express");
const router = express.Router();

const adminController = require("../controllers/AdminController");

router.post("/getSystemStatus", adminController.getSystemStatus);

router.post("/getTasks", adminController.getTasks);
router.post("/addTask", adminController.addTask);
router.post("/changeTask", adminController.changeTask);
router.post("/deleteTask", adminController.deleteTask);

module.exports = router;

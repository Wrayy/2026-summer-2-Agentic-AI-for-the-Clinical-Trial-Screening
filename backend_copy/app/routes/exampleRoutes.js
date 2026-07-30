const express = require("express");
const router = express.Router();

const exampleController = require("../controllers/exampleController");

router.post("/test", exampleController.test);

module.exports = router;

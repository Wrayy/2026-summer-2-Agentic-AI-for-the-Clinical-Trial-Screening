var express = require("express");
var router = express.Router();
// var axios = require("axios");
var multer = require("multer");
var memoryStorage = multer.memoryStorage();
var upload = multer({ storage: memoryStorage });
var mysql = require("../models/dbConnection");
var models = require('../models/commonMethod');
// var fs = require("fs");
// var FormData = require("form-data");

var sql = "";

// ------------------------------ APIs Configuration ------------------------------

// This is a MongoDB import API
router.post("/imageUpload", upload.single("image"), async (req, res) => {
    const phoneNumber = req.body.phoneNumber; // patient phone number, e.g. "6131230000"
    const recordType = req.body.recordType; // the record type, e.g. "X-Ray", this represents the collection in the database (case sensitive)
    const recordDate = req.body.recordDate; // record date, e.g. "2023-03-01 09:00:00"

    // Check parameters
    if (!phoneNumber) {
        res.send({ error: "Missing patient phone number." });
        return;
    }
    if (!recordType || !recordDate) {
        res.send({ error: "Missing record type or record date." });
        return;
    }

    // Execute query
    sql = `SELECT id FROM patients_registration WHERE MobileNumber = "${phoneNumber}"`;
    try {
        result = await mysql.query(sql);
    } catch (error) {
        console.log(error);
        res.send({ error: "Something wrong in MySQL." });
        return;
    }

    // Check patient result
    if (result.length != 1) {
        res.send({ error: "No patient matched in database." });
        return;
    }

    let patient_id = result[0].id;

    const MongoResult = await models.imageUpload(
        patient_id,
        recordType,
        recordDate,
        req.file
    );
    res.send(MongoResult);
});

// This is the API for retrieving image from MongoDB by patient phone number
router.post("/imageRetrieveByPhoneNumber", async (req, res) => {
    const phoneNumber = req.body.phoneNumber; // patient phone number, e.g. "6131230000"
    const recordType = req.body.recordType; // the record type, e.g. "X-Ray", this represents the collection in the database (case sensitive)

    // Check parameters
    if (!phoneNumber) {
        res.send({ error: "Missing patient phone number." });
        return;
    }
    if (!recordType) {
        res.send({ error: "Missing record type." });
        return;
    }

    // Execute query
    sql = `SELECT id FROM patients_registration WHERE MobileNumber = "${phoneNumber}"`;
    try {
        result = await mysql.query(sql);
    } catch (error) {
        console.log(error);
        res.send({ error: "Something wrong in MySQL." });
        return;
    }

    // Check patient result
    if (result.length != 1) {
        res.send({ error: "No patient matched in database." });
        return;
    }

    let patient_id = result[0].id;

    const MongoResult = await models.imageRetrieveByPatientId(patient_id, recordType);
    res.send(MongoResult);
});

// This is the API for retrieving image from MongoDB by record id
router.post("/imageRetrieveByRecordId", async (req, res) => {
    const _id = req.body._id; // record id, e.g. "640b68a96d5b6382c0a3df4c"
    const recordType = req.body.recordType; // the record type, e.g. "X-Ray", this represents the collection in the database (case sensitive)

    // Check parameters
    if (!_id) {
        res.send({ error: "Missing record id." });
        return;
    }
    if (!recordType) {
        res.send({ error: "Missing record type." });
        return;
    }

    const MongoResult = await models.imageRetrieveByRecordId(_id, recordType);
    res.send(MongoResult);
});

// This is a connection testing api
router.post("/connectionTesting", upload.single("image"), (req, res) => {
    console.log("Request received by test api.");
    console.log(req.file);
    console.log(req.body);
    if (req.file) {
        res.send({
            prediction: "0",
            description: "File received by test api.",
            accuracy: "100%",
        });
    } else {
        res.send({
            prediction: "0",
            description: "Request received by test api.",
            accuracy: "100%",
        });
    }
});

// This API is for receiveing the basic info of the patient like age and gender.
router.post("/get_patientBasicHealthInfo", async (req, res) => {
    const phoneNumber = req.body.phoneNumber; // patient phone number, e.g. "6131230000"

    if (!phoneNumber) {
        res.send({ error: "Missing patient phone number" });
        return;
    }

    // Execute query
    sql = `SELECT Age, BloodGroup, Gender, height, weight FROM patients_registration WHERE MobileNumber = "${phoneNumber}"`;
    try {
        result = await mysql.query(sql);
    } catch (error) {
        console.log(error);
        res.send({ error: "Something wrong in MySQL." });
        return;
    }

    if (result.length != 1) {
        res.send({ error: "No patient matched in database." });
        return;
    }

    res.send({ success: result });
});

// This is the MySQL health test search API
router.post("/healthTestRetrieveByPhoneNumber", async (req, res) => {
    const phoneNumber = req.body.phoneNumber; // patient phone number, e.g. "6131230000"
    const recordType = req.body.recordType; // the record type, e.g. "ecg", this represents the table name in the database

    // Check parameters
    if (!phoneNumber) {
        res.send({ error: "Missing patient phone number." });
        return;
    }
    if (!recordType) {
        res.send({ error: "Missing record type." });
        return;
    }

    // Execute query
    sql = `SELECT id FROM patients_registration WHERE MobileNumber = "${phoneNumber}"`;
    try {
        result = await mysql.query(sql);
    } catch (error) {
        console.log(error);
        res.send({ error: "Something wrong in MySQL." });
        sql.close();
        return;
    }

    // Check patient result
    if (result.length != 1) {
        res.send({ error: "No patient matched in database." });
        return;
    }

    let patient_id = result[0].id;

    // Execute query
    sql = `SELECT * FROM ${recordType} WHERE patient_id = "${patient_id}" ORDER BY RecordDate DESC`;
    try {
        result = await mysql.query(sql);
    } catch (error) {
        console.log(error);
        res.send({ error: "Something wrong in MySQL." });
        return;
    }

    // Remove sensitive column
    let temp = models.removeKey(result, "patient_id");
    res.send({ success: temp });
});

// This API is for updating the ML prediction result to the database.
router.post("/updateDisease", async (req, res) => {
    const phoneNumber = req.body.phoneNumber; // the patient phone number, e.g. "6131230000"
    const disease = req.body.disease; // the name of the disease, e.g. "pneumonia"
    const date = req.body.date; // the prediction date, e.g. "2023-03-01 09:00:00"
    const prediction = req.body.prediction; // the prediction result, "1" if disease, "0" otherwise
    const description = req.body.description; // more description of this disease, like the subtype of this disease.
    const accuracy = req.body.accuracy; // prediction accuracy, e.g. "90%"
    const recordType = req.body.recordType; // the type of the health test, e.g. "X-Ray" or "ecg"
    const recordId = req.body.recordId; // the id of the health test, e.g. "12", "640b68a96d5b6382c0a3df4c"

    if (!phoneNumber || !disease || !date || !prediction) {
        res.send({
            error: "Missing patient phone number, disease, date, or prediction.",
        });
        return;
    }

    // Execute query
    sql = `SELECT id FROM patients_registration WHERE MobileNumber = "${phoneNumber}"`;
    try {
        result = await mysql.query(sql);
    } catch (error) {
        console.log(error);
        res.send({ error: "Something wrong in MySQL." });
        return;
    }

    // Check patient result;
    if (result.length != 1) {
        res.send({ error: "No patient matched in database." });
        return;
    }

    let patient_id = result[0].id;

    // Execute query
    sql = `INSERT into ${disease} (patient_id, prediction_date, prediction, description, accuracy, record_type, record_id)
    VALUES (${patient_id}, "${date}", "${prediction}", ${description ? '"' + description + '"' : "NULL"
        }, ${accuracy ? '"' + accuracy + '"' : "NULL"}, ${recordType ? '"' + recordType + '"' : "NULL"
        }, ${recordId ? '"' + recordId + '"' : "NULL"})
    ON DUPLICATE KEY 
    UPDATE prediction_date = "${date}", 
    prediction = "${prediction}",
    description = ${description ? '"' + description + '"' : "NULL"},
    accuracy = ${accuracy ? '"' + accuracy + '"' : "NULL"},
    record_type = ${recordType ? '"' + recordType + '"' : "NULL"},
    record_id = ${recordId ? '"' + recordId + '"' : "NULL"};`;
    try {
        result = await mysql.query(sql);
    } catch (error) {
        console.log(error);
        res.send({ error: "Something wrong in MySQL." });
        return;
    }
    res.send({ success: "Submit success." });
});

// API for symptoms checker
router.get("/get_symptoms_checker", (req, res) => {
    let sqlDB = mysql.connect();
    sql = "SELECT * FROM symptoms_checker";
    sqlDB.query(sql, (error, result) => {
        if (error) {
            res.send({ error: "Something wrong in MySQL." });
            console.log(error);
            return;
        }
        res.send({ success: result });
    });
    sqlDB.end();
});

module.exports = router;
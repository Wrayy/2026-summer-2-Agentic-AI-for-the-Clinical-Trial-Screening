// Default dotenv does NOT override existing env vars — a stale machine-level
// OPENAI_API_KEY (e.g. old/revoked key) would win over .env. Local .env should win.
require("dotenv").config({ override: true });

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const app = express();
const userRoutes = require("./app/routes/userRoutes");
const appointmentRoutes = require("./app/routes/appointmentRoutes");

const exampleRoutes = require("./app/routes/exampleRoutes");
const diagnostic = require("./app/controllers/diagnostic");
const chatRoutes = require("./app/routes/chatRouter");
const adminRoutes = require("./app/routes/adminRoutes");
const clinicalStaffRoutes = require("./app/routes/clinicalStaffRoutes");
const clinicalTrialPocRoutes = require("./app/routes/clinicalTrialPocRoutes");
const session = require("express-session");
const { QueryTypes } = require("sequelize");

const expressWs = require("express-ws");
const multer = require("multer");
var jsonParser = bodyParser.json();

const path = require("path");

const axios = require("axios");
const FormData = require("form-data");

const corsOptions = {
  origin: [
    '*',
    'https://www.e-hospital.ca',
    'https://e-hospital.ca',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://e-react-frontend-55dbf7a5897e.herokuapp.com'
  ],
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
};
var mysql = require("./app/models/dbConnection");
const db = require("./db");

var models = require("./app/models/commonMethod");
const mongodbConfig = require("./app/config/mongodb.config");
const uri = mongodbConfig.uri;
const { MongoClient } = require("mongodb");
const client = mongodbConfig.disabled
  ? {
      db() {
        throw new Error("MongoDB is disabled for local clinical trial POC development.");
      },
    }
  : new MongoClient(uri);
app.use(cors(corsOptions));
expressWs(app);

app.use(
  session({
    secret: "eHospital",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 3600,
      secure: false,
    },
  })
);

// app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/users", userRoutes); // Mount user routes
app.use("/api/appointments", appointmentRoutes); // Mount appointment routes
app.use("/api/admin", adminRoutes);
app.use("/api/clinicalStaff", clinicalStaffRoutes);
app.use("/api/clinical-trial-poc", clinicalTrialPocRoutes);
app.use("/api/example", exampleRoutes);
app.use("/api/diagnostic", diagnostic);

db.sequelize
  .authenticate()
  .then(() => {
    console.log("Database connection has been established successfully.");
    console.log(db.sequelize.config.host);
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

// Move the root route handler outside the database connection block
app.get("/", (req, res) => {
  res.send("Welcome to your server!");
});

app.use("/api/users", userRoutes); // Mount user routes
app.use("/api/chat", chatRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

//New Api's start from here

app.post("/getInsomniaData", async (req, res) => {
  const patientId = req.body.patient_id;

  // Check parameters
  if (!patientId) {
    res.status(400).json({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  const sql = `SELECT * FROM insomnia WHERE patient_id = "${patientId}"`;
  let result;
  try {
    result = await mysql.query(sql);
    console.log("result", result);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.status(500).json({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result && result.length != 1) {
    res.status(404).json({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  res.send(result);
});

app.post("/getHeartDiseaseData", async (req, res) => {
  const patientId = req.body.patient_id;
  const table = req.body.tableName;

  // Check parameters
  if (!patientId) {
    res.status(400).json({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  const sql = `SELECT * FROM ${table} WHERE patient_id = "${patientId}"`;
  let result;
  try {
    result = await mysql.query(sql);
    console.log("result", result);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.status(500).json({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result && result.length != 1) {
    res.status(404).json({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  res.send(result);
});

app.post("/getEpilepticSeizureData", async (req, res) => {
  const patientId = req.body.patient_id;

  // Check parameters
  if (!patientId) {
    res.status(400).json({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  const sql = `SELECT X FROM epileptic_seizure WHERE patient_id = "${patientId}"`;
  let result;
  try {
    result = await mysql.query(sql);
    console.log("result", result);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.status(500).json({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result && result.length != 1) {
    res.status(404).json({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  res.send(result);
});

//getDieasePrognosisData
app.post("/getDieasePrognosisData", async (req, res) => {
  const patientId = req.body.patient_id;

  // Check parameters
  if (!patientId) {
    res.status(400).json({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  const sql = `SELECT * FROM prognosis_disease WHERE patient_id = "${patientId}"`;
  let result;
  try {
    result = await mysql.query(sql);
    console.log("result", result);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.status(500).json({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result && result.length != 1) {
    res.status(404).json({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  res.send(result);
});

app.post("/getDiabetesPrognosisData", async (req, res) => {
  const patientId = req.body.patient_id;

  // Check parameters
  if (!patientId) {
    res.status(400).json({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  const sql = `SELECT * FROM diabetes_win2024 WHERE patient_id = "${patientId}"`;
  let result;
  try {
    result = await mysql.query(sql);
    console.log("result", result);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.status(500).json({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result && result.length != 1) {
    res.status(404).json({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  res.send(result);
});

app.post("/geRheumatoidArthritisData", async (req, res) => {
  const patientId = req.body.patient_id;

  // Check parameters
  if (!patientId) {
    res.status(400).json({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  const sql = `SELECT * FROM rheumatoid_arthritis WHERE patient_id = "${patientId}"`;
  let result;
  try {
    result = await mysql.query(sql);
    console.log("result", result);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.status(500).json({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result && result.length != 1) {
    res.status(404).json({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  res.send(result);
});

app.post("/getCoronaryDiseaseData", async (req, res) => {
  const patientId = req.body.patient_id;

  // Check parameters
  if (!patientId) {
    res.status(400).json({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  const sql = `SELECT * FROM coronary_artery_disease_angina WHERE patient_id = "${patientId}"`;
  let result;
  try {
    result = await mysql.query(sql);
    console.log("result", result);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.status(500).json({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result && result.length != 1) {
    res.status(404).json({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  res.send(result);
});

app.post("/getSclerosisDiseaseData", async (req, res) => {
  const patientId = req.body.patient_id;

  // Check parameters
  if (!patientId) {
    res.status(400).json({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  const sql = `SELECT * FROM multiple_sclerosis_disease WHERE patient_id = "${patientId}"`;
  let result;
  try {
    result = await mysql.query(sql);
    console.log("result", result);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.status(500).json({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result && result.length != 1) {
    res.status(404).json({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  res.send(result);
});

// This is the API to get the kidney failure test input data from MySQL
app.post("/getKindeyFailureData", async (req, res) => {
  const patientId = req.body.patient_id;

  // Check parameters
  if (!patientId) {
    res.status(400).json({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  const sql = `SELECT * FROM kidney_failure WHERE patient_id = "${patientId}"`;
  let result;
  try {
    result = await mysql.query(sql);
    console.log("result", result);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.status(500).json({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result && result.length != 1) {
    res.status(404).json({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  res.send(result);
});

//shake waseef code
app.get("/skinCancerData/:id", async (req, res) => {
  const id = req.params.id;
  const db = client.db("htdata");
  const collection = db.collection("Skin_Images");
  try {
    const result = await collection.findOne({ patient_id: parseInt(id) });
    res.send(result);
  } catch (err) {
    res.send("Error retrieving data by id");
  }
});

app.get("/skinDiseasesData/:id", async (req, res) => {
  const id = req.params.id;
  const db = client.db("htdata");
  const collection = db.collection("Skin_Diseases");
  try {
    const result = await collection.findOne({ patient_id: parseInt(id) });
    res.send(result);
  } catch (err) {
    res.send("Error retrieving data by id");
  }
});

app.post("/skinCancerData/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { prediction } = req.body;
    const db = client.db("htdata");
    const collection = db.collection("Skin_Images");
    const filter = {
      patient_id: parseInt(id),
    };

    const updateDoc = {
      $set: {
        prediction: prediction,
      },
    };

    const result = await collection.updateOne(filter, updateDoc);

    if (result.modifiedCount === 1) {
      res.send("Document updated successfully.");
    } else {
      res.send("Document not found or not updated.");
    }
  } catch (err) {
    res.send(err);
  }
});

app.post("/skinDiseasesData/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { prediction } = req.body;
    const db = client.db("htdata");
    const collection = db.collection("Skin_Diseases");
    const filter = {
      patient_id: parseInt(id),
    };

    const updateDoc = {
      $set: {
        prediction: prediction,
      },
    };

    const result = await collection.updateOne(filter, updateDoc);

    if (result.modifiedCount === 1) {
      res.send("Document updated successfully.");
    } else {
      res.send("Document not found or not updated.");
    }
  } catch (err) {
    res.send(err);
  }
});

//Adeeb's code

app.get("/pneumoniaData/:id", async (req, res) => {
  const id = req.params.id;
  const db = client.db("htdata");
  const collection = db.collection("X-Ray_Chest");
  try {
    const result = await collection.findOne({ patient_id: parseInt(id) });
    res.send(result);
  } catch (err) {
    res.send("Error retrieving data by id");
  }
});

app.post("/pneumoniaData/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { prediction } = req.body;
    const db = client.db("htdata");
    const collection = db.collection("X-Ray_Chest");
    const filter = {
      patient_id: parseInt(id),
    };

    const updateDoc = {
      $set: {
        prediction: prediction,
      },
    };

    const result = await collection.updateOne(filter, updateDoc);

    if (result.modifiedCount === 1) {
      res.send("Document updated successfully.");
    } else {
      res.send("Document not found or not updated.");
    }
  } catch (err) {
    res.send(err);
  }
});

// Bone cancer code

app.get("/boneData/:id", async (req, res) => {
  const id = req.params.id;
  const db = client.db("htdata");
  const collection = db.collection("X-Ray_Feet");
  try {
    const result = await collection.findOne({ patient_id: parseInt(id) });
    res.send(result);
  } catch (err) {
    res.send("Error retrieving data by id");
  }
});

app.post("/boneData/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { prediction } = req.body;
    const db = client.db("htdata");
    const collection = db.collection("X-Ray_Feet");
    const filter = {
      patient_id: parseInt(id),
    };

    const updateDoc = {
      $set: {
        prediction: prediction,
      },
    };

    const result = await collection.updateOne(filter, updateDoc);

    if (result.modifiedCount === 1) {
      res.send("Document updated successfully.");
    } else {
      res.send("Document not found or not updated.");
    }
  } catch (err) {
    res.send(err);
  }
});

app.post("/searchpatient", (req, res) => {
  const phoneNumber = req.body.phoneNumber; // patient phone number, e.g. "6131230000"
  //console.log("in node searchpatient post api you searched for ",phoneNumber);
  // Check patient identity
  if (!phoneNumber) {
    res.send({ error: "Missing patient phone number" });
    return;
  }
  var patient_id = 0;
  var check_list = [];
  let sqlDB = mysql.connect();
  sql = `
      SELECT *
      FROM patients_registration 
      WHERE MobileNumber = "${phoneNumber}"
  `;
  console.log(sql);
  sqlDB.query(sql, (error, result) => {
    if (error) {
      res.send({ error: "Something wrong in MySQL." });
      console.log("Something wrong in MySQL");
      sqlDB.end();
      return;
    }
    if (result.length != 1) {
      check_list[0] = 1;
      // res.render('pages/searchpatient', {check:check_list});
      res.send({ error: "No patient matched in database." });

      return;
    }
    patient_id = result[0].id;
    sql_search_query = `SELECT * FROM patients_registration WHERE id = "${patient_id}"`;
    let sqlDB = mysql.connect();
    sqlDB.query(sql_search_query, function (err, result) {
      if (err) throw err;

      ///res.render() function
      // res.send(result.id);
      res.json(result[0]);
      console.log(result[0]);
    });
    sqlDB.end();

    //console.log(sql_search_query);
  });
  sqlDB.end();
});

app.post("/searchPatientById", (req, res) => {
  const patientId = req.body.patientId;
  if (!patientId) return res.status(400).json({ error: "Missing patient ID" });

  const sql_search_query = "SELECT * FROM patients_registration WHERE id = ?";
  const sqlParams = [patientId];

  const sqlDB = mysql.connect();
  sqlDB.query(sql_search_query, sqlParams, (err, result) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ error: "Database query error" });
    }

    if (result.length > 0) {
      res.json(result[0]);
      console.log("Query result:", result[0]);
    } else {
      res.status(404).json({ error: "No matching patient found" });
      console.log("No matching patient found");
    }
  });

  sqlDB.end();
});

// This is the API for retrieving image from MongoDB by patient phone number
app.post("/imageRetrieveByPhoneNumber", async (req, res) => {
  const phoneNumber = req.body.phoneNumber; // patient phone number, e.g. "6131230000"
  const recordType = req.body.recordType; // the record type, e.g. "X-Ray", this represents the collection in the database (case sensitive)

  // Check parameters
  if (!phoneNumber) {
    res.send({ error: "Missing patient phone number." });
    console.log("Missing patient phone number.");
    return;
  }
  if (!recordType) {
    res.send({ error: "Missing record type." });
    console.log("Missing record type.");

    return;
  }

  // Execute query
  sql = `SELECT id FROM patients_registration WHERE MobileNumber = "${phoneNumber}"`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result.length != 1) {
    res.send({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  let patient_id = result[0].id;

  const MongoResult = await models.imageRetrieveByPatientId(
    patient_id,
    recordType
  );
  res.send(MongoResult);
});

// This is the API for retrieving image from MongoDB by record id
app.post("/imageRetrieveByRecordId", async (req, res) => {
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

// This API is for updating the ML prediction result to the database.
app.post("/updateDisease", async (req, res) => {
  const phoneNumber = req.body.phoneNumber; // the patient phone number, e.g. "6131230000" also we can use 6131230016
  const disease = req.body.disease; // the name of the disease, e.g. "pneumonia"
  const date = req.body.date; // the prediction date, e.g. "2023-03-01 09:00:00"
  const prediction = req.body.prediction; // the prediction result, "1" if disease, "0" otherwise
  const description = req.body.description; // more description of this disease, like the subtype of this disease.
  const accuracy = req.body.accuracy; // prediction accuracy, e.g. "90%"
  const recordType = req.body.recordType; // the type of the health test, e.g. "X-Ray" or "ecg"
  const recordId = req.body.recordId; // the id of the health test, e.g. "12", "640b68a96d5b6382c0a3df4c"

  if (!phoneNumber || !disease || !date || !description) {
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
//--
//API to get physicaltestckdata by patient_id
app.post("/getPhysicaltestCK", async (req, res) => {
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }
  // Execute query
  sql = `SELECT * FROM physical_test_ck
            WHERE patient_id = "${patientID}" 
            order by RecordDate desc limit 1`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  // Check patient result
  if (result.length <= 0) {
    console.log("No patient matched in database.");
    res.send({ error: "No patient matched in database." });
    return;
  }
  const response_for_request = {
    record_id: result[0].id,
    record_date: result[0].RecordDate,
    data: [
      result[0].age,
      result[0].blood_pressure,
      result[0].specific_gravity,
      result[0].albumin,
      result[0].sugar,
      result[0].red_blood_cells,
      result[0].pus_cell,
      result[0].pus_cell_clumps,
      result[0].bacteria,
      result[0].blood_glucose_random,
      result[0].blood_urea,
      result[0].serum_creatinine,
      result[0].sodium,
      result[0].potassium,
      result[0].haemoglobin,
      result[0].packed_cell_volume,
      result[0].white_blood_cell_count,
      result[0].red_blood_cell_count,
      result[0].hypertension,
      result[0].diabetes_mellitus,
      result[0].coronary_artery_disease,
      result[0].appetite,
      result[0].peda_edema,
      result[0].aanemia,
    ],
  };
  console.log(response_for_request);
  res.json(response_for_request);
});
//----
//top_five_recent_patients_per_doctor
app.post("/TopFiveRecentPatients", async (req, res) => {
  // console.log("got here here");
  const doctorID = req.body.doctorId;
  if (!doctorID) {
    res.send({ error: "Missing Doctor ID." });
    console.log("Missing Doctor ID.");
    return;
  }
  //query
  sql = `SELECT P.id, 
                P.Fname AS PatientFName, 
                P.LName AS PatientLName, 
                DSRecent.service_date
                FROM patients_registration AS P
                JOIN (
                SELECT DS.patient_id, 
                      MAX(DS.service_date) AS service_date
                FROM doctor_servicehistory AS DS
                WHERE DS.doctor_id = "${doctorID}"
                GROUP BY DS.patient_id
                ORDER BY MAX(DS.service_date) DESC
                LIMIT 10
                ) AS DSRecent ON P.id = DSRecent.patient_id;
                `;
  //execute
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  if (result.length == 0) {
    res.send({ error: "No records found." });
    return;
  }
  res.json(result);
});

//----
//Patients_authorized_per_doctor
app.post("/DoctorPatientsAuthorized", async (req, res) => {
  //console.log("docrecordauthorized");
  const doctorID = req.body.doctorId;
  if (!doctorID) {
    res.send({ error: "Missing Doctor ID." });
    console.log("Missing Doctor ID.");
    return;
  }
  //query
  sql = `
          select DA.patient_id as id, P.FName, P.LName, P.MobileNumber, substr(P.MName,1,1) as MI, 
          P.Age, P.Gender, P.weight
          from  doctor_recordauthorized  as DA,  patients_registration as P
          where DA.doctor_id = "${doctorID}" and DA.patient_id = P.id;`;
  //execute
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  if (result.length == 0) {
    res.send({ error: "No records found." });
    return;
  }
  res.json(result);
});


app.post("/findClinicStaffsByDoctorId", async (req, res) => {
  const doctorId = req.body.doctorId;
  if (!doctorId) {
    res.send({ error: "Missing Doctor ID." });
    console.log("Missing Doctor ID.");
    return;
  }

  // Query to find clinic staff using doctorId
  const sql_find_clinic_staffs = `
    SELECT csr.*
    FROM clinical_staff_registration csr
    WHERE csr.associate_doctor_id = ${doctorId}
  `;

  let clinicStaffs;
  try {
    clinicStaffs = await mysql.query(sql_find_clinic_staffs);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }

  if (clinicStaffs.length === 0) {
    res.send({ error: "No clinic staff found for the given Doctor ID." });
    return;
  }

  res.json(clinicStaffs);
});

app.post("/findPatientsByClinicStaffId", async (req, res) => {
  const clinicId = req.body.clinicId;
  if (!clinicId) {
    res.send({ error: "Missing Clinic ID." });
    console.log("Missing Clinic ID.");
    return;
  }

  // Single query to find patient_ids using clinicId
  const sql_find_patients = `
    SELECT pd.patient_id, CONCAT(pr.FName, ' ', pr.MName, ' ', pr.LName) AS full_name
    FROM patient_doctor pd
    JOIN clinical_staff_registration csr ON pd.doctor_id = csr.associate_doctor_id
    JOIN patients_registration pr ON pd.patient_id = pr.id
    WHERE csr.id = ${clinicId}
  `;

  let patients;
  try {
    patients = await mysql.query(sql_find_patients);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }

  if (patients.length === 0) {
    res.send({ error: "No patients found for the given Clinic ID." });
    return;
  }

  res.json(patients);
});

app.post("/findDoctorsByPatientId", async (req, res) => {
  //console.log("docrecordauthorized");
  const patientId = req.body.patientId;
  if (!patientId) {
    res.send({ error: "Missing Doctor ID." });
    console.log("Missing Doctor ID.");
    return;
  }
  //query
  sql = `SELECT dr.*
  FROM doctors_registration dr
  JOIN patient_doctor pd ON dr.id = pd.doctor_id
  WHERE pd.patient_id = ${patientId}`;
  //execute
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  if (result.length == 0) {
    res.send({ error: "No records found." });
    return;
  }
  res.json(result);
});
//---------------------Thyroid Disease API ------------------------
app.post("/getThyroidDiseaseData", async (req, res) => {
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  let sql = `SELECT * FROM thyroid_disease 
            WHERE id = "${patientID}" 
            order by id desc limit 1`; // Assuming you have a field to order by. Adjust if needed.

  let result;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result.length <= 0) {
    res.send({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  const response_for_request = {
    record_id: result[0].id,
    data: {
      age: result[0].age,
      sex: result[0].sex,
      TSH: result[0].TSH,
      T3: result[0].T3,
      T4U: result[0].T4U,
      FTI: result[0].FTI,
      onthyroxine: result[0].onthyroxine,
      queryonthyroxine: result[0].queryonthyroxine,
      onantithyroidmedication: result[0].onantithyroidmedication,
      sick: result[0].sick,
      pregnant: result[0].pregnant,
      thyroidsurgery: result[0].thyroidsurgery,
      I131treatment: result[0].I131treatment,
      queryhypothyroid: result[0].queryhypothyroid,
      queryhyperthyroid: result[0].queryhyperthyroid,
      lithium: result[0].lithium,
      goitre: result[0].goitre,
      tumor: result[0].tumor,
      hypopituitary: result[0].hypopituitary,
      psych: result[0].psych,
      //result: result[0].result
    },
  };

  console.log(response_for_request);
  res.json(response_for_request);
});

//--- Important Info for doctor profile
//Patients_authorized_per_doctor
app.post("/DoctorProfileInfo", async (req, res) => {
  //console.log("docrecordauthorized");
  const doctorID = req.body.doctorId;
  if (!doctorID) {
    res.send({ error: "Missing Doctor ID." });
    console.log("Missing Doctor ID.");
    return;
  }
  //query
  sql = `
    SELECT a.*, 
    COUNT(b.patient_id) AS active_patients
    FROM doctors_registration AS a
    JOIN doctor_recordauthorized AS b ON a.id = b.doctor_id
    WHERE a.id = ${doctorID} `;
  //execute
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  if (result.length == 0) {
    res.send({ error: "No records found." });
    return;
  }
  res.json(result[0]);
});
//---Ending  DocProfile

//PatientProfileInfo
app.post("/PatientProfileInfo", async (req, res) => {
  //console.log("docrecordauthorized");
  const patientID = req.body.patientId;
  if (!patientID) {
    res.send({ error: "Missing Patient ID." });
    console.log("Missing Patient ID.");
    return;
  }
  //query
  sql = `
    SELECT a.*
    FROM patients_registration AS a
    WHERE a.id = ${patientID} `;
  //execute
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  if (result.length == 0) {
    res.send({ error: "No records found." });
    return;
  }
  res.json(result[0]);
});


app.post("/ClinicStaffProfileInfo", async (req, res) => {
  const clinicStaffId = req.body.clinicStaffId;
  if (!clinicStaffId) {
    res.send({ error: "Missing Clinic Staff ID." });
    console.log("Missing Clinic Staff ID.");
    return;
  }

  // Query to get clinic staff profile info using clinicStaffId
  const sql = `
    SELECT * 
    FROM clinical_staff_registration 
    WHERE id = ${clinicStaffId}
  `;

  let result;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }

  if (result.length === 0) {
    res.send({ error: "No records found." });
    return;
  }

  res.json(result[0]);
});


//---------------------Breast cancer API start------------------------
app.post("/getBreastCancerData", (req, res) => {
  console.log(req);

  const patient_id = req.body.patient_id; // patient id, e.g. "133"

  // Check patient identity
  if (!patient_id) {
    res.send({ error: "Missing patient id" });
    return;
  }
  var check_list = [];
  let sqlDB = mysql.connect();
  sql = `
      SELECT *
      FROM breast_cancer_details 
      WHERE patient_id = "${patient_id}"
  `;
  console.log(sql);
  sqlDB.query(sql, (error, result) => {
    if (error) {
      res.send({ error: "Something wrong in MySQL." });
      console.log("Something wrong in MySQL");
      return;
    }
    if (result.length != 1) {
      check_list[0] = 1;
      res.send({ error: "No patient matched in database." });
      return;
    }

    res.json(result[0]);
    console.log(result[0]);
  });
  sqlDB.end();
});
//---------------------Breast cancer API end ------------------------
/**
 * Heart Stroke Data Endpoint
 **/
app.get("/heartstroke/:patientId", async (req, res, nxt) => {
  const { patientId } = req.params;

  strokesql = `SELECT * FROM heart_stroke
          WHERE patient_id = "${patientId}" 
          limit 1`;

  patientsql = `SELECT Gender as gender, Age as age FROM patients_registration
          WHERE id = "${patientId}" 
          limit 1`;

  let strokeData = null;
  let patientData = null;
  try {
    strokeData = await mysql.query(strokesql);
    patientData = await mysql.query(patientsql);
  } catch (error) {
    return res.status(500).send({ error: "Something wrong in MySQL" });
  }

  if (!strokeData || !patientData) {
    return res.status(404).send({ error: "No patient matched in database." });
  }

  return res.json({ ...strokeData[0], ...patientData[0] });
});

/**
 * Heart Stroke Data Endpoint ends
 **/

// ------------------- Brain Stroke Data Endpoint -------------------------//
app.get("/brainstroke/:patientId", async (req, res, nxt) => {
  const { patientId } = req.params;

  strokesql = `SELECT * FROM brain_stroke
          WHERE patient_id = "${patientId}" 
          limit 1`;

  patientsql = `SELECT Gender as gender, Age as age FROM patients_registration
          WHERE id = "${patientId}" 
          limit 1`;

  let strokeData = null;
  let patientData = null;
  try {
    strokeData = await mysql.query(strokesql);
    patientData = await mysql.query(patientsql);
  } catch (error) {
    return res.status(500).send({ error: "Something wrong in MySQL" });
  }

  if (!strokeData || !patientData) {
    return res.status(404).send({ error: "No patient matched in database." });
  }

  return res.json({ ...strokeData[0], ...patientData[0] });
});

// ------------------- Heart Fail Data Endpoint -------------------------//
app.get("/heartfailure/:patientId", async (req, res, nxt) => {
  const { patientId } = req.params;

  strokesql = `SELECT * FROM heart_failure
          WHERE patient_id = "${patientId}" 
          limit 1`;

  patientsql = `SELECT Gender as gender, Age as age FROM patients_registration
          WHERE id = "${patientId}" 
          limit 1`;

  let strokeData = null;
  let patientData = null;
  try {
    strokeData = await mysql.query(strokesql);
    patientData = await mysql.query(patientsql);
  } catch (error) {
    return res.status(500).send({ error: "Something wrong in MySQL" });
  }

  if (!strokeData || !patientData) {
    return res.status(404).send({ error: "No patient matched in database." });
  }

  return res.json({ ...strokeData[0], ...patientData[0] });
});

// -------------------Liver Preidiction API -------------------------//
app.post("/liver_disease", async (req, res) => {
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }
  // Execute query
  sql = `SELECT * FROM liver_disease
            WHERE patients_id = "${patientID}" 
            order by recordtime desc limit 1`;

  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL---.");
    res.send({ error: "Something wrong in MySQL---." });
    return;
  }
  // Check patient result
  if (result.length <= 0) {
    res.send({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }
  const response_for_request = {
    record_id: result[0].patients_id,
    record_date: result[0].recordtime,
    data: [
      result[0].custom_age,
      result[0].Total_Bilirubin,
      result[0].Direct_Bilirubin,
      result[0].Alkaline_Phosphotase,
      result[0].Alamine_Aminotransferase,
      result[0].Aspartate_Aminotransferase,
      result[0].Total_Protiens,
      result[0].Albumin,
      result[0].Albumin_and_Globulin_Ratio,
      result[0].Gender_Female,
      result[0].Gender_Male,
    ],
  };
  console.log(response_for_request);
  res.json(response_for_request);
});

//-----------contact us API start---------------------
app.post("/contact", async (req, res) => {
  const { formData } = req.body;
  const contact_name = formData.contactName.trim();
  const contact_phone = formData.contactPhone.trim();
  const contact_email = formData.contactEmail.trim();
  const contact_topic = formData.contactTopic.trim();
  const contact_message = formData.contactMessage.trim();
  const table_name = "contact_us";

  // Execute query
  sql = `INSERT into ${table_name} (contact_name, contact_phone, contact_email, contact_topic, contact_message, contact_reply)
  VALUES ("${contact_name}", "${contact_phone}", ${contact_email ? '"' + contact_email + '"' : "NULL"
    }, "${contact_topic}", ${contact_message ? '"' + contact_message + '"' : "NULL"
    }, 0)
  ON DUPLICATE KEY 
  UPDATE contact_name = "${contact_name}", 
  contact_phone = "${contact_phone}",
  contact_email = ${contact_email ? '"' + contact_email + '"' : "NULL"},
  contact_topic = ${contact_topic ? '"' + contact_topic + '"' : "NULL"},
  contact_message = ${contact_message ? '"' + contact_message + '"' : "NULL"},
  contact_reply = 0;`;
  try {
    result = await mysql.query(sql);
    /*
    //sending SMS message to remind using twilio.
    const accountSid = '';
    const authToken = '';
    const client = require('twilio')(accountSid, authToken);

    client.messages
      .create({
        body: 'A new request is waiting for response, please check detail on the eHospital website.',
        from: '+',
        to: '+'
      })
      .then(message => console.log(message.sid))
      .done();
      */
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

app.post("/contactCheck", async (req, res) => {
  const id = req.body.id;

  sql = `UPDATE contact_us SET contact_reply = 1 WHERE id = ${id};`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

//------------contact us API end ---------------------

//-----------join us API start---------------------
app.post("/joinUs", async (req, res) => {
  const { formData } = req.body;
  const fName = formData.fName.trim();
  const lName = formData.lName.trim();
  const Email = formData.Email.trim();
  const Phone = formData.Phone.trim();
  const Address = formData.Address.trim();
  const Specialty = formData.Specialty.trim();
  const License = formData.License.trim();
  const contactMessage = formData.contactMessage.trim();
  const table_name = "join_us_request";

  // Execute query
  sql = `INSERT into ${table_name} (fName, lName, phone, email, specialty, working_address,
    certificate_num, note, receive, verify)
  VALUES ("${fName}", "${lName}","${Phone}", ${Email ? '"' + Email + '"' : "NULL"
    },
   ${Specialty ? '"' + Specialty + '"' : "NULL"},
   ${Address ? '"' + Address + '"' : "NULL"},
   ${License ? '"' + License + '"' : "NULL"},
   ${contactMessage ? '"' + contactMessage + '"' : "NULL"},
   0, 0)
  ON DUPLICATE KEY 
  UPDATE fName = "${fName}", 
  lName = "${lName}",
  phone = "${Phone}",
  email = ${Email ? '"' + Email + '"' : "NULL"},
  specialty = ${Specialty ? '"' + Specialty + '"' : "NULL"},
  working_address = ${Address ? '"' + Address + '"' : "NULL"},
  certificate_num  = ${License ? '"' + License + '"' : "NULL"},
  note =  ${contactMessage ? '"' + contactMessage + '"' : "NULL"},
  receive = 0, verify = 0;`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

app.post("/joinReceive", async (req, res) => {
  const id = req.body.id;

  sql = `UPDATE join_us_request SET receive = 1 WHERE id = ${id};`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

app.post("/joinVerify", async (req, res) => {
  const id = req.body.id;

  sql = `UPDATE join_us_request SET verify = 1 WHERE id = ${id};`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

//------------Join Us API end ---------------------

//-----------doctor help API start---------------------
app.post("/doctorhelp", async (req, res) => {
  const { formData } = req.body;
  const help_name = formData.helpName.trim();
  const help_phone = formData.helpPhone.trim();
  const help_email = formData.helpEmail.trim();
  const help_message = formData.helpMessage.trim();
  const table_name = "doctors_help";

  // Execute query
  sql = `INSERT into ${table_name} (help_name, help_phone, help_email, help_message, help_reply)
  VALUES ("${help_name}", "${help_phone}", ${help_email ? '"' + help_email + '"' : "NULL"
    }, ${help_message ? '"' + help_message + '"' : "NULL"}, 0)
  ON DUPLICATE KEY 
  UPDATE help_name = "${help_name}", 
  help_phone = "${help_phone}",
  help_email = ${help_email ? '"' + help_email + '"' : "NULL"},
  help_message = ${help_message ? '"' + help_message + '"' : "NULL"},
  help_reply = 0;`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

app.post("/patienthelp", async (req, res) => {
  const { formData } = req.body;
  const help_name = formData.helpName.trim();
  const help_phone = formData.helpPhone.trim();
  const help_email = formData.helpEmail.trim();
  const help_message = formData.helpMessage.trim();
  const table_name = "patients_help";

  // Execute query
  sql = `INSERT into ${table_name} (help_name, help_phone, help_email, help_message, help_reply)
  VALUES ("${help_name}", "${help_phone}", ${help_email ? '"' + help_email + '"' : "NULL"
    }, ${help_message ? '"' + help_message + '"' : "NULL"}, 0)
  ON DUPLICATE KEY 
  UPDATE help_name = "${help_name}", 
  help_phone = "${help_phone}",
  help_email = ${help_email ? '"' + help_email + '"' : "NULL"},
  help_message = ${help_message ? '"' + help_message + '"' : "NULL"},
  help_reply = 0;`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

app.post("/dochelpCheck", async (req, res) => {
  const id = req.body.id;

  sql = `UPDATE doctors_help SET help_reply = 1 WHERE id = ${id};`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

//------------doctor help API end ---------------------

//-----------staff tech support API start---------------------
app.post("/stafftechsupport", async (req, res) => {
  const { formData } = req.body;
  const help_name = formData.helpName.trim();
  const help_phone = formData.helpPhone.trim();
  const help_email = formData.helpEmail.trim();
  const help_message = formData.helpMessage.trim();
  const table_name = "clinic_help";

  // Execute query
  sql = `INSERT into ${table_name} (help_name, help_phone, help_email, help_message, help_reply)
  VALUES ("${help_name}", "${help_phone}", ${help_email ? '"' + help_email + '"' : "NULL"
    }, ${help_message ? '"' + help_message + '"' : "NULL"}, 0)
  ON DUPLICATE KEY 
  UPDATE help_name = "${help_name}", 
  help_phone = "${help_phone}",
  help_email = ${help_email ? '"' + help_email + '"' : "NULL"},
  help_message = ${help_message ? '"' + help_message + '"' : "NULL"},
  help_reply = 0;`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

app.post("/clinichelpCheck", async (req, res) => {
  const id = req.body.id;

  sql = `UPDATE clinic_help SET help_reply = 1 WHERE id = ${id};`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

//------------staff tech support API end ---------------------

//------------doc task staff API start ---------------------

app.post("/doctaskCheck", async (req, res) => {
  const id = req.body.id;

  sql = `UPDATE doctor_task_request SET check_status = 1 WHERE id = ${id};`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});

app.post("/stafftopatientReply", async (req, res) => {
  const id = req.body.id;

  sql = `UPDATE message_pat_to_clinicalstaff SET check_status = 1 WHERE id = ${id};`;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error);
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.send({ success: "Form Submitted Successfully." });
});
//------------doc task staff API start ---------------------

//patient Overview data
app.post("/patientOverview", async (req, res) => {
  const patientID = req.body.patientId;
  let patientData, patientTreatment, online_status;
  if (!patientID) {
    res.send({ error: "Missing Patient ID." });
    console.log("Missing Patient ID.");
    return;
  }
  //queries
  const sql_patient_data = `select * from patients_registration where id="${patientID}"`;
  const sql_patient_treatment = `select * 
                          from patients_treatment 
                          where patient_id="${patientID}"
                          order by RecordDate desc`;
  const sql_online_status = `select session_status 
                      from online_patients 
                      where online_patient_id="${patientID}"`;
  //execute
  try {
    patientData = await mysql.query(sql_patient_data);
    patientTreatment = await mysql.query(sql_patient_treatment);
    online_status = await mysql.query(sql_online_status);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  if (patientData.length <= 0) {
    res.send({ error: "No records found." });
    return;
  }
  const data = {
    patient_data: patientData[0],
    treatments: patientTreatment,
    status:
      online_status.length > 0 ? online_status[0].session_status : "inactive",
  };
  //console.log(online_status[0].session_status, online_status)

  res.json(data);
});
//-----------------------
//Endpoint  to handle the save visit request
app.post("/saveVisit", (req, res) => {
  const visitDetails = req.body;
  console.log("Received visit details:", visitDetails);
  const sql_visit_data = `insert into doctor_patient_visits
  (doctor_id, patient_id, reason_for_visit, observations, date, start_time, end_time)
  values("${visitDetails.doctorId}", "${visitDetails.patientId}", 
  "${visitDetails.reasonForVisit}", "${visitDetails.notes}", "${visitDetails.visitDate}",
   "${visitDetails.startTime}", "${visitDetails.endTime}")`;

  const sql_registry = `insert into doctor_servicehistory(patient_id, doctor_id, service_date)
  values("${visitDetails.patientId}", "${visitDetails.doctorId}", "${visitDetails.visitDate}")`;

  //execute
  try {
    mysql.query(sql_visit_data);
    mysql.query(sql_registry);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }

  res.status(200).send({ message: "Visit saved successfully" });
});
// Insert Treatment
app.post("/saveTreatment", (req, res) => {
  const treat = req.body;
  console.log(treat);
  const sql_treatment = `insert into patients_treatment(patient_id, doctor_id, treatment, RecordDate, disease_type , disease_id) 
  values 
  (   ${treat.patientId}, ${treat.doctorId},
     "${treat.treatment}","${treat.date}",
      ${treat.diseaseType ? "'" + treat.diseaseType + "'" : "Null"},
      ${treat.diseaseId ? treat.diseaseId : "Null"} )`;
  //execute
  try {
    mysql.query(sql_treatment);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
  res.status(200).send({ message: "Treatment saved successfully" });
});
//Get Past Visits
app.post("/patientVisits", async (req, res) => {
  const doctorID = req.body.doctorId;
  const patientID = req.body.patientId;
  let patientVisits = [];
  //queries
  const sql_patient_visit = `select * from doctor_patient_visits 
                            where patient_id=${patientID} and doctor_id=${doctorID}`;
  //execute
  try {
    patientVisits = await mysql.query(sql_patient_visit);
    res.status(200).send(patientVisits);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }
});
//Retrieve Doctor Reminder
app.post("/getDoctorReminders", async (req, res) => {
  const { doctorId } = req.body;

  // Validate and sanitize doctorId here

  // Non-Parameterized Select SQL query
  const sql_reminders = `SELECT * FROM doctor_reminders WHERE doctor_id = ${doctorId}`;

  try {
    let data = await mysql.query(sql_reminders);
    if (data.length === 0) {
      res.status(404).send({ message: "No reminders found." });
    } else {
      res.status(200).send(data);
    }
  } catch (error) {
    console.error("Error Retrieving reminder:", error);
    res.status(500).send({ error: "Error Retrieving reminder in MySQL." });
  }
});

// Save Doctor Reminder
app.post("/saveDoctorReminder", async (req, res) => {
  const { doctorId, reminderDescription } = req.body;
  // Insert SQL query
  const sql_insert_reminder = `insert into doctor_reminders(doctor_id, reminder_description) values (${doctorId}, '${reminderDescription}')`;
  try {
    await mysql.query(sql_insert_reminder);
    res.status(200).send({ message: "Reminder saved successfully" });
  } catch (error) {
    console.error("Error saving reminder:", error);
    res.status(500).send({ error: "Error saving reminder in MySQL." });
  }
});
//Retrieve Doctor To Patient Messages
app.post("/getDoctorPatientMessages", async (req, res) => {
  const { doctorId, patientId } = req.body;
  // Select SQL query
  const sql_reminders = `select * from doctor_to_patient_message
                        where doctor_id=${doctorId} and patient_id=${patientId} 
                        order by time_stamp desc `;
  try {
    let data = await mysql.query(sql_reminders);
    res.status(200).send(data);
  } catch (error) {
    console.error("Error Retrieving messages:", error);
    res.status(500).send({ error: "Error Selecting reminder in MySQL." });
  }
});

app.post("/getPatientDoctorMessage", async (req, res) => {
  const { doctorId, patientId } = req.body;
  // Select SQL query
  const sql_reminders = `select *
                        from patient_to_doctor_message
                        where doctor_id=${doctorId} and patient_id=${patientId} 
                        order by time_stamp desc `;
  //SELECT DATE_FORMAT(time_stamp, '%Y-%m-%d %H:%i:%s') as time_stamp, patient_id, doctor_id, doctor_FName, doctor_LName, patient_FName, patient_LName, message, time_sent
  try {
    let data = await mysql.query(sql_reminders);
    res.status(200).send(data);
  } catch (error) {
    console.error("Error Retrieving messages:", error);
    res.status(500).send({ error: "Error Selecting reminder in MySQL." });
  }
});

//Send Doctor to Patient Message
app.post("/sendPatientDoctorMessage", async (req, res) => {
  const {
    doctorId,
    patientId,
    doctorFName,
    doctorLName,
    patientFName,
    patientLName,
    message,
    time,
  } = req.body;

  // Add validation and sanitization for the input data here

  // Non-Parameterized Insert SQL query
  const sql_insert_message = `
    INSERT INTO patient_to_doctor_message (
      doctor_id, patient_id, doctor_FName, doctor_LName, patient_FName, 
      patient_LName, message, time_sent, time_stamp
    ) VALUES (
      '${doctorId}', '${patientId}', '${doctorFName.replace(/'/g, "''")}', 
      '${doctorLName.replace(/'/g, "''")}', '${patientFName.replace(
    /'/g,
    "''"
  )}', 
      '${patientLName.replace(/'/g, "''")}', '${message.replace(
    /'/g,
    "''"
  )}', '${time}', '${time}'
    )`;

  try {
    await mysql.query(sql_insert_message);
    res.status(200).send({ message: "Message saved successfully" });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).send({ error: "Error saving message in MySQL." });
  }
});

app.post("/sendDoctorPatientMessage", async (req, res) => {
  const {
    doctorId,
    patientId,
    doctorFName,
    doctorLName,
    patientFName,
    patientLName,
    message,
    time,
  } = req.body;

  // Add validation and sanitization for the input data here

  // Non-Parameterized Insert SQL query
  const sql_insert_message = `
    INSERT INTO doctor_to_patient_message (
      doctor_id, patient_id, doctor_FName, doctor_LName, patient_FName, 
      patient_LName, message, time_sent
    ) VALUES (
      '${doctorId}', '${patientId}', '${doctorFName.replace(/'/g, "''")}', 
      '${doctorLName.replace(/'/g, "''")}', '${patientFName.replace(
    /'/g,
    "''"
  )}', 
      '${patientLName.replace(/'/g, "''")}', '${message.replace(
    /'/g,
    "''"
  )}', '${time}'
    )`;

  try {
    await mysql.query(sql_insert_message);
    res.status(200).send({ message: "Message saved successfully" });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).send({ error: "Error saving message in MySQL." });
  }
});

app.post("/getPatientDoctorMessagesByClinicId", async (req, res) => {
  const { clinicId, patientId } = req.body;
  // Select SQL query
  // Single query to get associate_doctor_id and patient_to_doctor_message
  const sql_reminders = `
    SELECT ptm.*
    FROM patient_to_doctor_message ptm
    JOIN clinical_staff_registration csr ON ptm.doctor_id = csr.associate_doctor_id
    WHERE csr.id = ${clinicId} AND ptm.patient_id = ${patientId}
    ORDER BY ptm.time_stamp DESC
  `;
  //SELECT DATE_FORMAT(time_stamp, '%Y-%m-%d %H:%i:%s') as time_stamp, patient_id, doctor_id, doctor_FName, doctor_LName, patient_FName, patient_LName, message, time_sent
  try {
    let data = await mysql.query(sql_reminders);
    res.status(200).send(data);
  } catch (error) {
    console.error("Error Retrieving messages:", error);
    res.status(500).send({ error: "Error Selecting reminder in MySQL." });
  }
});

app.post("/getClinicStaffPatientMessage", async (req, res) => {
  const { patientId } = req.body;
  const sql_query = `select * from message_clinicalstaff_to_pat
                     where patient_id=${patientId} 
                     order by time_stamp desc `;
  try {
    let data = await mysql.query(sql_query);
    res.status(200).send(data);
  } catch (error) {
    console.error("Error Retrieving messages:", error);
    res.status(500).send({ error: "Error Selecting messages in MySQL." });
  }
});

app.post("/sendClinicStaffPatientMessage", async (req, res) => {
  const {
    clinical_staff_id,
    patient_id,
    doctor_id,
    reply_message_id,
    message,
    time,
  } = req.body;

  // Non-Parameterized Insert SQL query
  const sql_insert_message = `
    INSERT INTO message_clinicalstaff_to_pat (
      clinical_staff_id, 
      patient_id, 
      doctor_id, 
      reply_message_id, 
      message, 
      time_stamp
    ) VALUES (
      '${clinical_staff_id}', 
      '${patient_id}', 
      '${doctor_id}', 
      '${reply_message_id}', 
      '${message.replace(/'/g, "''")}', 
      '${time}'
    )`;

  try {
    await mysql.query(sql_insert_message);
    res.status(200).send({ message: "Message saved successfully" });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).send({ error: "Error saving message in MySQL." });
  }
});

app.post("/getDoctorIdByClinicStaffId", async (req, res) => {
  const clinicStaffId = req.body.clinicStaffId;
  if (!clinicStaffId) {
    res.send({ error: "Missing Clinic Staff ID." });
    console.log("Missing Clinic Staff ID.");
    return;
  }

  // Query to find doctor_id using clinicStaffId
  const sql_find_doctor = `
    SELECT associate_doctor_id 
    FROM clinical_staff_registration 
    WHERE id = ${clinicStaffId}
  `;

  let doctor;
  try {
    doctor = await mysql.query(sql_find_doctor);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }

  if (doctor.length === 0) {
    res.send({ error: "No doctor found for the given Clinic Staff ID." });
    return;
  }

  res.json({ doctorId: doctor[0].associate_doctor_id });
});

//Surgery Planning
app.post("/saveSurgeryPlan", async (req, res) => {
  const {
    doctorId,
    patientId,
    surgeryType,
    surgeryDate,
    preSurgeryConsultationDetails,
    riskAssessmentDetails,
    postOperativeCarePlan,
  } = req.body;

  // Add validation and sanitization for the input data here

  // Non-Parameterized Insert SQL query
  const sql_insert_plan = `
    INSERT INTO surgery_planning (
      doctor_id, 
      patient_id, 
      surgery_type, 
      surgery_date, 
      pre_surgery_consultation_details, 
      risk_assessment_details, 
      post_operative_care_plan
    ) VALUES (
      '${doctorId}', 
      '${patientId}', 
      '${surgeryType.replace(/'/g, "''")}', 
      '${surgeryDate.replace(/'/g, "''")}', 
      '${preSurgeryConsultationDetails.replace(/'/g, "''")}', 
      '${riskAssessmentDetails.replace(/'/g, "''")}', 
      '${postOperativeCarePlan.replace(/'/g, "''")}'
    )`;

  try {
    await mysql.query(sql_insert_plan);
    res.status(200).send({ message: "Surgery plan saved successfully" });
  } catch (error) {
    console.error("Error saving surgery plan:", error);
    res.status(500).send({ error: "Error saving surgery plan in MySQL." });
  }
});

// Surgery Plan Retrieval
app.post("/getSurgeryPlan", async (req, res) => {
  const { doctorId } = req.body;
  console.log("Received doctorId:", doctorId);

  if (!doctorId) {
    res.status(400).send({ error: "Missing Doctor ID." });
    console.log("Missing Doctor ID.");
    return;
  }

  // Add validation and sanitization for doctorId here

  // Non-Parameterized SQL Query to retrieve the surgery plan
  const sql_retrieve_plan = `SELECT * FROM surgery_planning WHERE doctor_id = ${doctorId}`;

  try {
    const surgeryPlans = await mysql.query(sql_retrieve_plan);
    console.log("Query result:", surgeryPlans);
    if (surgeryPlans.length === 0) {
      res.status(404).send({ error: "No surgery plans found." });
    } else {
      res.status(200).send(surgeryPlans);
    }
  } catch (error) {
    console.error("Error retrieving surgery plan:", error);
    res
      .status(500)
      .send({ error: "Error retrieving surgery plan from MySQL." });
  }
});

app.post("/getSurgeryPlanByPatientID", async (req, res) => {
  const { patientId } = req.body;
  console.log("Received patientId:", patientId);

  if (!patientId) {
    res.status(400).send({ error: "Missing patient ID." });
    console.log("Missing Patient ID.");
    return;
  }

  // Add validation and sanitization for patientId here

  // Non-Parameterized SQL Query to retrieve the surgery plan
  const sql_retrieve_plan = `SELECT * FROM surgery_planning WHERE patient_id = ${patientId}`;

  try {
    const surgeryPlans = await mysql.query(sql_retrieve_plan);
    console.log("Query result:", surgeryPlans);
    if (surgeryPlans.length === 0) {
      res.status(404).send({ error: "No surgery plans found." });
    } else {
      res.status(200).send(surgeryPlans);
    }
  } catch (error) {
    console.error("Error retrieving surgery plan:", error);
    res
      .status(500)
      .send({ error: "Error retrieving surgery plan from MySQL." });
  }
});

//Patient Medical History
app.post("/patientMedicalHistory", async (req, res) => {
  const patientID = req.body.patientId;
  console.log("In medical History");
  if (!patientID) {
    res.status(400).send({ error: "Missing Patient ID." });
    console.log("Missing Patient ID.");
    return;
  }

  // Add validation and sanitization for patientID here

  const tablesWithRecordDate = [
    "physical_test_cad",
    "physical_test_ck",
    "physical_test_hd",
    "physical_test_ms",
    "bloodtests",
    "ecg",
    "eye_test",
    "tumor",
  ];
  const tablesWithoutRecordDate = ["vaccines"];

  const sqlTemplate = (tableName, hasRecordDate) => `
    SELECT * 
    FROM ${tableName} 
    WHERE patient_id = ${patientID}
    ${hasRecordDate ? "ORDER BY RecordDate DESC" : ""}
  `;

  try {
    let data = {};
    let total_records = {};

    for (const table of tablesWithRecordDate) {
      const sql = sqlTemplate(table, true);
      const result = await mysql.query(sql);
      data[table] = result;
      total_records[`${table}_total`] = result.length;
    }

    for (const table of tablesWithoutRecordDate) {
      const sql = sqlTemplate(table, false);
      const result = await mysql.query(sql);
      data[table] = result;
      total_records[`${table}_total`] = result.length;
    }

    console.log({ total_records, ...data });
    res.json({ total_records, ...data });
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});

//Doctor Send Task Request to Staff
app.post("/sendDoctorStaffMessage", async (req, res) => {
  const { doctorId, patientId, task } = req.body;

  // Validate and sanitize inputs
  // IMPORTANT: Add validation and sanitization here

  // Non-Parameterized SQL query
  const sql_insert_message = `INSERT INTO doctor_task_request 
                              (doctor_id, patient_id, task,check_status)
                              VALUES (${doctorId}, ${patientId}, '${task}', 0)`;

  try {
    await mysql.query(sql_insert_message);
    res.status(200).send({ message: "Message saved successfully" });
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).send({ error: "Error saving message in MySQL." });
  }
});



//Get All prescriptions
app.post("/getPrescriptions", async (req, res) => {
  const { doctorId, patientId } = req.body;

  // Validate and sanitize inputs
  // IMPORTANT: Add validation and sanitization here to prevent SQL injection
  console.log(doctorId, patientId);
  // Non-Parameterized SQL query
  const sql_select = `SELECT * FROM prescription WHERE doctor_id = ${doctorId} AND patient_id = ${patientId}`;
  console.log("In Prescription");
  try {
    const result = await mysql.query(sql_select);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});

//Save Prescription
app.post("/savePrescription", async (req, res) => {
  const {
    diagnosis_id,
    doctor_id,
    dose,
    dose_unit,
    duration,
    frequency,
    medicine_id,
    pharmacist_permission,
    prescription_creation_time,
    prescription_description,
    quantity,
    quantity_unit,
    refill,
    route,
    patient_id,
  } = req.body;

  try {
    console.log("Received prescription details:", req.body);
    const patientQuery = `
      SELECT 
        FName AS patient_FName, 
        LName AS patient_LName, 
        MobileNumber AS patient_phone, 
        Address AS patient_address 
      FROM patients_registration 
      WHERE id = '${patient_id}'
    `;
    const [patientRows] = await mysql.query(patientQuery);

    if (patientRows.length === 0) {
      return res.status(404).send({ error: "Patient not found" });
    }
    const patient = patientRows;

    const doctorQuery = `
      SELECT 
        Fname AS doctor_FName, 
        Lname AS doctor_LName, 
        MobileNumber AS doctor_phone, 
        CONCAT(Location1, Location2) AS doctor_office_address 
      FROM doctors_registration
      WHERE id = ${doctor_id}
    `;
    const [doctorRows] = await mysql.query(doctorQuery);
    console.log("Doctor:", doctorRows);

    if (doctorRows.length === 0) {
      return res.status(404).send({ error: "Doctor not found" });
    }
    console.log("Doctor Rows Type:", typeof doctorRows);
    console.log("Doctor Rows Full:", JSON.stringify(doctorRows, null, 2));

    const doctor = doctorRows;
    console.log("Doctor:", doctor);

    const sqlInsert = `
      INSERT INTO prescription (
        diagnosis_id,
        doctor_FName,
        doctor_id,
        doctor_LName,
        doctor_office_address,
        doctor_phone,
        dose,
        dose_unit,
        duration,
        frequency,
        medicine_id,
        patient_address,
        patient_FName,
        patient_id,
        patient_LName,
        patient_phone,
        pharmacist_permission,
        prescription_creation_time,
        prescription_description,
        quantity,
        quantity_unit,
        refill,
        route
      ) VALUES (
        '${diagnosis_id}',
        '${doctor.doctor_FName}',
        '${doctor_id}',
        '${doctor.doctor_LName}',
        '${doctor.doctor_office_address}',
        '${doctor.doctor_phone}',
        '${dose}',
        '${dose_unit}',
        '${duration}',
        '${frequency}',
        '${medicine_id}',
        '${patient.patient_address}',
        '${patient.patient_FName}',
        '${patient_id}',
        '${patient.patient_LName}',
        '${patient.patient_phone}',
        '${pharmacist_permission}',
        '${prescription_creation_time}',
        '${prescription_description}',
        '${quantity}',
        '${quantity_unit}',
        '${refill}',
        '${route}'
      )
    `;

    await mysql.query(sqlInsert);
    res.status(200).send({ message: "Prescription saved successfully" });
  } catch (error) {
    console.error("Error saving prescription:", error);
    res.status(500).send({ error: "Error saving prescription in MySQL." });
  }
});


//Delete Reminder

app.post("/deleteReminder", async (req, res) => {
  const reminderId = parseInt(req.body.reminderId, 10);
  const doctorId = parseInt(req.body.doctorId, 10);
  console.log(reminderId, doctorId);
  const sql_delete_reminder = `DELETE FROM doctor_reminders WHERE id=${reminderId} AND doctor_id=${doctorId}`;

  try {
    const result = await mysql.query(sql_delete_reminder);
    if (result.affectedRows === 0) {
      res.status(404).send({ message: "No reminder found to delete." });
    } else {
      res.status(200).send({ message: "Reminder deleted successfully." });
    }
  } catch (error) {
    console.error("Error deleting reminder:", error);
    res.status(500).send({ error: "Error deleting reminder in MySQL." });
  }
});

// Save Referrals
app.post("/saveReferral", async (req, res) => {
  const referral = req.body;
  try {
    console.log("Received referral details:", referral);
    const sqlInsertReferral = `
    INSERT INTO doctor_referrals (
      doctor_id, 
      patient_id, 
      referred_doctor_FName, 
      referred_doctor_LName, 
      referred_doctor_phone, 
      referred_doctor_specialization, 
      is_referred_doctor_in_system, 
      referred_doctor_id, 
      referral_date, 
      referral_message
    ) VALUES (
      '${referral.doctorId}',
      '${referral.patientId}',
      '${referral.referredDoctorFName}',
      '${referral.referredDoctorLName}',
      '${referral.referredDoctorPhone}',
      '${referral.referredDoctorSpecialization}',
      '${referral.isReferredDoctorInSystem ? 1 : 0}',
      ${referral.referredDoctorId ? `'${referral.referredDoctorId}'` : "NULL"},
      '${referral.referralDate}',
      '${referral.referralMessage}'
    )
  `;

    await mysql.query(sqlInsertReferral);
    console.log("Referral saved successfully");
    res.status(200).send({ message: "Referral saved successfully" });
  } catch (error) {
    console.error("Error saving referral:", error);
    res.status(500).send({ error: "Error in MySQL query." });
  }
});


//-------
app.post("/getReferral", async (req, res) => {
  const { doctorId } = req.body;

  // Validate and sanitize inputs
  // IMPORTANT: Add validation and sanitization here to prevent SQL injection

  const selectJoin = `SELECT 
        dr.referral_id,
        dr.doctor_id,
        referringDoc.Fname AS referring_doctor_FName,
        referringDoc.Lname AS referring_doctor_LName,
        dr.patient_id,
        pr.FName AS patient_FName,
        pr.LName AS patient_LName,
        pr.MobileNumber AS patient_MobileNumber,
        dr.referred_doctor_FName,
        dr.referred_doctor_LName,
        dr.referred_doctor_phone,
        dr.referred_doctor_specialization,
        dr.is_referred_doctor_in_system,
        dr.referred_doctor_id,
        dr.referral_date,
        dr.referral_message,
        dr.first_appointment_date,
        dr.record_time
      FROM doctor_referrals dr
      LEFT JOIN patients_registration pr ON dr.patient_id = pr.id
      LEFT JOIN doctors_registration referringDoc ON dr.doctor_id = referringDoc.id
      WHERE dr.doctor_id = ${doctorId}`;

  try {
    const result = await mysql.query(selectJoin);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});
app.post("/getIncomingReferrals", async (req, res) => {
  const { doctorId } = req.body;
  const selectJoin = `SELECT 
        dr.referral_id,
        dr.doctor_id,
        referringDoc.Fname AS referring_doctor_FName,
        referringDoc.Lname AS referring_doctor_LName,
        dr.patient_id,
        pr.FName AS patient_FName,
        pr.LName AS patient_LName,
        pr.MobileNumber AS patient_MobileNumber,
        dr.referred_doctor_FName,
        dr.referred_doctor_LName,
        dr.referred_doctor_phone,
        dr.referred_doctor_specialization,
        dr.is_referred_doctor_in_system,
        dr.referred_doctor_id,
        dr.referral_date,
        dr.referral_message,
        dr.first_appointment_date,
        dr.record_time
      FROM doctor_referrals dr
      LEFT JOIN patients_registration pr ON dr.patient_id = pr.id
      LEFT JOIN doctors_registration referringDoc ON dr.doctor_id = referringDoc.id
      WHERE dr.referred_doctor_id = ${doctorId}; 
`;

  try {
    const result = await mysql.query(selectJoin);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});

app.post('/getReferralByPatientID', async (req, res) => {
  const { patientId } = req.body;
  console.log('Referral Received patientId:', patientId);

  // 动态拼接 SQL 查询
  const selectJoin = `
                SELECT
          dr.referral_id,
          dr.doctor_id,
          dr.patient_id,
          pr.FName AS patient_FName,
          pr.LName AS patient_LName,
          pr.MobileNumber AS patient_MobileNumber,
          dr.referred_doctor_FName,
          dr.referred_doctor_LName,
          dr.referred_doctor_phone,
          dr.referred_doctor_specialization,
          dr.is_referred_doctor_in_system,
          dr.referred_doctor_id,
          dr.referral_date,
          dr.referral_message,
          dr.first_appointment_date,
          dr.record_time
        FROM doctor_referrals dr
        LEFT JOIN patients_registration pr ON dr.patient_id = pr.id
        WHERE dr.patient_id = '${patientId}';
  `;

  console.log('Generated SQL:', selectJoin);

  try {
    const result = await mysql.query(selectJoin);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});



app.post("/getIncomingReferralsByPatientID", async (req, res) => {
  const { patientId } = req.body;
  console.log("Incoming Referrals Received patientId:", patientId);
  const selectJoin = `SELECT 
        dr.referral_id,
        dr.doctor_id,
        referringDoc.Fname AS referring_doctor_FName,
        referringDoc.Lname AS referring_doctor_LName,
        dr.patient_id,
        pr.FName AS patient_FName,
        pr.LName AS patient_LName,
        pr.MobileNumber AS patient_MobileNumber,
        dr.referred_doctor_FName,
        dr.referred_doctor_LName,
        dr.referred_doctor_phone,
        dr.referred_doctor_specialization,
        dr.is_referred_doctor_in_system,
        dr.referred_doctor_id,
        dr.referral_date,
        dr.referral_message,
        dr.first_appointment_date,
        dr.record_time
      FROM doctor_referrals dr
      LEFT JOIN patients_registration pr ON dr.patient_id = pr.id
      LEFT JOIN doctors_registration referringDoc ON dr.doctor_id = referringDoc.id
      WHERE dr.patient_id = ${patientId}; 
`;

  try {
    const result = await mysql.query(selectJoin);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});
//-------------- Medical Form Request------------------
//Actual Form
app.get("/download-form", (req, res) => {
  const pdfPath = path.join(__dirname, "secure-assets/pdfs/4422-84.pdf");
  res.sendFile(pdfPath);
});
//API for webform to save MedicalTest Request
const mysqlMedical = require("mysql2/promise");
const dbConfigMedical = require("./app/config/db.config");
app.post("/saveMedicalTest", async (req, res) => {
  try {
    // Create a connection
    const conn = await mysqlMedical.createConnection(
      dbConfigMedical.connectionString
    );
    //Parameters from Requests
    const medicalTestRequest = req.body;

    // Prepare SQL queries
    const medicalFormInsert = `INSERT INTO medical_request_form 
      (
        patient_id, 
        doctor_id, 
        practitioner_name,
        practitioner_address, 
        practitioner_number,
        practitioner_cpsoreg_number, 
        insurance_check, 
        clinical_information, 
        copy_to_practitioner, 
        other_practitioner_name, 
        other_practitioner_address, 
        practitioner_phone_number, 
        patient_health_number, 
        patient_health_version,
        gender, 
        date_of_birth, 
        province, 
        other_prov_reg_number, 
        patient_mobile_number, 
        patient_last_name, 
        patient_first_name,
        patient_middle_initial, 
        patient_address,
        signature,
        signature_date,
        glucose_radio, 
        hbA1C, 
        creatinine, 
        uric_acid,
        sodium, 
        potassium, 
        alt, 
        alk,
        bilirubin, 
        albumin,
        lipid_assessment,
        albumin_creatine_ratio,
        urinalysis,
        neonatal_bilirubin, 
        child_age,
        child_age_days,
        child_age_hours,
        clinician_tel_no,
        patient_24hr_tel_no,
        therapeutic_drug_monitoring,
        drug_name_1,
        drug_name_2,
        time_collected_1,
        time_collected_2,
        time_of_last_dose_1,
        time_of_last_dose_2,
        time_of_next_dose_1, 
        time_of_next_dose_2,
        othertests,
        specimen_collection_time,
        specimen_collection_date
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`;

    //Hematology
    const hematologyInsert = `INSERT INTO medical_request_form_hermatology 
      (medical_request_form_id, cbc, prothrombinTime) VALUES (?, ?, ?)`;

    //Immunology
    const immunology = `INSERT INTO medical_request_form_immunology 
      (
        medical_request_form_id, 
        pregnancyTestUrine, 
        mononucleosis, 
        rubella,
        prenatalABORhDAntibody, 
        repeatPrenatalAntibodies
      )
      VALUES (?,?,?,?,?,?)
      `;
    //hepatitis
    const hepatitis = `INSERT INTO medical_request_form_hepatitis
      (
        medical_request_form_id,
        acuteHepatitis, 
        chronicHepatitis,
        immuneStatusExposure, 
        hepatitisA, 
        hepatitisB, 
        hepatitisC
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
    //microbiology_id_sensitivities
    const mricobiology = `INSERT INTO medical_request_form_microbiology_id_sensitivities
      (
        medical_request_form_id, 
        cervicalSwab, 
        vaginalSwab, 
        vaginalRectalGroupBStrep, 
        chlamydia, 
        chlamydiaSource, 
        gc, 
        gcSource, 
        sputum, 
        throatSwab, 
        woundSwab, 
        woundSwabSource, 
        urineCulture, 
        stoolCulture, 
        stoolOvaParasites,
        otherSwabs, 
        otherSwabsSource
        )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `;

    // medical_request_form_psa
    const psa = `INSERT INTO medical_request_form_psa
      (
        medical_request_form_id,
        totalPSA, 
        freePSA, 
        insuredPSA, 
        uninsuredPSA
      )
      VALUES (?, ?, ?, ?, ?)
      `;

    //medical_request_form_vitamind
    const vitaminD = `INSERT INTO medical_request_form_vitamind
      (
        medical_request_form_id, 
        insuredVitaminD,
        uninsuredVitaminD
      )
      VALUES (?,?,?)
      `;

    const medicalRequestGeneralParams = [
      medicalTestRequest.patientId,
      medicalTestRequest.doctorId,
      medicalTestRequest.practitionerName,
      medicalTestRequest.practitionerAddress,
      medicalTestRequest.practitionerNumber,
      medicalTestRequest.practitionerRegistrationNumber,
      medicalTestRequest.insuranceCheck,
      medicalTestRequest.clinicalInformation,
      medicalTestRequest.copyToPractitioner,
      medicalTestRequest.otherPractitionerName,
      medicalTestRequest.otherPractitionerAddress,
      medicalTestRequest.practitionerPhoneNumber,
      medicalTestRequest.patientHealthNumber,
      medicalTestRequest.patientHealthVersion,
      medicalTestRequest.gender,
      medicalTestRequest.DOB,
      medicalTestRequest.province,
      medicalTestRequest.otherProvRegistrationNumber,
      medicalTestRequest.patientMobileNumber,
      medicalTestRequest.patientLastName,
      medicalTestRequest.patientFirstName,
      medicalTestRequest.patientMiddleInitial,
      medicalTestRequest.patientAddress,
      medicalTestRequest.signature,
      medicalTestRequest.signatureDate,
      medicalTestRequest.glucoseRadio,
      medicalTestRequest.hbA1C,
      medicalTestRequest.creatinine,
      medicalTestRequest.uricAcid,
      medicalTestRequest.sodium,
      medicalTestRequest.potassium,
      medicalTestRequest.alt,
      medicalTestRequest.alk,
      medicalTestRequest.bilirubin,
      medicalTestRequest.albumin,
      medicalTestRequest.lipidAssessment,
      medicalTestRequest.albuminCreatineRatio,
      medicalTestRequest.urinalysis,
      medicalTestRequest.neonatalBilirubin,
      medicalTestRequest.childAge,
      medicalTestRequest.childAgeDays,
      medicalTestRequest.childAgeHours,
      medicalTestRequest.clinician_tel_no,
      medicalTestRequest.patient24hrTelNo,
      medicalTestRequest.therapeuticDrugMonitoring,
      medicalTestRequest.drugName1,
      medicalTestRequest.drugName2,
      medicalTestRequest.timeCollected1,
      medicalTestRequest.timeCollected2,
      medicalTestRequest.timeOfLastDose1,
      medicalTestRequest.timeOfLastDose2,
      medicalTestRequest.timeOfNextDose1,
      medicalTestRequest.timeOfNextDose2,
      medicalTestRequest.otherTests,
      medicalTestRequest.collectionTime,
      medicalTestRequest.collectionDate,
    ];

    // Execute medical form insert query
    const insertResult = await conn.execute(
      medicalFormInsert,
      medicalRequestGeneralParams
    );
    const lastInsertedId = insertResult[0].insertId;

    // Prepare parameter arrays for other tables
    const hematologyParams = [
      lastInsertedId,
      medicalTestRequest.cbc,
      medicalTestRequest.prothrombinTime,
    ];
    const immunologyParams = [
      lastInsertedId,
      medicalTestRequest.pregnancyTestUrine,
      medicalTestRequest.mononucleosis,
      medicalTestRequest.rubella,
      medicalTestRequest.prenatal,
      medicalTestRequest.repeatPrenatal,
    ];
    const microbiologyParams = [
      lastInsertedId,
      medicalTestRequest.cervical,
      medicalTestRequest.vaginal,
      medicalTestRequest.vaginalRectal,
      medicalTestRequest.chlamydia,
      medicalTestRequest.chSource,
      medicalTestRequest.gc,
      medicalTestRequest.gcSource,
      medicalTestRequest.sputum,
      medicalTestRequest.throat,
      medicalTestRequest.wound,
      medicalTestRequest.wdSwabSource,
      medicalTestRequest.urine,
      medicalTestRequest.stoolCulture,
      medicalTestRequest.stoolOva,
      medicalTestRequest.otherSwabs,
      medicalTestRequest.oSwabsSource,
    ];
    const hepatitisParams = [
      lastInsertedId,
      medicalTestRequest.accuteHepatitis,
      medicalTestRequest.chronicHepatitis,
      medicalTestRequest.immuneStatus,
      medicalTestRequest.immuneHepA,
      medicalTestRequest.immuneHepB,
      medicalTestRequest.immuneHepC,
    ];
    const psaParams = [
      lastInsertedId,
      medicalTestRequest.totalPSA,
      medicalTestRequest.freePSA,
      medicalTestRequest.insuredPSA,
      medicalTestRequest.uninsuredPSA,
    ];
    const vitaminDParams = [
      lastInsertedId,
      medicalTestRequest.insuredVitaminD,
      medicalTestRequest.uninsuredVitaminD,
    ];
    // Execute other insert queries
    await conn.execute(hematologyInsert, hematologyParams);
    await conn.execute(immunology, immunologyParams);
    await conn.execute(mricobiology, microbiologyParams);
    await conn.execute(hepatitis, hepatitisParams);
    await conn.execute(psa, psaParams);
    await conn.execute(vitaminD, vitaminDParams);

    await conn.end();
    res
      .status(200)
      .send({ message: "Medical Test Request saved", lastInsertedId });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).send({ error: "Server error." });
  }
});

app.post("/getMedicalTest", async (req, res) => {
  const patientID = req.body.patientId;
  if (!patientID) {
    console.log("Missing patient ID.");
    return res.status(400).send({ error: "Missing patient ID." });
  }

  // Construct SQL query with patientID
  const sql = `SELECT * FROM medical_request_form WHERE patient_id = "${patientID}"`;

  let result;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.error("Error executing query:", error);
    return res.status(500).send({ error: "Database query error." });
  }

  if (result.length === 0) {
    console.log("No patient matched in database.");
    return res.status(404).send({ error: "No patient matched in database." });
  }

  // Define related tables
  const relatedTables = [
    "medical_request_form_hepatitis",
    "medical_request_form_hermatology",
    "medical_request_form_immunology",
    "medical_request_form_microbiology_id_sensitivities",
    "medical_request_form_psa",
    "medical_request_form_vitamind",
  ];

  const relatedData = {};

  // Fetch related data for each form record using Promise.all for parallel execution
  try {
    await Promise.all(
      result.map(async (record) => {
        const medicalRequestFormId = record.id;
        relatedData[medicalRequestFormId] = {};

        await Promise.all(
          relatedTables.map(async (table) => {
            // Construct SQL query for each related table
            const relatedSql = `SELECT * FROM ${table} WHERE medical_request_form_id = "${medicalRequestFormId}"`;
            try {
              const relatedResult = await mysql.query(relatedSql);
              console.log(`Fetched data from ${table}:`, relatedResult);
              relatedData[medicalRequestFormId][table] = relatedResult;
            } catch (error) {
              console.error(`Error fetching data from ${table}:`, error);
              throw new Error(`Database query error in table ${table}`);
            }
          })
        );
      })
    );
  } catch (error) {
    console.error("Error in fetching related data:", error);
    return res.status(500).send({ error: "Error in fetching related data." });
  }

  // Send combined result and related data as response
  res.json({ ...result, ...relatedData });
});



//----------

app.post(
  "/addReview",
  jsonParser,
  bodyParser.urlencoded({ extended: false }),
  async (req, res) => {
    const patientID = req.body.userId;
    if (!patientID) {
      console.log("UserId Missing ID.");
      return res.send({ error: "UserId Missing ID." }).status(500);
    }
    //queries
    sql_review_insert_query = `INSERT INTO userreviews(UserID,Review, Rating) VALUES ('${req.body.userId}','${req.body.review}',${req.body.rating}) `;

    //execute
    try {
      await mysql.query(sql_review_insert_query);
    } catch (error) {
      console.log(error, "Something wrong in MySQL.");
      res.send({ error: "Something wrong in MySQL." }).status(500);
      return;
    }

    //console.log(patientData)

    res
      .json({
        response: "Review Sucessfully Submitted",
      })
      .status(200);
  }
);

app.get("/GetAllReviews", async (req, res) => {
  //queries
  sql_review_insert_query = `SELECT * FROM userreviews; `;

  //execute
  try {
    data = await mysql.query(sql_review_insert_query);
    return res.send(data).status(200);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." }).status(500);
    return;
  }

  //console.log(patientData)

  res
    .json({
      response: "Review Sucessfully Submitted",
    })
    .status(200);
});

//-------------------------

//please do comments before and after your code part for better readibility.

///voicerecognition code
const typeToCollectionMap = {
  bloodtest: "Bloodtest_Report",
  mrireport: "MRI_Brain",
  ctscan: "CT-Scan_Abdomen",
  cellimages: "Cell-Images",
  ecgreport: "ECG_Report",
  echocardiogram: "Echocardiogram",
  skindiseases: "Skin_Diseases",
  skinimages: "Skin_Images",
  ultrasoundabdomen: "Ultrasound_Abdomen",
  medicalhistory: "Medical_History",
  xrayreport: "X-Ray_Lung",
  endoscope: "Endoscopic",
  template: "template",
};

app.get("/files/:filetype/:patientId", async (req, res) => {
  const filetype = req.params.filetype;
  const patientId = req.params.patientId;

  console.log("File type:", filetype);
  console.log("PatientId:", patientId);

  try {
    const db = client.db("htdata");
    const collectionName = typeToCollectionMap[filetype];

    if (!collectionName) {
      return res.status(400).send("Invalid file type");
    }

    const collection = db.collection(collectionName);
    const result = await collection.findOne({
      patient_id: parseInt(patientId),
    });

    if (!result) {
      return res.status(404).send("File not found");
    }

    console.log("Result:", result);

    if (!result.file || !result.file.buffer) {
      console.error(
        "Invalid file structure - 'buffer' field is missing:",
        result
      );
      return res
        .status(500)
        .send("Invalid file structure - 'buffer' field is missing");
    }

    const { buffer } = result.file;
    if (!buffer) {
      console.error(
        "Invalid file structure - 'buffer' field is missing:",
        result
      );
      return res
        .status(500)
        .send("Invalid file structure - 'buffer' field is missing");
    }

    return res.send({ data: buffer.toString("base64") });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal Server Error");
  }
});

/**
 * Psychology Data Endpoint
 **/
app.get("/psychology/:patientId", async (req, res, nxt) => {
  const { patientId } = req.params;

  psychologysql = `SELECT * FROM psychology_information
          WHERE patient_id = "${patientId}" 
          limit 1`;

  patientsql = `SELECT case Gender
      when 'Male' then 1
      when 'Female' then 0
      else 2
      end as Gender,
      Age FROM patients_registration
        WHERE id = ${patientId}
        limit 1`;

  let psychologyData = null;
  let patientData = null;
  try {
    psychologyData = await mysql.query(psychologysql);
    patientData = await mysql.query(patientsql);
  } catch (error) {
    return res.status(500).send({ error: "Something wrong in MySQL" });
  }

  if (!psychologyData || !patientData) {
    return res.status(404).send({ error: "No patient matched in database." });
  }

  return res.json({ ...psychologyData[0], ...patientData[0] });
});

/**
 * Psychology Data Endpoint ends
 **/

/* Analytics page end point */
app.get("/patientsRegistration", async (req, res) => {
  const sqlPatientsRegistration = `SELECT * FROM patients_registration`;

  try {
    const patientsRegistration = await mysql.query(sqlPatientsRegistration);
    res.status(200).send(patientsRegistration);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

/* Analytics page end point */
app.get("/doctorsRegistration", async (req, res) => {
  const sqlDoctorsRegistration = `SELECT * FROM doctors_registration`;

  try {
    const doctorsRegistration = await mysql.query(sqlDoctorsRegistration);
    res.status(200).send(doctorsRegistration);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

app.get("/alzheimers", async (req, res) => {
  const sqlalzheimer = `SELECT * FROM alzheimer`;

  try {
    const alzheimer = await mysql.query(sqlalzheimer);
    res.status(200).send(alzheimer);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

app.get("/combinedPredictions", async (req, res) => {
  const sqlQuery = `
  SELECT patient_id, prediction, 'alzheimer' AS table_name FROM alzheimer
  UNION ALL
  SELECT patient_id, prediction, 'arrhythmia' AS table_name FROM arrhythmia
  UNION ALL
  SELECT patient_id, prediction, 'brain_tumor' AS table_name FROM brain_tumor
  UNION ALL
  SELECT patient_id, prediction, 'breast_cancer' AS table_name FROM breast_cancer
  UNION ALL
  SELECT patient_id, prediction, 'breast_disease' AS table_name FROM breast_disease
  UNION ALL
  SELECT patient_id, prediction, 'cancers' AS table_name FROM cancers
  UNION ALL
  SELECT patient_id, prediction, 'cardiovascular' AS table_name FROM cardiovascular
  UNION ALL
  SELECT patient_id, prediction, 'chronic_kidney' AS table_name FROM chronic_kidney
  UNION ALL
  SELECT patient_id, prediction, 'coronary_artery_disease' AS table_name FROM coronary_artery_disease
  UNION ALL
  SELECT patient_id, prediction, 'gastrointestinal_disease' AS table_name FROM gastrointestinal_disease
  UNION ALL
  SELECT patient_id, prediction, 'heart_disease' AS table_name FROM heart_disease
  UNION ALL
  SELECT patient_id, prediction, 'juvenile_myopia' AS table_name FROM juvenile_myopia
  UNION ALL
  SELECT patient_id, prediction, 'kidney_stone' AS table_name FROM kidney_stone
  UNION ALL
  SELECT patient_id, prediction, 'liver_diseases' AS table_name FROM liver_diseases
  UNION ALL
  SELECT patient_id, prediction, 'malaria' AS table_name FROM malaria
  UNION ALL
  SELECT patient_id, prediction, 'multiple_sclerosis' AS table_name FROM multiple_sclerosis
  UNION ALL
  SELECT patient_id, prediction, 'pneumonia' AS table_name FROM pneumonia;
  
  `;

  try {
    const combinedData = await mysql.query(sqlQuery);
    res.status(200).send(combinedData);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

//---------------------Thyroid Disease API ------------------------
app.post("/getDiabeticsData", async (req, res) => {
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  let sql = `SELECT * FROM diabetes2 
            WHERE patient_id = "${patientID}" 
            order by patient_id desc limit 1`; // Assuming you have a field to order by. Adjust if needed.

  let result;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result.length <= 0) {
    res.send({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }

  const response_for_request = {
    record_id: result[0].patient_id,
    data: {
      patient_id: result[0].patient_id,
      pregs: result[0].pregs,
      gluc: result[0].gluc,
      bp: result[0].bp,
      skin: result[0].skin,
      insuli: result[0].insuli,
      bmi: 30.1,
      fun: result[0].fun,
      age: 30,
    },
  };
  // console.log(response_for_request);
  res.json(response_for_request);
});

app.post("/getOsteoporosisData", async (req, res) => {
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  let sql = `SELECT * FROM osteoporosis 
            WHERE patient_id = "${patientID}" `; // Assuming you have a field to order by. Adjust if needed.

  let result;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result.length <= 0) {
    res.send({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }
  res.json(result);
});

app.post("/getStrokePredictionData", async (req, res) => {
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Execute query
  let sql = `SELECT * FROM stroke_prediction 
            WHERE patient_id = "${patientID}" `; // Assuming you have a field to order by. Adjust if needed.

  let result;
  try {
    result = await mysql.query(sql);
  } catch (error) {
    console.log(error, "Something wrong in MySQL.");
    res.send({ error: "Something wrong in MySQL." });
    return;
  }

  // Check patient result
  if (result.length <= 0) {
    res.send({ error: "No patient matched in database." });
    console.log("No patient matched in database.");
    return;
  }
  res.json(result);
});


//patient report api
app.post("/imageRetrieveByPatientId", bodyParser.json(), async (req, res) => {
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  const recordType = req.body.recordType; // the record type, e.g. "X-Ray", this represents the collection in the database (case sensitive)
  if (!recordType) {
    res.send({ error: "Missing record type." });
    console.log("Missing record type.");

    return;
  }

  const MongoResult = await models.imageRetrieveByPatientId(
    patientID,
    recordType
  );
  res.send(MongoResult);
});

app.get("/getMedicines", async (req, res) => {
  const sql_select = "SELECT * FROM medicine";
  try {
    const result = await mysql.query(sql_select);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});

app.post("/writeDiagnosis", async (req, res) => {
  const {
    code,
    description,
    category,
    onset_date,
    status,
    notes,
    creation_date,
    updatedat,
    doctor_id,
    patient_id,
  } = req.body;

  if (!code || !description || !category || !onset_date || !status || !doctor_id || !patient_id) {
    res.status(400).send({ error: "Missing required fields." });
    return;
  }

  const sql_insert = `
    INSERT INTO diagnosis (
      code,
      description,
      category,
      onset_date,
      status,
      notes,
      creation_date,
      updatedat,
      doctor_id,
      patient_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `;

  try {
    await mysql.query(sql_insert, [
      code,
      description,
      category,
      onset_date,
      status,
      notes,
      creation_date,
      updatedat,
      doctor_id,
      patient_id,
    ]);
    res.status(200).send({ message: "Diagnosis saved successfully" });
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});

app.post("/getDiagnosisByPatientIdAndDoctorId", bodyParser.json(), async (req, res) => {
  const { patientId, doctorId } = req.body;

  if (!patientId || !doctorId) {
    res.status(400).send({ error: "Missing patient ID or doctor ID." });
    console.log("Missing patient ID or doctor ID.");
    return;
  }

  // Non-Parameterized SQL query
  const sql_select = `SELECT * FROM diagnosis WHERE patient_id = ${patientId} AND doctor_id = ${doctorId}`;

  try {
    const result = await mysql.query(sql_select);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});

app.post("/getPrescriptionsAsPharmacist", bodyParser.json(), async (req, res) => {
  const pharmacyID = req.body.pharmacyId;

  const sql_select = `SELECT prescription.*, medicine.name AS medicine_name
FROM prescription
LEFT JOIN medicine ON prescription.medicine_id = medicine.medicine_id
WHERE prescription.pharmacist_permission = ${pharmacyID}`;

  try {
    const result = await mysql.query(sql_select);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});

app.post(
  "/getPrescriptionsByPatientId",
  bodyParser.json(),
  async (req, res) => {
    const patientID = req.body.patientId; //patient ID
    if (!patientID) {
      res.send({ error: "Missing patient ID." });
      console.log("Missing patient ID.");
      return;
    }

    // Non-Parameterized SQL query
    const sql_select = `SELECT prescription.*, medicine.name AS medicine_name
FROM prescription
LEFT JOIN medicine ON prescription.medicine_id = medicine.medicine_id
WHERE prescription.patient_id = ${patientID}`;
    console.log("In Prescription");
    try {
      const result = await mysql.query(sql_select);
      console.log(result);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error in MySQL:", error);
      res.status(500).send({ error: "Something wrong in MySQL." });
    }
  }
);
app.post("/getBloodtestByPatientId", bodyParser.json(), async (req, res) => {
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Non-Parameterized SQL query
  const sql_select = `SELECT * FROM bloodtests WHERE patient_id = ${patientID}`;
  console.log("In Prescription");
  try {
    const result = await mysql.query(sql_select);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});

app.post("/getPatientReminders", async (req, res) => {
  console.log("11");
  const { patientId } = req.body;
  const sql_reminders = `SELECT * FROM medicine WHERE patient_id = ${patientId}`;

  try {
    let data = await mysql.query(sql_reminders);
    if (data.length === 0) {
      res.status(404).send({ message: "No reminders found." });
    } else {
      res.status(200).send(data);
    }
  } catch (error) {
    console.error("Error Retrieving reminder:", error);
    res.status(500).send({ error: "Error Retrieving reminder in MySQL." });
  }
});

app.post("/patientGetAppointments", async (req, res) => {
  console.log("here");
  try {
    const { patientId, startDate, endDate } = req.body;
    const result = await db.sequelize.query(
      "SELECT *, (SELECT concat_ws(' ', Fname, Mname, Lname) FROM doctors_registration as td WHERE td.id=t1.doctor) AS doctorName, (SELECT status FROM doctor_appointment_requests AS tr WHERE tr.patient=$patient_id AND tr.time_segment=t1.id) AS appointmentStatus, (SELECT description FROM doctor_appointment_requests AS tr WHERE tr.patient=$patient_id AND tr.time_segment=t1.id) AS patientDescription FROM doctor_available_time_segments AS t1 WHERE start<=$endDate AND end>=$startDate AND EXISTS (SELECT 1 FROM doctor_recordauthorized AS ta WHERE ta.doctor_id=t1.doctor AND ta.patient_id=$patient_id)",
      {
        bind: { startDate, endDate, patient_id: patientId },
        type: QueryTypes.SELECT,
      }
    );

    res.json({
      status: "OK",
      result: result.map((record) => ({
        ...record,
        doctor: { id: record.doctor, name: record.doctorName },
      })),
    });
    console.log(res.result);
  } catch (error) {
    console.error("Error patientGetCalendar:", error);
    res.status(500).json({ status: "InternalServerError" });
  }
});
app.post("/PcosDetection", bodyParser.json(), async (req, res) => {
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  const recordType = req.body.recordType; // the record type, e.g. "X-Ray", this represents the collection in the database (case sensitive)
  if (!recordType) {
    res.send({ error: "Missing record type." });
    console.log("Missing record type.");

    return;
  }

  const MongoResult = await models.imageRetrieveByPatientId(
    patientID,
    recordType
  );
  console.log(MongoResult.success[0].file);
  const fileBuffer = Buffer.from(MongoResult.success[0].file.buffer, "base64");
  const form = new FormData();
  form.append("file", fileBuffer, {
    filename: MongoResult.success[0].file.originalname,
    contentType: MongoResult.success[0].file.mimetype,
  });
  axios
    .post("https://pcosseg2024-bb8d21552ba5.herokuapp.com/", form, {
      headers: form.getHeaders(),
    })
    .then((response) => {
      console.log("Success:", response.data);
      res.send(response);
    })
    .catch((error) => {
      console.error("Error:", error);
      res.send(error);
    });
});

app.post("/getCoronaryArteryDisease", bodyParser.json(), async (req, res) => {
  console.log("getCoronaryArteryDisease");
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Non-Parameterized SQL query
  const sql_select = `SELECT * FROM coronary_artery_disease_angina WHERE patient_id = ${patientID}`;

  try {
    const result = await mysql.query(sql_select);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});
app.post("/getDementiaDetection", bodyParser.json(), async (req, res) => {
  console.log("getCoronaryArteryDisease");
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Non-Parameterized SQL query
  const sql_select = `SELECT * FROM dementia_detection WHERE patient_id = ${patientID}`;

  try {
    const result = await mysql.query(sql_select);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});
app.post("/getRheumatoidArthritis", bodyParser.json(), async (req, res) => {
  console.log("getCoronaryArteryDisease");
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Non-Parameterized SQL query
  const sql_select = `SELECT * FROM rheumatoid_arthritis WHERE patient_id = ${patientID}`;

  try {
    const result = await mysql.query(sql_select);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});
app.post("/getChronicKidney", bodyParser.json(), async (req, res) => {
  console.log("getChronicKidney");
  const patientID = req.body.patientId; //patient ID
  if (!patientID) {
    res.send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  // Non-Parameterized SQL query
  const sql_select = `SELECT * FROM chronic_kidney_win24 WHERE patient_id = ${patientID}`;

  try {
    const result = await mysql.query(sql_select);
    console.log(result);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});
app.post(
  "/getCoronaryArteryPrediction",
  bodyParser.json(),
  async (req, res) => {
    console.log("getChronicKidney");
    const patientID = req.body.patientId; //patient ID
    if (!patientID) {
      res.send({ error: "Missing patient ID." });
      console.log("Missing patient ID.");
      return;
    }

    // Non-Parameterized SQL query
    const sql_select = `SELECT * FROM heart_disease_win2024_2 WHERE patient_id = ${patientID}`;

    try {
      const result = await mysql.query(sql_select);
      console.log(result);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error in MySQL:", error);
      res.status(500).send({ error: "Something wrong in MySQL." });
    }
  });

app.post("/getAlzheimer", bodyParser.json(), async (req, res) => {
  console.log("getAlzheimer");
  const patientID = req.body.patientId;
  if (!patientID) {
    res.status(400).send({ error: "Missing patient ID." });
    console.log("Missing patient ID.");
    return;
  }

  const sqlQuery = `
    SELECT * FROM patients_registration pr
    INNER JOIN synthetic s ON pr.id = s.patient_id
    WHERE pr.id = ?`;

  try {
    const [result] = await db.sequelize.query(sqlQuery, {
      replacements: [patientID],
      type: QueryTypes.SELECT,
    });

    if (!result) {
      res.status(404).send({ error: "Patient not found." });
      return;
    }

    // Transform the data to match the format expected by main.py
    const transformedData = {
      age: result.Age,
      gender: result.Gender === 'Male' ? 1 : 0,
      education: result.education,
      race: result.race,
      social_class: result.social_class,
      physical_activity: result.physical_activity,
      poor_diet: result.poor_diet,
      viruses: result.viruses,
      smoking: result.smoking,
      micro_infarcts: result.micro_infarcts,
      depression: result.depression,
      early_stress: result.early_stress,
      air_pollution: result.air_pollution,
      calcium_deficiency: result.calcium_deficiency,
      alcohol: result.alcohol,
      organic_solvents: result.organic_solvents,
      vitamin_deficiency: result.vitamin_deficiency,
      dental_infection: result.dental_infection,
      fungi_infection: result.fungi_infection,
      bacteria_infection: result.bacteria_infection,
      lack_of_cognitive_activity: result.lack_of_cognitive_activity,
      poor_cholesterol_homeostasis: result.poor_cholesterol_homeostasis,
      cardiovascular_disease: result.cardiovascular_disease,
      congestive_heart_failure: result.congestive_heart_failure,
      metals: result.metals,
      malnutrition: result.malnutrition,
      immune_system_dysfunction: result.immune_system_dysfunction,
      obesity: result.obesity,
      poor_controlled_type2_diabetes: result.poor_controlled_type2_diabetes,
      stroke: result.stroke,
      family_history_of_dementia: result.family_history_of_dementia,
      traumatic_brain_injury: result.traumatic_brain_injury,
      cancer: result.cancer,
      dob: result.date_of_birth,
    };

    // Send the transformed data to the Python backend
    try {
      const pythonResponse = await axios.post('https://e-react-frontend-55dbf7a5897e.herokuapp.com/predict', transformedData);
      res.json(pythonResponse.data);
    } catch (error) {
      console.error("Error calling Python backend:", error);
      res.status(500).send({ error: "Error calling Python backend." });
    }

  } catch (error) {
    console.error("Error in database query:", error);
    res.status(500).send({ error: "Something went wrong in the database query." });
  }
});


const tables = [
  "blood_sugar_analysis",
  "diabetes_analysis",
  "heart_disease_analysis",
  "lung_cancer_analysis",
  "patients_analysis",
];

tables.forEach((table) => {
  app.post(`/get${table.charAt(0).toUpperCase() + table.slice(1)}`, async (req, res) => {
    try {
      const results = await db.sequelize.query(`SELECT * FROM ${table}`, {
        type: QueryTypes.SELECT,
      });

      res.json(results);
    } catch (error) {
      res.status(500).send({ error: `Error querying ${table}.` });
    }
  });
});

app.get("/table/:table_name", async (req, res) => {
  console.log("Table name:", req.params.table_name);
  const tableName = req.params.table_name;
  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    res.status(400).send({ error: "Invalid table name." });
    return;
  }
  const sql = `SELECT * FROM \`${tableName}\` LIMIT 100;`;
  try {
    const result = await mysql.query(sql);
    res.json(result);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

app.post("/table/:table_name", (req, res) => {
  const tableName = req.params.table_name;

  if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    res.status(400).send({ error: "Invalid table name." });
    return;
  }

  const data = req.body;

  if (!data || Object.keys(data).length === 0) {
    res.status(400).send({ error: "No data provided" });
    return;
  }

  const setClause = Object.entries(data).map(([key, value]) => {
    return `\`${key}\` = '${value}'`;
  }).join(', ');

  const sqlInsert = `INSERT INTO \`${tableName}\` SET ${setClause}`;

  console.log("SQL:", sqlInsert);

  mysql.query(sqlInsert, (error, results) => {
    if (error) {
      console.log("Error:", error);
      res.status(400).send({ error: error.message });
    } else {
      res.status(201).json({ message: "Data inserted successfully" });
    }
  });
});

app.get("/getPharmacies", async (req, res) => {
  const sql_select = "SELECT * FROM pharmacy_registration";
  try {
    const result = await mysql.query(sql_select);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error in MySQL:", error);
    res.status(500).send({ error: "Something wrong in MySQL." });
  }
});



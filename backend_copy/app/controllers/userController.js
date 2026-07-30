const db = require("../../db");
const { QueryTypes } = require("sequelize");

function parseTrialId(value) {
  const text = value == null ? "" : String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const numeric = Number(text);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

const MAX_LOCAL_SEQUENCE_TRIAL_ID = 999;

async function getClinicalTrialsAutoIncrementNextId() {
  const rows = await db.sequelize.query(
    `
    SELECT AUTO_INCREMENT AS nextId
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'clinical_trials'
    `,
    { type: QueryTypes.SELECT }
  );
  return Number(rows[0]?.nextId) || 1;
}

async function ensureClinicalTrialIdSequence() {
  await db.sequelize.query(`
    CREATE TABLE IF NOT EXISTS clinical_trial_id_sequence (
      id TINYINT PRIMARY KEY DEFAULT 1,
      next_trial_id INT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const autoIncrementNextId = await getClinicalTrialsAutoIncrementNextId();
  const [smallIdRow] = await db.sequelize.query(
    `
    SELECT COALESCE(MAX(trial_id), 0) + 1 AS nextSmallTrialId
    FROM clinical_trials
    WHERE trial_id > 0
      AND trial_id <= :maxLocalSequenceTrialId
    `,
    {
      replacements: { maxLocalSequenceTrialId: MAX_LOCAL_SEQUENCE_TRIAL_ID },
      type: QueryTypes.SELECT,
    }
  );
  const nextSmallTrialId = Number(smallIdRow?.nextSmallTrialId) || 1;
  const startingTrialId = Math.max(autoIncrementNextId, nextSmallTrialId);

  await db.sequelize.query(
    `
    INSERT INTO clinical_trial_id_sequence (id, next_trial_id)
    VALUES (1, :startingTrialId)
    ON DUPLICATE KEY UPDATE
      next_trial_id = GREATEST(next_trial_id, VALUES(next_trial_id))
    `,
    {
      replacements: { startingTrialId },
      type: QueryTypes.INSERT,
    }
  );
}

async function getClinicalTrialIdSequenceNextId() {
  await ensureClinicalTrialIdSequence();
  const rows = await db.sequelize.query(
    `
    SELECT next_trial_id
    FROM clinical_trial_id_sequence
    WHERE id = 1
    `,
    { type: QueryTypes.SELECT }
  );
  return Number(rows[0]?.next_trial_id) || 1;
}

async function advanceClinicalTrialIdSequence(nextTrialId) {
  await ensureClinicalTrialIdSequence();
  await db.sequelize.query(
    `
    UPDATE clinical_trial_id_sequence
    SET next_trial_id = GREATEST(next_trial_id, :nextTrialId)
    WHERE id = 1
    `,
    {
      replacements: { nextTrialId },
      type: QueryTypes.UPDATE,
    }
  );
}

exports.getDoctors = async (req, res) => {
  try {
    const doctors = await db.sequelize.query(
      "SELECT id, Fname, Mname, Lname from doctors_registration",
      {
        type: QueryTypes.SELECT,
      }
    );
    console.log("getDoctors", doctors);

    const formattedDoctors = doctors.map((doctor) => {
      const fullName = [doctor.Fname, doctor.Mname, doctor.Lname]
        .filter(Boolean) //filter falsy values(null, undefined, 0, '', false)
        .join(" ");
      return {
        id: doctor.id,
        name: fullName,
      };
    });

    console.log("getDoctors", formattedDoctors);

    res.json({
      status: "OK",
      result: {
        doctors: formattedDoctors,
      },
    });
  } catch (error) {
    console.error("Error getDoctorProfile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getDoctorProfile = async (req, res) => {
  try {
    const { id } = req.body;
    const doctor = (await db.sequelize.query("SELECT * from doctors_registration WHERE id=$doctor", {
      bind: { doctor: id },
      type: QueryTypes.SELECT,
    }))[0];
  //  console.log("getDoctorProfile doctor", doctor)
    const datetimeStr = doctor.date_of_birth;

    // 使用Date对象解析
    const date = new Date(datetimeStr);

    // 使用toISOString()方法然后截取前10个字符来获取年月日部分
    const dateOnly = date.toISOString().substring(0, 10);
    res.json({ status: 'OK', result: {
      firstName: doctor.Fname,
      lastName: doctor.Lname,
      email: doctor.EmailId,
      age: doctor.Age,
      mobile: doctor.MobileNumber,
      address1: doctor.Location1,
      address2: doctor.Location2,
      city: doctor.City,
      zip: doctor.PostalCode,
      specialization: doctor.Specialization,
      birthday:dateOnly,
      medicalLicenseNumber: doctor.Medical_LICENSE_Number,
    }});

  } catch (error) {
    console.error("Error getDoctorProfile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.setDoctorProfile = async (req, res) => {
  try {
//    console.log(req.body)
    await db.sequelize.query("UPDATE doctors_registration SET date_of_birth=$Birthday, Fname=$Fname, Lname=$Lname, EmailId=$EmailId, MobileNumber=$MobileNumber, Location1=$Location1, Location2=$Location2, City=$City, PostalCode=$PostalCode, Specialization=$Specialization, Medical_LICENSE_Number=$Medical_LICENSE_Number WHERE id=$doctor", {
      bind: {
        doctor: req.body.id,

        Fname: req.body.firstName,
        Lname: req.body.lastName,
        EmailId: req.body.email,
        MobileNumber: req.body.mobile,
        Location1: req.body.address1,
        Location2: req.body.address2,
        City: req.body.city,
        PostalCode: req.body.zip,
        Specialization: req.body.specialization,
        Birthday:req.body.birthday,
        Medical_LICENSE_Number: req.body.medicalLicenseNumber,
      },
      type: QueryTypes.UPDATE,
    });

    res.json({ status: "OK" });
  } catch (error) {
    console.error("Error setDoctorProfile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.setDoctorPassword = async (req, res) => {
  try {
    const { id, oldPassword, newPassword } = req.body;
    const doctor = (
      await db.sequelize.query(
        "SELECT id, password from doctors_registration WHERE id=$doctor",
        {
          bind: { doctor: id },
          type: QueryTypes.SELECT,
        }
      )
    )[0];
    if (!(doctor.id === id && doctor.password === oldPassword)) {
      res.json({ status: "PasswordMismatch" });
      return;
    }

    await db.sequelize.query(
      "UPDATE doctors_registration SET password=$newPassword WHERE id=$doctor",
      {
        bind: {
          doctor: id,
          newPassword,
        },
        type: QueryTypes.UPDATE,
      }
    );

    res.json({ status: "OK" });
  } catch (error) {
    console.error("Error setDoctorPassword:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const tables = await db.sequelize.query("SHOW TABLES", {
      type: QueryTypes.SHOWTABLES,
      database: dbConfig.DB,
    });
    //console.log("tables:", tables);
    res.json(tables);
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllPatients = async (req, res) => {
  console.log("pateints");

  try {
    const patients = await db.sequelize.query(
      "SELECT * FROM patients_registration",
      { type: QueryTypes.SELECT }
    );
    //console.log("pateints",patients)
    res.json(patients);
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getPatientProfile = async (req, res) => {
  try {
    const { id } = req.body;

    const patients = await db.sequelize.query(
      "SELECT pr.*, dr.Fname AS doctorFirstName FROM patients_registration AS pr LEFT JOIN patient_doctor AS pd ON pr.id = pd.patient_id LEFT JOIN doctors_registration AS dr ON pd.doctor_id = dr.id WHERE pr.id = $patientId",
      {
        bind: { patientId: id },
        type: QueryTypes.SELECT,
      }
    );

    const patient_doctor = await db.sequelize.query(
      "SELECT dr.Fname, dr.Lname, dr.id FROM patient_doctor AS pd JOIN doctors_registration AS dr ON pd.doctor_id = dr.id WHERE pd.patient_id = $patientId;",
      {
        bind: { patientId: id },
        type: QueryTypes.SELECT,
      }
    );

    if (patient_doctor.length > 0) {
      doctorName =
        patient_doctor[0].Fname +
        " " +
        patient_doctor[0].Lname +
        ", " +
        patient_doctor[0].id;
    }

    const patient = patients[0];
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    console.log("getPatientProfile patient", patient);

    res.json({
      status: "OK",
      result: {
        firstName: patient.FName,
        lastName: patient.LName,
        email: patient.EmailId,
        dateOfBirth: patient.date_of_birth,
        mobile: patient.MobileNumber,
        address1: patient.Address,
        address2: patient.Location,
        city: patient.City,
        zip: patient.PostalCode,
        specialization: patient.Specialization,

        healthCardNumber: patient.HCardNumber,
        familyDoctor: doctorName,
      },
    });
  } catch (error) {
    console.error("Error getDoctorProfile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.setPatientProfile = async (req, res) => {
  try {
    // console.log("setPatientProfile", req.body);
    const date = new Date(req.body.dateOfBirth);
    const birthday = date.toISOString().split("T")[0];
    await db.sequelize.query(
      "UPDATE patients_registration SET Fname=$Fname, Lname=$Lname, EmailId=$EmailId, MobileNumber=$MobileNumber, Address=$Location1, Location=$Location2, City=$City, PostalCode=$PostalCode, HCardNumber=$HCardNumber, date_of_birth=$birthday WHERE id=$patient",
      {
        bind: {
          patient: req.body.id,

          Fname: req.body.firstName,
          Lname: req.body.lastName,
          EmailId: req.body.email,
          MobileNumber: req.body.mobile,
          Location1: req.body.address1,
          Location2: req.body.address2,
          City: req.body.city,
          PostalCode: req.body.zip,

          HCardNumber: req.body.healthCardNumber,
          birthday: birthday,
        },
        type: QueryTypes.UPDATE,
      }
    );
    // console.log("setPatientProfile First SQL success");
    const doctorId = req.body.familyDoctor.split(", ")[1];
    // console.log("setPatientProfile doctorId", doctorId);

    const existingAssociations = await db.sequelize.query(
      "SELECT * FROM patient_doctor WHERE patient_id = $patient",
      {
        bind: {
          patient: req.body.id,
        },
        type: db.sequelize.QueryTypes.SELECT,
      }
    );
    // console.log("setPatientProfile existingAssociations", existingAssociations);
    const currentDate = new Date().toISOString();

    if (existingAssociations.length > 0) {
      await db.sequelize.query(
        "UPDATE patient_doctor SET doctor_id = $doctor, relationship_status = 'active', record_date = $currentDate, association_type = 'family_doctor' WHERE patient_id = $patient",
        {
          bind: {
            doctor: doctorId,
            currentDate: currentDate,
            patient: req.body.id,
          },
          type: db.sequelize.QueryTypes.UPDATE,
        }
      );
    } else {
      await db.sequelize.query(
        "INSERT INTO patient_doctor (patient_id, doctor_id, relationship_status, association_type, record_date, relationship_start_date) VALUES ($patient, $doctor, 'active', 'family_doctor', $currentDate, $currentDate)",
        {
          bind: {
            patient: req.body.id,
            doctor: doctorId,
            currentDate: currentDate,
          },
          type: db.sequelize.QueryTypes.INSERT,
        }
      );
    }

    res.json({ status: "OK", message: "Operation successful" });
  } catch (error) {
    console.error("Error setPatientProfile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.setPatientPassword = async (req, res) => {
  try {
    const { id, oldPassword, newPassword } = req.body;
    const patient = (
      await db.sequelize.query(
        "SELECT id, password from patients_registration WHERE id=$patient",
        {
          bind: { patient: id },
          type: QueryTypes.SELECT,
        }
      )
    )[0];
    if (!(patient.id === id && patient.password === oldPassword)) {
      res.json({ status: "PasswordMismatch" });
      return;
    }

    await db.sequelize.query(
      "UPDATE patients_registration SET password=$newPassword WHERE id=$patient",
      {
        bind: {
          patient: id,
          newPassword,
        },
        type: QueryTypes.UPDATE,
      }
    );

    res.json({ status: "OK" });
  } catch (error) {
    console.error("Error setDoctorPassword:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getPatientPeriodicMeasurements = async (req, res) => {
  const { patientId } = req.body; // Get the patient ID from the request body

  // Construct the query to fetch the patient's periodic measurement data
  const query = `
    SELECT trend_id, patient_id, measurement_type, value, unit, measurement_date, created_at
    FROM periodic_measurements
    WHERE patient_id = :patientId;
  `;

  try {
    // Fetch results using the constructed query
    const results = await db.sequelize.query(query, {
      replacements: { patientId },  // Replacing patientId into the query
      type: db.Sequelize.QueryTypes.SELECT,
    });

    // Check if any data was found
    if (results.length === 0) {
      return res.status(404).json({
        status: 'Not Found',
        message: 'No periodic measurement data found for this patient',
      });
    }

    // Return the results with a success status
    res.status(200).json({
      status: 'OK',
      result: results, // Return the data for the patient
    });
  } catch (error) {
    console.error("Error fetching patient periodic measurements:", error);
    res.status(500).json({
      status: 'Error',
      message: 'Internal server error',
    });
  }
};



exports.getPatientList = async (req, res) => {
  try {
    const doctors = (await db.sequelize.query(
      "SELECT t1.*, concat_ws(' ', t1.FName, t1.MName, t1.LName) as name, td.id as doctor_id, concat_ws(' ', td.Fname, td.Mname, td.Lname) as doctor_name from patients_registration as t1 LEFT JOIN doctor_recordauthorized as tr ON t1.id=tr.patient_id LEFT JOIN doctors_registration as td ON tr.doctor_id=td.id",
      {
        type: QueryTypes.SELECT,
      }
    ));
    console.log("getUnverifiedDoctors", doctors);

    res.json({
      status: "OK",
      result: doctors,
    });
  } catch (error) {
    console.error("Error getUnverifiedDoctors:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getUnverifiedDoctors = async (req, res) => {
  try {
    const doctors = await db.sequelize.query(
      "SELECT id, concat_ws(' ', Fname, Mname, Lname) as name, EmailId, verification from doctors_registration",
      {
        type: QueryTypes.SELECT,
      }
    );
    console.log("getUnverifiedDoctors", doctors);

    res.json({
      status: "OK",
      result: doctors,
    });
  } catch (error) {
    console.error("Error getUnverifiedDoctors:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.verifyDoctor = async (req, res) => {
  try {
    const { doctorId, newState } = req.body;
    await db.sequelize.query(
      "UPDATE doctors_registration SET verification=$newState WHERE id=$doctorId",
      {
        bind: {
          doctorId,
          newState,
        },
        type: QueryTypes.UPDATE,
      }
    );
    console.log("verifyDoctor", req);

    res.json({
      status: "OK",
    });
  } catch (error) {
    console.error("Error verifyDoctor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


exports.getTickets = async (req, res) => {
  try {
    const tickets = await db.sequelize.query(
      "SELECT * from clinic_help",
      {
        type: QueryTypes.SELECT,
      }
    );
    console.log("getTickets", tickets);

    res.json({
      status: "OK",
      result: tickets,
    });
  } catch (error) {
    console.error("Error getTickets:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

//获取单个医药公司所有临床试验信息
exports.getClinicalTrialsList = async (req, res) => {
  
  const { companyId } = req.body;

  if (!companyId) {
    return res.status(400).json({ error: "Can not found the trials information of the company!" });
  }

  try {
    const sqlQuery = `SELECT trial_name, trial_id, 
    CASE 
        WHEN trial_status = 0 THEN 'Under Review' 
        WHEN trial_status = 1 THEN 'Ongoing' 
        WHEN trial_status = 2 THEN 'Completed'
        WHEN trial_status = 3 THEN 'Rejected' 
        ELSE 'Error' 
    END AS trial_status
  FROM clinical_trials WHERE company_id = :companyId;`;

    const trials = await db.sequelize.query(sqlQuery,
      {
        replacements: { companyId },
        type: QueryTypes.SELECT,
      }
    );
    res.json({ status: 'OK', result: trials });
  } catch (error) {
    console.error('Error fetching clinical trials:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

//获取单个医药公司所有临床试验的详细信息
exports.getDetailedClinicalTrialsList = async (req, res) => {
  
  const { companyId } = req.body;
  if (!companyId) {
    return res.status(400).json({ error: "Can not found the trials information of the company!" });
  }

  try {
    const sqlQuery = `SELECT trial_name, trial_id, related_conditions,
    CASE 
        WHEN trial_status = 0 THEN 'Under Review' 
        WHEN trial_status = 1 THEN 'Ongoing' 
        WHEN trial_status = 2 THEN 'Completed'
        WHEN trial_status = 3 THEN 'Rejected'
        ELSE 'Error' 
    END AS trial_status,
    trial_phase, study_type, locations, principal_investigator, sponsor, ethics_approval
    FROM clinical_trials WHERE company_id = :companyId;`;

    const trials = await db.sequelize.query(sqlQuery,
      {
        replacements: { companyId },
        type: QueryTypes.SELECT,
      }
    );
    res.json({ status: 'OK', result: trials });
  } catch (error) {
    console.error('Error fetching detailed clinical trials:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

//检查试验id是否存在
exports.checkExistingClinicalTrialsId = async (req, res) => {
  const { trialId } = req.body;
  const numericTrialId = parseTrialId(trialId);

  if (numericTrialId == null) {
    return res.status(400).json({ status: 'ERROR', message: 'Invalid trialId' });
  }

  const sqlQuery = `
    SELECT trial_id
    FROM clinical_trials
    WHERE trial_id = :trialId
  `;

  try {
    const sequenceNextId = await getClinicalTrialIdSequenceNextId();
    if (numericTrialId < sequenceNextId) {
      return res.json({ status: 'OK', result: true });
    }

    const result = await db.sequelize.query(sqlQuery, {
      replacements: { trialId: numericTrialId },
      type: QueryTypes.SELECT,
    });

    const exists = result.length > 0;

    res.json({ status: 'OK', result: exists });

  } catch (error) {
    console.error('Error checking if clinical trials id existed:', error);
    res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
  }
};

// 创建新的试验
exports.getNextClinicalTrialId = async (req, res) => {
  try {
    let candidate = await getClinicalTrialIdSequenceNextId();

    const usedRows = await db.sequelize.query(
      `
      SELECT trial_id
      FROM clinical_trials
      WHERE trial_id >= :candidate
      ORDER BY trial_id ASC
      `,
      {
        replacements: { candidate },
        type: QueryTypes.SELECT,
      }
    );
    const usedIds = new Set(usedRows.map((row) => Number(row.trial_id)));
    while (usedIds.has(candidate)) candidate += 1;
    await advanceClinicalTrialIdSequence(candidate);

    res.json({ status: 'OK', result: candidate });
  } catch (error) {
    console.error('Error fetching next clinical trial id:', error);
    res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
  }
};

exports.updateClinicalTrialStatus = async (req, res) => {
  const { trialId, status } = req.body;
  const numericTrialId = parseTrialId(trialId);
  const numericStatus = Number(status);

  if (numericTrialId == null) {
    return res.status(400).json({ status: 'ERROR', message: 'Invalid trialId' });
  }
  if (!Number.isInteger(numericStatus) || numericStatus < 0 || numericStatus > 3) {
    return res.status(400).json({ status: 'ERROR', message: 'Invalid trial status' });
  }

  const statusLabels = {
    0: 'Under Review',
    1: 'Ongoing',
    2: 'Completed',
    3: 'Rejected',
  };

  try {
    const existingTrial = await db.sequelize.query(
      `
      SELECT trial_id
      FROM clinical_trials
      WHERE trial_id = :trialId
      `,
      {
        replacements: { trialId: numericTrialId },
        type: QueryTypes.SELECT,
      }
    );
    if (existingTrial.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Clinical trial was not found.',
      });
    }

    await db.sequelize.query(
      `
      UPDATE clinical_trials
      SET trial_status = :status
      WHERE trial_id = :trialId
      `,
      {
        replacements: { trialId: numericTrialId, status: numericStatus },
        type: QueryTypes.UPDATE,
      }
    );
    res.json({
      status: 'OK',
      result: {
        trialId: numericTrialId,
        status: numericStatus,
        statusLabel: statusLabels[numericStatus],
      },
    });
  } catch (error) {
    console.error('Error updating clinical trial status:', error);
    res.status(500).json({ status: 'ERROR', message: 'Internal server error' });
  }
};

exports.createNewClinicalTrials = async (req, res) => {
  const { formDataToSubmit, companyInfo } = req.body;
  const { 
    firstName, 
    middleName, 
    lastName, 
    phone: areaCode, // 确保这里的 phone 实际上是区号
    phoneNumber, 
    email,
    trialId,
    trialName,
    officialTitle,
    briefSummary,
    detailedDescription,
    relatedConditions,
    startDate,
    endDate,
    primaryPurpose,
    trialPhase,
    studyType,
    allocation,
    interventionModel,
    masking,
    maskingDetails,
    sponsor,
    principalInvestigator,
    pathology,
    ageRange,
    gender,
    bmi,
    diseases, // 现在是字符串
    surgeries, // 现在是字符串
    priorMedications,
    pregnancy,
    country,
    region,
    ethicsApproval
  } = formDataToSubmit;

  // 公司信息
  const numericTrialId = parseTrialId(trialId);
  if (numericTrialId == null) {
    return res.status(400).json({ status: 'ERROR', message: 'Invalid trialId' });
  }

  const { id: companyId, name: companyName } = companyInfo;

  // 联系人信息
  const contactInfo = {
    firstName, 
    middleName, 
    lastName, 
    areaCode, 
    phoneNumber, 
    email,
    trialId: numericTrialId
  };

  // 处理 masking 和 maskingDetails 的组合
  const maskingCombined = masking === "None (Open Label)" ? masking : `${masking} (${Object.keys(maskingDetails).filter(key => maskingDetails[key]).join(', ')})`;

  // 格式化日期为 YYYY-MM-DD
  const formattedStartDate = startDate ? new Date(startDate).toISOString().split('T')[0] : null;
  const formattedEndDate = endDate ? new Date(endDate).toISOString().split('T')[0] : null;

  // 临床试验信息
  const trialInfo = {
    trialName,
    trialId: numericTrialId,
    officialTitle,
    briefSummary,
    detailedDescription,
    relatedConditions,
    startDate: formattedStartDate,
    endDate: formattedEndDate,
    primaryPurpose,
    trialPhase,
    studyType,
    allocation,
    interventionModel,
    masking: maskingCombined,
    sponsor,
    principalInvestigator,
    pathology,
    ageRange,
    gender,
    exclusionCriteria: JSON.stringify({
      BMI: bmi,
      Diseases: diseases, // 直接是字符串
      Surgeries: surgeries, // 直接是字符串
      PriorMedications: priorMedications,
      Pregnancy: pregnancy
    }),
    locations: `${region}, ${country}`,
    trialStatus: 0, // 添加试验状态，默认值为 0
    ethicsApproval
  };

  try {
    const sequenceNextId = await getClinicalTrialIdSequenceNextId();
    if (numericTrialId < sequenceNextId) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Trial ID has already been used. Choose another trial ID.',
      });
    }

    // 插入联系人信息到 clinical_trials_contacts 表
    const existingTrial = await db.sequelize.query(
      `
      SELECT trial_id
      FROM clinical_trials
      WHERE trial_id = :trialId
      `,
      {
        replacements: { trialId: numericTrialId },
        type: QueryTypes.SELECT,
      }
    );
    if (existingTrial.length > 0) {
      return res.status(409).json({
        status: 'ERROR',
        message: 'Trial ID already exists. Choose another trial ID.',
      });
    }

    const insertContactSql = `
      INSERT INTO clinical_trials_contacts (trial_id, first_name, middle_name, last_name, area_code, phone_number, email)
      VALUES (:trialId, :firstName, :middleName, :lastName, :areaCode, :phoneNumber, :email)
    `;
    await db.sequelize.query(insertContactSql, {
      replacements: contactInfo,
      type: QueryTypes.INSERT
    });

    // 插入临床试验信息到 clinical_trials 表
    const insertTrialSql = `
      INSERT INTO clinical_trials (company_name, company_id, trial_name, trial_id, official_title, brief_summary, detailed_description, related_conditions, trial_status, trial_phase, study_type, allocation, intervention_model, masking, primary_purpose, locations, principal_investigator, sponsor, ethics_approval, pathology, age_range, gender, exclusion_criteria, start_date, end_date)
      VALUES (:companyName, :companyId, :trialName, :trialId, :officialTitle, :briefSummary, :detailedDescription, :relatedConditions, :trialStatus, :trialPhase, :studyType, :allocation, :interventionModel, :masking, :primaryPurpose, :locations, :principalInvestigator, :sponsor, :ethicsApproval, :pathology, :ageRange, :gender, :exclusionCriteria, :startDate, :endDate)
    `;
    await db.sequelize.query(insertTrialSql, {
      replacements: {
        ...trialInfo,
        companyName,
        companyId
      },
      type: QueryTypes.INSERT
    });
    await advanceClinicalTrialIdSequence(numericTrialId + 1);

    // 获取刚插入的 trialId
    const getInsertedTrialIdSql = `
      SELECT trial_id 
      FROM clinical_trials 
      WHERE trial_id = :trialId
    `;
    const insertedTrial = await db.sequelize.query(getInsertedTrialIdSql, {
      replacements: { trialId: numericTrialId },
      type: QueryTypes.SELECT
    });

    if (insertedTrial.length > 0) {
      const insertedTrialId = insertedTrial[0].trial_id;

      // 插入新动作到 clinicaltrials_actions 表
      const insertActionSql = `
        INSERT INTO clinicaltrials_actions (ActionType, TrialID, InitiatorType, InitiatorID, IsCompleted, Timestamp)
        VALUES (0, :trialId, 1, :companyId, false, CURRENT_TIMESTAMP)
      `;
      await db.sequelize.query(insertActionSql, {
        replacements: { trialId: insertedTrialId, companyId },
        type: QueryTypes.INSERT
      });

      // 获取刚插入的 ActionID
      const getInsertedActionIdSql = `
        SELECT ActionID 
        FROM clinicaltrials_actions 
        WHERE TrialID = :trialId
      `;
      const insertedAction = await db.sequelize.query(getInsertedActionIdSql, {
        replacements: { trialId: insertedTrialId },
        type: QueryTypes.SELECT
      });

      if (insertedAction.length > 0) {
        const insertedActionId = insertedAction[0].ActionID;

        // 从 clinical_staff_registration 表中随机获取一个用户的 id
        const getRandomWebStaffIdSql = `
          SELECT id 
          FROM clinical_staff_registration 
          ORDER BY RAND() 
          LIMIT 1
        `;
        const randomWebStaff = await db.sequelize.query(getRandomWebStaffIdSql, {
          type: QueryTypes.SELECT
        });

        if (randomWebStaff.length > 0) {
          const randomWebStaffId = randomWebStaff[0].id;

          // 插入新请求到 clinicaltrials_actionrequests 表
          const insertRequestSql = `
          INSERT INTO clinicaltrials_actionrequests (ActionID, ReceivedUserType, ReceivedUserID, ReadStatus, Note, IsPrimaryRequest, Timestamp)
          VALUES (:actionId, 0, :userId, false, CONCAT('Company ', :companyName, ' applied for trial ', :trialName), true, CURRENT_TIMESTAMP)
        `;        
        await db.sequelize.query(insertRequestSql, {
          replacements: { actionId: insertedActionId, userId: randomWebStaffId, companyName, trialName },
          type: QueryTypes.INSERT
        });        
        }
      }
    }

    res.status(200).json({ result: 'Clinical trial created successfully', data: { contactInfo, trialInfo } });
  } catch (error) {
    console.error("Error creating new clinical trial:", error);
    res.status(500).json({ error: 'Failed to create clinical trial' });
  }
};

//提取当前指定的临床试验的详细信息
exports.getSpecificClinicalTrialsInfo = async (req, res) => {
  
  const { trial_id } = req.body;

  if (!trial_id) {
    return res.status(400).json({ error: "Can not found the specific clinical trials information!" });
  }

  try {
    const sqlQuery = `SELECT ct.*,
    CASE
        WHEN ct.trial_status = 0 THEN 'Under Review'
        WHEN ct.trial_status = 1 THEN 'Ongoing'
        WHEN ct.trial_status = 2 THEN 'Completed'
        WHEN ct.trial_status = 3 THEN 'Rejected'
        ELSE 'Error'
    END AS trial_status,
    ctc.first_name AS contact_first_name,
    ctc.middle_name AS contact_middle_name,
    ctc.last_name AS contact_last_name,
    ctc.area_code AS contact_area_code,
    ctc.phone_number AS contact_phone_number,
    ctc.email AS contact_email
    FROM clinical_trials ct
    LEFT JOIN clinical_trials_contacts ctc
      ON ctc.trial_id = ct.trial_id
    WHERE ct.trial_id = :trial_id
    ORDER BY ctc.id
    LIMIT 1;`;

    const specificTrialsInfo = await db.sequelize.query(sqlQuery,
      {
        replacements: { trial_id },
        type: QueryTypes.SELECT,
      }
    );
    res.json({ status: 'OK', result: specificTrialsInfo });
  } catch (error) {
    console.error('Error fetching specific clinical trials information:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

//获取特定临床试验对应的已注册患者列表
exports.getSpecificClinicalTrialsPatients = async (req, res) => {
  const { trial_id } = req.body;

  if (!trial_id) {
    return res.status(400).json({ error: "Can not found the specific clinical trials information!" });
  }

  try {
    // 第一步：查找 clinicaltrials_patients 中对应 trial_id 的所有条目
    const sqlQuery1 = `
      SELECT 
        trial_id,
        patient_id,
        enrollment_date,
        doctor_ids
      FROM 
        clinicaltrials_patients
      WHERE 
        trial_id = :trial_id;
    `;
    const patients = await db.sequelize.query(sqlQuery1, {
      replacements: { trial_id },
      type: QueryTypes.SELECT,
    });

    if (!patients.length) {
      return res.status(404).json({ error: "No patients found for the specified trial." });
    }

    // 第二步：获取病人 ID 和医生信息
    const result = [];
    for (const patient of patients) {
      const { patient_id, doctor_ids } = patient;

      // 查找病人信息
      const patientQuery = `
        SELECT 
          CONCAT(FName, ' ', COALESCE(MName, ''), ' ', LName) AS patient_full_name
        FROM 
          patients_registration
        WHERE 
          id = :patient_id;
      `;
      const patientInfo = await db.sequelize.query(patientQuery, {
        replacements: { patient_id },
        type: QueryTypes.SELECT,
      });

      let patient_full_name = 'Unknown';
      if (patientInfo.length) {
        patient_full_name = patientInfo[0].patient_full_name;
      }

      // 第三步：检查是否有医生信息
      let doctorInfoResult = [];
      if (doctor_ids && doctor_ids.length > 0) {
        for (const doctor of doctor_ids) {
          const doctor_id = doctor.id;

          // 查找医生信息
          const doctorQuery = `
            SELECT 
              id AS doctor_id,
              CONCAT(Fname, ' ', COALESCE(Mname, ''), ' ', Lname) AS name
            FROM 
              doctors_registration
            WHERE 
              id = :doctor_id;
          `;
          const doctorInfo = await db.sequelize.query(doctorQuery, {
            replacements: { doctor_id },
            type: QueryTypes.SELECT,
          });

          if (doctorInfo.length) {
            doctorInfoResult.push({
              doctor_id: doctorInfo[0].doctor_id,
              name: doctorInfo[0].name,
            });
          }
        }
      }

      result.push({
        trial_id: patient.trial_id,
        patient_id: patient.patient_id,
        patient_full_name: patient_full_name,
        enrollment_date: patient.enrollment_date,
        enrollment_status: 'Enrolled', // 固定为 'Enrolled'
        doctor_info: doctorInfoResult,
      });
    }

    res.json({ status: 'OK', result });
  } catch (error) {
    console.error('Error fetching specific clinical trials patients information:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// 获取特定临床试验邀请患者的信息
exports.getSpecificClinicalTrialsInvitingPatients = async (req, res) => {
  const { trial_id } = req.body;

  if (!trial_id) {
    return res.status(400).json({ error: "Can not found the specific clinical trials information!" });
  }

  try {
    // 查询未完成的邀请动作
    const sqlActionsQuery = `
      SELECT ActionID, DATE(Timestamp) AS enrollment_date 
      FROM clinicaltrials_actions 
      WHERE TrialID = :trial_id AND ActionType = 1 AND IsCompleted = 0
    `;
    const actions = await db.sequelize.query(sqlActionsQuery, {
      replacements: { trial_id },
      type: QueryTypes.SELECT,
    });

    if (actions.length === 0) {
      return res.status(404).json({ message: 'No inviting actions found for this trial.' });
    }

    const result = [];

    for (const action of actions) {
      // 查询收到邀请的患者ID
      const sqlRequestsQuery = `
        SELECT ReceivedUserID 
        FROM clinicaltrials_actionrequests 
        WHERE ActionID = :action_id AND ReceivedUserType = 3
      `;
      const requests = await db.sequelize.query(sqlRequestsQuery, {
        replacements: { action_id: action.ActionID },
        type: QueryTypes.SELECT,
      });

      for (const request of requests) {
        // 查询患者信息
        const sqlPatientQuery = `
          SELECT CONCAT(FName, ' ', COALESCE(MName, ''), ' ', LName) AS patient_full_name 
          FROM patients_registration 
          WHERE id = :patient_id
        `;
        const patients = await db.sequelize.query(sqlPatientQuery, {
          replacements: { patient_id: request.ReceivedUserID },
          type: QueryTypes.SELECT,
        });

        if (patients.length === 0) continue;

        // 查询响应医生信息
        const sqlResponsesQuery = `
          SELECT ResponseUserID 
          FROM clinicaltrials_actionresponses 
          WHERE ActionID = :action_id AND ResponseStatus = 0 AND ResponseUserType = 2
        `;
        const responses = await db.sequelize.query(sqlResponsesQuery, {
          replacements: { action_id: action.ActionID },
          type: QueryTypes.SELECT,
        });

        const doctor_info = [];

        for (const response of responses) {
          const sqlDoctorQuery = `
            SELECT CONCAT(Fname, ' ', COALESCE(Mname, ''), ' ', Lname) AS name, id AS doctor_id 
            FROM doctors_registration 
            WHERE id = :doctor_id
          `;
          const doctors = await db.sequelize.query(sqlDoctorQuery, {
            replacements: { doctor_id: response.ResponseUserID },
            type: QueryTypes.SELECT,
          });

          if (doctors.length > 0) {
            doctor_info.push(doctors[0]);
          }
        }

        if (doctor_info.length > 0) {
          result.push({
            trial_id: trial_id,
            patient_id: request.ReceivedUserID,
            patient_full_name: patients[0].patient_full_name,
            enrollment_date: action.enrollment_date,  // 使用action中的日期部分
            enrollment_status: 'Inviting',  // 状态设置为inviting
            doctor_info: doctor_info
          });
        }
      }
    }

    res.json({ status: 'OK', result: result });
  } catch (error) {
    console.error('Error fetching specific clinical trials inviting patients information:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 获取特定临床试验申请患者的信息
exports.getSpecificClinicalTrialsApplyingPatients = async (req, res) => {
  const { trial_id } = req.body;

  if (!trial_id) {
    return res.status(400).json({ error: "Can not found the specific clinical trials information!" });
  }

  try {
    // 查询未完成的申请动作
    const sqlActionsQuery = `
      SELECT ActionID, DATE(Timestamp) AS application_date, InitiatorID 
      FROM clinicaltrials_actions 
      WHERE TrialID = :trial_id AND ActionType = 2 AND IsCompleted = 0
    `;
    const actions = await db.sequelize.query(sqlActionsQuery, {
      replacements: { trial_id },
      type: QueryTypes.SELECT,
    });

    if (actions.length === 0) {
      return res.status(404).json({ message: 'No applying actions found for this trial.' });
    }

    const result = [];

    for (const action of actions) {
      console.log(`Processing action ID: ${action.ActionID}`);

      // 查询患者信息
      const sqlPatientQuery = `
        SELECT CONCAT(FName, ' ', COALESCE(MName, ''), ' ', LName) AS patient_full_name 
        FROM patients_registration 
        WHERE id = :patient_id
      `;
      const patients = await db.sequelize.query(sqlPatientQuery, {
        replacements: { patient_id: action.InitiatorID },
        type: QueryTypes.SELECT,
      });

      if (patients.length === 0) continue;

      // 查询响应医生信息
      const sqlResponsesQuery = `
        SELECT ResponseUserID 
        FROM clinicaltrials_actionresponses 
        WHERE ActionID = :action_id AND ResponseStatus = 0 AND ResponseUserType = 2
      `;
      const responses = await db.sequelize.query(sqlResponsesQuery, {
        replacements: { action_id: action.ActionID },
        type: QueryTypes.SELECT,
      });

      const doctor_info = [];

      for (const response of responses) {
        console.log(`Processing response from doctor ID: ${response.ResponseUserID}`);

        const sqlDoctorQuery = `
          SELECT CONCAT(Fname, ' ', COALESCE(Mname, ''), ' ', Lname) AS name, id AS doctor_id 
          FROM doctors_registration 
          WHERE id = :doctor_id
        `;
        const doctors = await db.sequelize.query(sqlDoctorQuery, {
          replacements: { doctor_id: response.ResponseUserID },
          type: QueryTypes.SELECT,
        });

        if (doctors.length > 0) {
          doctor_info.push(doctors[0]);
        }
      }

      if (doctor_info.length > 0) {
        result.push({
          trial_id: trial_id,
          patient_id: action.InitiatorID,
          patient_full_name: patients[0].patient_full_name,
          enrollment_date: action.application_date,  // 使用action中的日期部分
          enrollment_status: 'Applying',  // 状态设置为Applying
          doctor_info: doctor_info
        });
      }
    }

    res.json({ status: 'OK', result: result });
  } catch (error) {
    console.error('Error fetching specific clinical trials applying patients information:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 内部使用为获取所有临床试验匹配患者的信息而获取单个临床试验匹配患者信息的函数
const getSingleClinicalTrialsMatchedPatients = async (trial_id, criteria) => {
  // Helper functions for matching logic

  // 处理空值
  const fillMissingValues = (data) => {
    if (typeof data === 'object' && data !== null) {
      for (let key in data) {
        if (data[key] === null || data[key] === undefined) {
          data[key] = '';
        } else if (typeof data[key] === 'object') {
          fillMissingValues(data[key]);
        }
      }
    } else if (Array.isArray(data)) {
      data.forEach(item => fillMissingValues(item));
    }
    return data;
  };

  const isAgeInRange = (age, ageRange) => {
    if (!ageRange) return false;
    const [minAge, maxAge] = ageRange.split('-').map(Number);
    return minAge <= age && age <= maxAge;
  };

  const calculateBMI = (weight, height) => {
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters ** 2);
    return bmi;
  };

  const isGenderMatch = (trialGender, patientGender) => {
    return trialGender === 'Both' || trialGender === patientGender;
  };

  const normalizeText = (value) => String(value || '').trim().toLowerCase();
  const splitList = (value) => String(value || '').split(',').map(normalizeText).filter(Boolean);

  const isPathologyMatch = (trialPathology, patientPathologies) => {
    if (!patientPathologies) return false;
    const trialPathologies = splitList(trialPathology);
    const patientPathologySet = new Set(splitList(patientPathologies));
    return trialPathologies.some(pathology => patientPathologySet.has(pathology));
  };

  const getClassification = (pathology, pathologyToClassification) => {
    const normalized = normalizeText(pathology);
    return pathologyToClassification[normalized] || normalized;
  };

  const meetsInclusionCriteria = (trial, patient, patientPathology) => {
    return (!criteria.pathology || isPathologyMatch(trial.pathology, patientPathology.pathology)) &&
      (!criteria.gender || isGenderMatch(trial.gender, patient.Gender)) &&
      (!criteria.age || isAgeInRange(patient.Age, trial.age_range));
  };

  const meetsExclusionCriteria = (trial, patient, patientPathology, pathologyToClassification) => {
    let exclusionCriteria;
    try {
      exclusionCriteria = typeof trial.exclusion_criteria === 'string' ? JSON.parse(trial.exclusion_criteria) : trial.exclusion_criteria;
    } catch (error) {
      return false;
    }

    const exclusionDiseases = splitList(exclusionCriteria.Diseases);
    const exclusionPriorMedications = splitList(exclusionCriteria['Prior Medications'] || exclusionCriteria.PriorMedications);
    const exclusionSurgeries = splitList(exclusionCriteria.Surgeries);

    const patientClassifications = new Set(splitList(patientPathology.pathology).map(disease => getClassification(disease, pathologyToClassification)));
    const diseasesMatch = criteria.diseases && exclusionDiseases.some(disease => patientClassifications.has(disease));

    const patientBMI = calculateBMI(patient.weight || 0, patient.height || 0);
    const bmiCriteria = exclusionCriteria.BMI || '';

    let bmiMatch = false;
    if (criteria.bmi) {
      if (bmiCriteria.includes('>') && bmiCriteria.includes('<')) {
        const [lowerBound, upperBound] = bmiCriteria.replace('<', '').replace('>', '').split('or').map(Number);
        bmiMatch = patientBMI > upperBound || patientBMI < lowerBound;
      } else if (bmiCriteria.includes('>')) {
        bmiMatch = patientBMI > parseFloat(bmiCriteria.replace('>', ''));
      } else if (bmiCriteria.includes('<')) {
        bmiMatch = patientBMI < parseFloat(bmiCriteria.replace('<', ''));
      }
    }

    const priorMedicationsMatch = criteria.priorMedications && exclusionPriorMedications.some(medication => normalizeText(patientPathology.prior_medication).includes(medication));
    const surgeriesMatch = criteria.surgeries && exclusionSurgeries.some(surgery => normalizeText(patientPathology.surgeries).includes(surgery));
    const pregnancyMatch = criteria.pregnancy && exclusionCriteria.Pregnancy === 'Yes' && (patientPathology.pregnancies || 0) > 0;

    return diseasesMatch || priorMedicationsMatch || surgeriesMatch || pregnancyMatch || bmiMatch;
  };

  try {
    const trialQuery = `
      SELECT * FROM clinical_trials WHERE trial_id = :trial_id
    `;
    let trials = await db.sequelize.query(trialQuery, {
      replacements: { trial_id },
      type: QueryTypes.SELECT,
    });

    trials = fillMissingValues(trials);
    const trial = trials[0];

    if (!trial) {
      throw new Error('Trial not found');
    }

    const patientsQuery = `
      SELECT * FROM patients_registration
    `;
    let patients = await db.sequelize.query(patientsQuery, {
      type: QueryTypes.SELECT,
    });

    patients = fillMissingValues(patients);

    const pathologyQuery = `
      SELECT * FROM patients_pathology
    `;
    let patientPathologies = await db.sequelize.query(pathologyQuery, {
      type: QueryTypes.SELECT,
    });

    patientPathologies = fillMissingValues(patientPathologies);

    const pathologyClassificationsQuery = `
      SELECT * FROM pathology_classifications
    `;
    let pathologyClassifications = await db.sequelize.query(pathologyClassificationsQuery, {
      type: QueryTypes.SELECT,
    });

    pathologyClassifications = fillMissingValues(pathologyClassifications);

    const pathologyToClassification = pathologyClassifications.reduce((acc, row) => {
      if (row.Pathology && row.Classification) {
        acc[row.Pathology.toLowerCase()] = row.Classification.toLowerCase();
      }
      return acc;
    }, {});

    const matches = [];
    for (const patient of patients) {
      const patientPathology = patientPathologies.find(pp => pp.patient_id === patient.id) || {};
      try {
        if (meetsInclusionCriteria(trial, patient, patientPathology) && !meetsExclusionCriteria(trial, patient, patientPathology, pathologyToClassification)) {
          const patientFullName = `${patient.FName} ${patient.MName ? patient.MName + ' ' : ''}${patient.LName}`.trim();
          matches.push({
            patient_id: patient.id,
            patient_fullname: patientFullName,
            trial_id: trial.trial_id,
            detailed_description: trial.detailed_description,
          });
        }
      } catch (error) {
        console.error(`Error evaluating patient with ID: ${patient.id}`, error);
      }
    }

    return matches;
  } catch (error) {
    console.error("Error fetching specific clinical trials information.", error);
    throw error;
  }
};

//内部使用的为病人查询对应医生信息的函数
const getPatientRelatedDoctorsInternal = async(patientId) => {

  const selectDoctorIdsQuery = `
    SELECT doctor_id FROM patient_doctor WHERE patient_id = ?
  `;

  try {
    // 获取医生ID列表
    const doctorIdResults = await db.sequelize.query(selectDoctorIdsQuery, {
      replacements: [patientId],
      type: QueryTypes.SELECT
    });

    const doctorIds = doctorIdResults.map(row => row.doctor_id);

    if (doctorIds.length === 0) {
      return([]);
    }

    // 从 doctors_registration 表中获取医生信息
    const selectDoctorsQuery = `
      SELECT 
        id,
        Fname,
        Mname,
        Lname,
        MobileNumber,
        City,
        Province,
        Country,
        Specialization,
        PractincingHospital,
        Gender,
        Availability
      FROM doctors_registration
      WHERE id IN (:doctorIds)
    `;

    const doctorInfoResults = await db.sequelize.query(selectDoctorsQuery, {
      replacements: { doctorIds },
      type: QueryTypes.SELECT
    });

    // 返回医生信息列表
    return(doctorInfoResults);
  } catch (error) {
    return([]);
  }
};


// 内部使用为特定临床试验匹配患者的信息的函数
const getSpecificClinicalTrialsMatchedPatientsInternal = async (criteria, criteriaValues) => {
  // Helper functions for matching logic

  // 处理空值
  const fillMissingValues = (data) => {
    if (typeof data === 'object' && data !== null) {
      for (let key in data) {
        if (data[key] === null || data[key] === undefined) {
          data[key] = '';
        } else if (typeof data[key] === 'object') {
          fillMissingValues(data[key]);
        }
      }
    } else if (Array.isArray(data)) {
      data.forEach(item => fillMissingValues(item));
    }
    return data;
  };

  const isAgeInRange = (age, ageRange) => {
    if (!ageRange) return false;
    const [minAge, maxAge] = ageRange.split('-').map(Number);
    return minAge <= age && age <= maxAge;
  };

  const calculateBMI = (weight, height) => {
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters ** 2);
    return bmi;
  };

  const isGenderMatch = (trialGender, patientGender) => {
    return trialGender === 'Both' || trialGender === patientGender;
  };

  const normalizeText = (value) => String(value || '').trim().toLowerCase();
  const splitList = (value) => String(value || '').split(',').map(normalizeText).filter(Boolean);

  const isPathologyMatch = (trialPathology, patientPathologies) => {
    if (!patientPathologies) return false;
    const trialPathologies = splitList(trialPathology);
    const patientPathologySet = new Set(splitList(patientPathologies));
    return trialPathologies.some(pathology => patientPathologySet.has(pathology));
  };

  const getClassification = (pathology, pathologyToClassification) => {
    const normalized = normalizeText(pathology);
    return pathologyToClassification[normalized] || normalized;
  };

  const meetsInclusionCriteria = (patient, patientPathology) => {
    return (!criteria.pathology || isPathologyMatch(criteriaValues.pathology, patientPathology.pathology)) &&
      (!criteria.gender || isGenderMatch(criteriaValues.gender, patient.Gender)) &&
      (!criteria.age || isAgeInRange(patient.Age, criteriaValues.ageRange));
  };

  const meetsExclusionCriteria = (patient, patientPathology, pathologyToClassification) => {
    const exclusionDiseases = splitList(criteriaValues.diseases);
    const exclusionPriorMedications = splitList(criteriaValues.priorMedications);
    const exclusionSurgeries = splitList(criteriaValues.surgeries);
    
    const patientClassifications = new Set(splitList(patientPathology.pathology).map(disease => getClassification(disease, pathologyToClassification)));
    const diseasesMatch = criteria.diseases && exclusionDiseases.some(disease => patientClassifications.has(disease));

    const patientBMI = calculateBMI(patient.weight || 0, patient.height || 0);
    const bmiCriteria = criteriaValues.bmiRange || '';

    let bmiMatch = false;
    if (criteria.bmi) {
      if (bmiCriteria.includes('>') && bmiCriteria.includes('<')) {
        const [lowerBound, upperBound] = bmiCriteria.replace('<', '').replace('>', '').split('or').map(Number);
        bmiMatch = patientBMI > upperBound || patientBMI < lowerBound;
      } else if (bmiCriteria.includes('>')) {
        bmiMatch = patientBMI > parseFloat(bmiCriteria.replace('>', ''));
      } else if (bmiCriteria.includes('<')) {
        bmiMatch = patientBMI < parseFloat(bmiCriteria.replace('<', ''));
      }
    }

    const priorMedicationsMatch = criteria.priorMedications && exclusionPriorMedications.some(medication => normalizeText(patientPathology.prior_medication).includes(medication));
    const surgeriesMatch = criteria.surgeries && exclusionSurgeries.some(surgery => normalizeText(patientPathology.surgeries).includes(surgery));
    const pregnancyMatch = criteria.pregnancy && criteriaValues.pregnancy === 'Yes' && (patientPathology.pregnancies || 0) > 0;

    return diseasesMatch || priorMedicationsMatch || surgeriesMatch || pregnancyMatch || bmiMatch;
  };

  try {
    const patientsQuery = `
      SELECT * FROM patients_registration
    `;
    let patients = await db.sequelize.query(patientsQuery, {
      type: QueryTypes.SELECT,
    });

    patients = fillMissingValues(patients);

    const pathologyQuery = `
      SELECT * FROM patients_pathology
    `;
    let patientPathologies = await db.sequelize.query(pathologyQuery, {
      type: QueryTypes.SELECT,
    });

    patientPathologies = fillMissingValues(patientPathologies);

    const pathologyClassificationsQuery = `
      SELECT * FROM pathology_classifications
    `;
    let pathologyClassifications = await db.sequelize.query(pathologyClassificationsQuery, {
      type: QueryTypes.SELECT,
    });

    pathologyClassifications = fillMissingValues(pathologyClassifications);

    const pathologyToClassification = pathologyClassifications.reduce((acc, row) => {
      if (row.Pathology && row.Classification) {
        acc[row.Pathology.toLowerCase()] = row.Classification.toLowerCase();
      }
      return acc;
    }, {});

    const matches = [];
    for (const patient of patients) {
      const patientPathology = patientPathologies.find(pp => pp.patient_id === patient.id) || {};
      try {
        if (meetsInclusionCriteria(patient, patientPathology) && !meetsExclusionCriteria(patient, patientPathology, pathologyToClassification)) {
          const patientFullName = `${patient.FName} ${patient.MName ? patient.MName + ' ' : ''}${patient.LName}`.trim();
          const patientBMI = calculateBMI(patient.weight || 0, patient.height || 0);
          const related_doctors = await getPatientRelatedDoctorsInternal(patient.id);
          const description = `
            Inclusion Criteria:
            Pathology: ${criteria.pathology ? criteriaValues.pathology : 'N/A'}
            Gender: ${criteria.gender ? criteriaValues.gender : 'N/A'}
            Age Range: ${criteria.age ? criteriaValues.ageRange : 'N/A'}
            
            Exclusion Criteria:
            Allowed BMI Range: ${criteria.bmi ? criteriaValues.bmiRange : 'N/A'}
            Diseases: ${criteria.diseases ? criteriaValues.diseases : 'N/A'}
            Medication Exclusions: ${criteria.priorMedications ? criteriaValues.priorMedications : 'N/A'}
            Surgeries: ${criteria.surgeries ? criteriaValues.surgeries : 'N/A'}
            Pregnancy: ${criteria.pregnancy ? criteriaValues.pregnancy : 'N/A'}
            
            Patient Data:
            Age: ${patient.Age}
            Gender: ${patient.Gender}
            BMI: ${patientBMI}
            Pathology: ${patientPathology.pathology || 'N/A'}
            Current Medications: ${patientPathology.prior_medication || 'N/A'}
            Surgeries: ${patientPathology.surgeries || 'N/A'}
            Pregnancies: ${patientPathology.pregnancies || 'N/A'}
          `;
          matches.push({
            patient_id: patient.id,
            patient_fullname: patientFullName,
            detailed_description: description.trim(),
            related_doctors:related_doctors
          });
        }
      } catch (error) {
        console.error(`Error evaluating patient with ID: ${patient.id}`, error);
      }
    }

    return matches;
  } catch (error) {
    console.error("Error fetching specific clinical trials information.", error);
    throw error;
  }
};



exports.getSpecificClinicalTrialsMatchedPatients = async (req, res) => {
  const { criteria, criteriaValues } = req.body;

  try {
    const matches = await getSpecificClinicalTrialsMatchedPatientsInternal(criteria, criteriaValues);
    res.json({ status: 'OK', result: matches });
  } catch (error) {
    res.status(500).json({ status: 'Error', message: error.message });
  }
};


/// 获取所有临床试验匹配患者的信息
exports.getClinicalTrialsMatchedPatients = async (req, res) => {
  const criteria ={
    pathology: true,
    gender: true,
    age: true,
    diseases: true,
    bmi: true,
    priorMedications: true,
    surgeries: true,
    pregnancy: true,
  }; // 默认筛选条件
  //处理空值

  const fillMissingValues = (data) => {
    if (typeof data === 'object' && data !== null) {
      for (let key in data) {
        if (data[key] === null || data[key] === undefined) {
          data[key] = '';
        } else if (typeof data[key] === 'object') {
          fillMissingValues(data[key]);
        }
      }
    } else if (Array.isArray(data)) {
      data.forEach(item => fillMissingValues(item));
    }
    return data;
  };

  try {
    const trialsQuery = `
      SELECT trial_id
      FROM clinical_trials
    `;
    let trialsResult = await db.sequelize.query(trialsQuery, {
      type: QueryTypes.SELECT,
    });
    const trialsInfo = fillMissingValues(trialsResult);

    let allMatches = [];

    for (const trial of trialsInfo) {
      try {
        const matches = await getSingleClinicalTrialsMatchedPatients(trial.trial_id,criteria);
        allMatches.push({
          trial_id: trial.trial_id,
          matches: matches,
        });
      } catch (error) {
        console.error(`Error processing trial_id: ${trial.trial_id}`, error);
      }
    }
    console.log(allMatches);
    res.json({ status: 'OK', result: allMatches });
  } catch (error) {
    res.status(500).json({ status: 'Error', message: error.message });
  }
};


//获取医药公司的消息列表
exports.getPharmaceuticals_Notifications = async (req, res) => {
  const { companyId } = req.body; // 从请求体中获取 companyId
  if (!companyId) {
    return res.status(400).json({ error: "Can not found the notifications information of the company!" });
  }
  try {
    //查询基础消息信息
    const notifications = await db.sequelize.query(
      'SELECT * FROM pharmaceuticals_notifications WHERE companyId = :companyId',
      {
        replacements: { companyId },
        type: QueryTypes.SELECT,
      }
    ); 
    //根据基础信息查询消息来源详情
    await Promise.all(notifications.map(async (notification) =>{

      //区分用户类别来决定sql命令，以获取来源资料
      let sqlQuery ='';
      switch (notification.sourceCategory) {
        case 0://管理员
          sqlQuery = 'SELECT Fname, Mname, Lname FROM clinical_staff_registration WHERE id = :sourceId';
          break;
        case 1://医生
          sqlQuery = 'SELECT Fname, Mname, Lname FROM doctors_registration WHERE id = :sourceId';
          break;
        case 2://病人
          sqlQuery = 'SELECT Fname, Mname, Lname FROM patients_registration WHERE id = :sourceId';
          break;  
        default:
          break;
      }
      const profileInfo = await db.sequelize.query(sqlQuery,
        {
          replacements: { sourceId: notification.sourceId },
          type: QueryTypes.SELECT,
        }
      );
      if (profileInfo.length > 0) {
        notification.sourceProfile = `${profileInfo[0].Fname} ${profileInfo[0].Mname} ${profileInfo[0].Lname}`.trim();
      }

      //获取该临床试验名字
      const trial = await db.sequelize.query(
        'SELECT trial_name FROM clinical_trials WHERE trial_id = :trialId',
        {
          replacements: { trialId: notification.trialId },
          type: QueryTypes.SELECT,
        }
      );
      notification.trialInfo = trial[0].trial_name;
    }));
    res.json({ status: 'OK', result: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

//更改消息的状态
exports.updatePharmaceuticalsNotificationStatus = async (req, res) => {
  const { messageId } = req.body;

  if (!messageId) {
    return res.status(400).json({ error: "Can not found the notifications information!" });
  }

  try {
    await db.sequelize.query(
      'UPDATE pharmaceuticals_notifications SET messageStatus = 1 WHERE id = :messageId',
      {
        replacements: { messageId },
        type: QueryTypes.UPDATE,
      }
    );
    res.json({ status: 'OK', result: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
  
};
//获取药店行动状态
exports.getPharmaceuticals_ActionsStatus = async (req, res) => {
  const { companyId } = req.body; // 从请求体中获取 companyId
  if (!companyId) {
    return res.status(400).json({ error: "Company ID is required!" });
  }

  try {
    // 查询 ActionType 为 0 且 InitiatorType 为 1 的动作，计算 IsCompleted 为 true 和 false 的数量
    const AuditActions = await db.sequelize.query(
      `SELECT IsCompleted, COUNT(*) as count 
       FROM clinicaltrials_actions 
       WHERE ActionType = 0 AND InitiatorType = 1 AND InitiatorID = :companyId 
       GROUP BY IsCompleted`,
      {
        replacements: { companyId },
        type: QueryTypes.SELECT,
      }
    );

    // 查询 ActionType 为 1 且 InitiatorType 为 1 的动作，计算 IsCompleted 为 true 和 false 的数量
    const InviteActions = await db.sequelize.query(
      `SELECT IsCompleted, COUNT(*) as count 
       FROM clinicaltrials_actions 
       WHERE ActionType = 1 AND InitiatorType = 1 AND InitiatorID = :companyId 
       GROUP BY IsCompleted`,
      {
        replacements: { companyId },
        type: QueryTypes.SELECT,
      }
    );

    // 查询 ActionType 为 2 且 InitiatorType 为 3 的所有 ActionID
    const ApplyActionsList = await db.sequelize.query(
      `SELECT ActionID 
       FROM clinicaltrials_actions 
       WHERE ActionType = 2 AND InitiatorType = 3`,
      {
        type: QueryTypes.SELECT,
      }
    );
    const actionIds = ApplyActionsList.map(action => action.ActionID);

    // 获取所有符合条件的 ActionID
    const filteredActionIDs = await db.sequelize.query(
      `SELECT ActionID 
       FROM clinicaltrials_actionrequests 
       WHERE ActionID IN (:actionIds) AND ReceivedUserType = 1 AND ReceivedUserID = :companyId`,
      {
        replacements: { actionIds, companyId },
        type: QueryTypes.SELECT,
      }
    );
 
    const validActionIDs = filteredActionIDs.map(action => action.ActionID);

    // 查询 validActionIDs 中的 IsCompleted 为 true 和 false 的数量
    const ApplyActions = await db.sequelize.query(
      `SELECT IsCompleted, COUNT(*) as count 
       FROM clinicaltrials_actions 
       WHERE ActionID IN (${validActionIDs.join(',')}) 
       GROUP BY IsCompleted`,
      {
        type: QueryTypes.SELECT,
      }
    );

    res.json({
      status: 'OK',
      result: {
        AuditActions,
        InviteActions,
        ApplyActions
      }
    });
  } catch (error) {
    console.error('Error fetching actions status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 获取医药公司 Dashboard Summary
exports.getPharmaceuticals_DashboardSummary = async (req, res) => {
  const { companyId } = req.body;

  // 判断日期是否在近7天内的函数
  const isWithinLast7Days = (date) => {
    const targetDate = new Date(date);
    const currentDate = new Date();
    const diffTime = Math.abs(currentDate - targetDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  try {
    // ① 从 clinical_trials 中查找所有试验，查看是否有近7天的
    const trials = await db.sequelize.query(
      `SELECT trial_id, start_date
       FROM clinical_trials
       WHERE company_id = ?`,
      {
        replacements: [companyId],
        type: QueryTypes.SELECT,
      }
    );

    const totalTrials = trials.length;
    const recentTrials = trials.filter(trial => isWithinLast7Days(trial.start_date)).length;
    const recentTrialsRatio = (totalTrials > 0) ? (recentTrials / totalTrials) * 100 : 0;

    // ② 从 clinicaltrials_patients 中查找对应的病人和医生
    const patients = await db.sequelize.query(
      `SELECT trial_id, patient_id, company_id, enrollment_date, doctor_ids
       FROM clinicaltrials_patients
       WHERE company_id = ?`,
      {
        replacements: [companyId],
        type: QueryTypes.SELECT,
      }
    );

    const totalPatients = patients.length;
    const doctorEntries = [];

    patients.forEach(patient => {
      try {
        const doctorIds = patient.doctor_ids;
        if (Array.isArray(doctorIds)) {
          doctorIds.forEach(doctor => {
            doctorEntries.push({ doctorId: doctor.id, responseTime: new Date(doctor.response_time) });
          });
        }
      } catch (e) {
        // 忽略错误
      }
    });

    // 获取每个医生的最新记录
    const latestDoctors = {};
    doctorEntries.forEach(entry => {
      if (!latestDoctors[entry.doctorId] || latestDoctors[entry.doctorId] < entry.responseTime) {
        latestDoctors[entry.doctorId] = entry.responseTime;
      }
    });

    const totalDoctors = Object.keys(latestDoctors).length;
    const recentDoctors = Object.values(latestDoctors).filter(date => isWithinLast7Days(date)).length;
    const recentDoctorsRatio = (totalDoctors > 0) ? (recentDoctors / totalDoctors) * 100 : 0;

    const recentPatients = patients.filter(patient => isWithinLast7Days(patient.enrollment_date)).length;
    const recentPatientsRatio = (totalPatients > 0) ? (recentPatients / totalPatients) * 100 : 0;

    // 准备返回数据
    const data = [
      {
        title: "Clinical Trials",
        percent: recentTrialsRatio.toFixed(1),
        total: totalTrials
      },
      {
        title: "Patients",
        percent: recentPatientsRatio.toFixed(1),
        total: totalPatients
      },
      {
        title: "Doctors",
        percent: recentDoctorsRatio.toFixed(1),
        total: totalDoctors
      }
    ];

    res.json({ status: 'OK', result: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 获取医药公司病人来源
exports.getPharmaceuticals_PatientSource = async (req, res) => {
  const { companyId } = req.body;

  try {
    // 查询clinicaltrials_patients中一共有多少条记录
    const sqlQueryTotalPatients = 'SELECT COUNT(*) as total FROM clinicaltrials_patients WHERE company_id = :companyId';
    const totalPatientsResult = await db.sequelize.query(sqlQueryTotalPatients, {
      replacements: { companyId },
      type: QueryTypes.SELECT
    });
    const totalPatients = totalPatientsResult[0].total;

    // 查询clinicaltrials_actions中InitiatorType为1、IsCompleted为1且ActionType为1的记录数（即邀请数）
    const sqlQueryInvited = `
      SELECT COUNT(*) as invited 
      FROM clinicaltrials_actions 
      WHERE InitiatorType = 1 AND IsCompleted = 1 AND ActionType = 1
    `;
    const invitedResult = await db.sequelize.query(sqlQueryInvited, {
      type: QueryTypes.SELECT
    });
    const invited = invitedResult[0].invited;

    // 计算申请数（总记录数 - 邀请数）
    const apply = totalPatients - invited;

    // 返回结果
    res.json({ status: 'OK', result: { invited, apply } });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


//药店浏览病人信息
exports.PharmaceuticalsViewPatientProfile = async (req, res) => {
  try {
    const { patientId, viewMode } = req.body;

    // 查询数据库中的病人基础数据
    const sqlQuery_basicInfo = 'SELECT * FROM patients_registration WHERE id = :patientId';
    const profileInfo = await db.sequelize.query(sqlQuery_basicInfo, {
      replacements: { patientId },
      type: QueryTypes.SELECT,
    });
    const patient = profileInfo[0];

    const basicInfo = {
      id: patient.id,
      Name: `${patient.FName} ${patient.MName ? patient.MName + ' ' : ''}${patient.LName}`,
      EmailId: patient.EmailId,
      MobileNumber: patient.MobileNumber,
      Age: patient.Age,
      Gender: patient.Gender,
      height: patient.height,
      weight: patient.weight,
      bloodtype: patient.BloodGroup,
      Address: patient.Address,
      City: patient.City,
      Province: patient.Province,
      Country: patient.Country,
      PostalCode: patient.PostalCode,
      dateOfBirth: patient.date_of_birth,
    };

    // 查询医生病人对应关系
    const sqlQuery_patientDoctor = `SELECT pd.patient_id, pd.doctor_id, pd.association_type, 
    CONCAT_WS(' ', d.Fname, d.Mname, d.Lname) AS doctor_full_name
    FROM patient_doctor pd 
    JOIN doctors_registration d ON pd.doctor_id = d.id 
    WHERE pd.patient_id = :patientId;`;
    const patientDoctorInfo = await db.sequelize.query(sqlQuery_patientDoctor, {
      replacements: { patientId },
      type: QueryTypes.SELECT,
    });

    // 查询医学历史
    const sqlQuery_medicalHistory = `SELECT * FROM patients_pathology WHERE patient_id = :patientId`;
    const medicalHistoryResult = await db.sequelize.query(sqlQuery_medicalHistory, {
      replacements: { patientId },
      type: QueryTypes.SELECT,
    });
    const medicalHistoryData = medicalHistoryResult[0] || {};

    const sqlQuery_pathologyClassifications = `
      SELECT Classification
      FROM pathology_classifications
      WHERE LOWER(Pathology) IN (:pathologies)
    `;
    const patientPathologies = String(medicalHistoryData.pathology || "")
      .split(",")
      .map((pathology) => pathology.trim().toLowerCase())
      .filter(Boolean);
    const classificationRows = patientPathologies.length
      ? await db.sequelize.query(sqlQuery_pathologyClassifications, {
          replacements: { pathologies: patientPathologies },
          type: QueryTypes.SELECT,
        })
      : [];
    const diagnosisClassifications = Array.from(
      new Set(
        classificationRows
          .map((row) => row.Classification)
          .filter(Boolean)
      )
    ).join(", ");

    const medicalHistoryInfo = {
      diagnosis: medicalHistoryData.pathology,
      diagnosisClassifications,
      medications: medicalHistoryData.prior_medication,
      surgeries: medicalHistoryData.surgeries,
      pregnancies: medicalHistoryData.pregnancies,
      medicalHistory: medicalHistoryData.medical_history,
      otherNotes: medicalHistoryData.other_notes,
    };

    const patientProfile = {
      basicInfo,
      patientDoctorInfo,
      medicalHistoryInfo,
    };

    return res.json({ status: 'OK', result: patientProfile });

  } catch (error) {
    console.error('Error fetching patient data:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.checkExistingActions = async (req, res) => {
  const { trialId, receivedUserId, actionType, isCompleted } = req.body;

  if (!trialId || !receivedUserId || actionType === undefined || isCompleted === undefined) {
    return res.status(400).json({ error: "Invalid request payload" });
  }

  const checkPatientQuery = `
    SELECT * FROM clinicaltrials_patients
    WHERE trial_id = ? AND patient_id = ?
  `;

  const checkActionQuery = `
    SELECT * FROM clinicaltrials_actions AS a
    JOIN clinicaltrials_actionrequests AS r ON a.ActionID = r.ActionID
    WHERE a.TrialID = ? AND r.ReceivedUserID = ? AND a.ActionType = ? AND a.IsCompleted = ?
  `;

  try {
    // First check if the patient exists in the clinicaltrials_patients table
    const patientResults = await db.sequelize.query(checkPatientQuery, {
      replacements: [trialId, receivedUserId],
      type: QueryTypes.SELECT
    });

    if (patientResults.length > 0) {
      // Patient exists in clinicaltrials_patients table
      return res.json({ exists: true });
    }

    // If patient does not exist in clinicaltrials_patients, check the clinicaltrials_actions
    const actionResults = await db.sequelize.query(checkActionQuery, {
      replacements: [trialId, receivedUserId, actionType, isCompleted],
      type: QueryTypes.SELECT
    });

    if (actionResults.length > 0) {
      res.json({ exists: true });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error('Error checking existing actions:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};


//行为创建
exports.PharmaceuticalsActionCreate = async (req, res) => {
  const { trialId, initiatorType, initiatorId } = req.body;

  if (!trialId || initiatorType === undefined || !initiatorId) {
      return res.status(400).json({ error: "Invalid request payload" });
  }

  const insertActionQuery = `
      INSERT INTO clinicaltrials_actions 
      (ActionType, TrialID, InitiatorType, InitiatorID, IsCompleted) 
      VALUES (1, ?, ?, ?, FALSE)
  `;

  try {
      const [result] = await db.sequelize.query(insertActionQuery, {
          replacements: [trialId, initiatorType, initiatorId],
          type: QueryTypes.INSERT
      });
      
      res.json({ status: 'OK', result });
  } catch (error) {
      console.error('Error creating action:', error);
      res.status(500).json({ success: false, error: 'Server error' });
  }
};

//请求创建
exports.PharmaceuticalsRequestCreate = async (req, res) => {
  const { actionId, receivedUserType, receivedUserId, inviteMessage, isPrimaryRequest } = req.body;

  if (!actionId || receivedUserType === undefined || !receivedUserId || inviteMessage === undefined || isPrimaryRequest === undefined) {
      return res.status(400).json({ error: "Invalid request payload" });
  }

  const insertRequestQuery = `
      INSERT INTO clinicaltrials_actionrequests 
      (ActionID, ReceivedUserType, ReceivedUserID, ReadStatus, Note, IsPrimaryRequest) 
      VALUES (?, ?, ?, FALSE, ?, ?)
  `;

  try {
      await db.sequelize.query(insertRequestQuery, {
          replacements: [actionId, receivedUserType, receivedUserId, inviteMessage, isPrimaryRequest],
          type: QueryTypes.INSERT
      });

      res.json({ status: 'OK', result: true });
  } catch (error) {
      console.error('Error creating request:', error);
      res.status(500).json({ success: false, error: 'Server error' });
  }
};

//根据clinical staff id查询对应行为详情
exports.getWebStaffActions = async (req, res) => {
  const { userId } = req.body; // 从请求体中获取 Web Staff 的 ID
  if (!userId) {
    return res.status(400).json({ error: "User ID is required!" });
  }

  // getUserFullName 函数在此函数内部
  const getUserFullName = async (userType, userId) => {
    let user;
    switch (userType) {
      case 0: // Web Staff
        user = await db.sequelize.query(
          `SELECT CONCAT(FName, ' ', MName, ' ', LName) AS fullName FROM clinical_staff_registration WHERE id = :userId`,
          { replacements: { userId }, type: db.sequelize.QueryTypes.SELECT }
        );
        break;
      case 1: // Company
        user = await db.sequelize.query(
          `SELECT name AS fullName FROM pharmaceutical_company WHERE id = :userId`,
          { replacements: { userId }, type: db.sequelize.QueryTypes.SELECT }
        );
        break;
      case 2: // Doctor
        user = await db.sequelize.query(
          `SELECT CONCAT(FName, ' ', MName, ' ', LName) AS fullName FROM doctors_registration WHERE id = :userId`,
          { replacements: { userId }, type: db.sequelize.QueryTypes.SELECT }
        );
        break;
      case 3: // Patient
        user = await db.sequelize.query(
          `SELECT CONCAT(FName, ' ', MName, ' ', LName) AS fullName FROM patients_registration WHERE id = :userId`,
          { replacements: { userId }, type: db.sequelize.QueryTypes.SELECT }
        );
        break;
      default:
        user = [{ fullName: "Unknown" }];
        break;
    }
    return user[0]?.fullName || "Unknown";
  };

  try {
    // 查询所有公司发起的审核行为（ActionType = 0）
    const auditActions = await db.sequelize.query(
      `SELECT * FROM clinicaltrials_actions 
       WHERE ActionType = 0`,  // ActionType = 0 表示公司发起的审核
      { type: db.sequelize.QueryTypes.SELECT }
    );

    // 查询哪些行为是当前 Web Staff 作为接收者（receiver）参与的
    const actionsForWebStaff = await db.sequelize.query(
      `SELECT DISTINCT ActionID FROM clinicaltrials_actionrequests
       WHERE ReceivedUserType = 0 AND ReceivedUserID = :userId`, // Web Staff 类型为 0
      { replacements: { userId }, type: db.sequelize.QueryTypes.SELECT }
    );

    const actionIds = actionsForWebStaff.map(action => action.ActionID);

    // 如果没有找到任何与 Web Staff 相关的请求
    if (actionIds.length === 0) {
      return res.json({ status: 'OK', result: { auditActions: [] } });
    }

    // 获取并构建这些行为的详细信息（包括 requests 和 responses）
    const getDetailedActions = async (actions) => {
      return Promise.all(
        actions.map(async (action) => {
          const requests = await db.sequelize.query(
            `SELECT * FROM clinicaltrials_actionrequests WHERE ActionID = :actionId`,
            { replacements: { actionId: action.ActionID }, type: db.sequelize.QueryTypes.SELECT }
          );

          const responses = await db.sequelize.query(
            `SELECT * FROM clinicaltrials_actionresponses WHERE ActionID = :actionId`,
            { replacements: { actionId: action.ActionID }, type: db.sequelize.QueryTypes.SELECT }
          );

          const trial = await db.sequelize.query(
            `SELECT trial_name FROM clinical_trials WHERE trial_id = :trialId`,
            { replacements: { trialId: action.TrialID }, type: db.sequelize.QueryTypes.SELECT }
          );

          return {
            action: {
              ActionID: action.ActionID,
              TrialID: action.TrialID,
              Timestamp: action.Timestamp,
              initiatorName: await getUserFullName(action.InitiatorType, action.InitiatorID),
            },
            trialName: trial[0]?.trial_name || null,
            requests: await Promise.all(requests.map(async (request) => ({
              ReceivedUserType: request.ReceivedUserType,
              ReceivedUserID: request.ReceivedUserID,
              ReadStatus: request.ReadStatus,
              Note: request.Note,
              Timestamp: request.Timestamp,
              fullName: await getUserFullName(request.ReceivedUserType, request.ReceivedUserID),
            }))),
            responses: await Promise.all(responses.map(async (response) => ({
              ResponseUserType: response.ResponseUserType,
              ResponseUserID: response.ResponseUserID,
              ReadStatus: response.ReadStatus,
              ResponseStatus: response.ResponseStatus,
              Note: response.Note,
              Timestamp: response.Timestamp,
              fullName: await getUserFullName(response.ResponseUserType, response.ResponseUserID),
            }))),
          };
        })
      );
    };

    const filteredActions = auditActions.filter(action => actionIds.includes(action.ActionID));

    // 获取详细的请求和响应
    const auditActionDetails = await getDetailedActions(filteredActions);

    res.json({ status: 'OK', result: { auditActions: auditActionDetails } });
  } catch (error) {
    console.error('Error fetching Web Staff actions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



//根据公司id查询对应行为详情
exports.getPharmaceuticals_DetailedActions = async (req, res) => {
  const { companyId } = req.body; // 从请求体中获取 companyId
  if (!companyId) {
    return res.status(400).json({ error: "Company ID is required!" });
  }

  try {
    const getUserFullName = async (userType, userId) => {
      let user;
      switch (userType) {
        case 0: // Web Staff
          user = await db.sequelize.query(
            `SELECT CONCAT(FName, ' ', MName, ' ', LName) AS fullName FROM clinical_staff_registration WHERE id = :userId`,
            { replacements: { userId }, type: db.sequelize.QueryTypes.SELECT }
          );
          break;
        case 1: // Company
          user = await db.sequelize.query(
            `SELECT name AS fullName FROM pharmaceutical_company WHERE id = :userId`,
            { replacements: { userId }, type: db.sequelize.QueryTypes.SELECT }
          );
          break;
        case 2: // Doctor
          user = await db.sequelize.query(
            `SELECT CONCAT(FName, ' ', MName, ' ', LName) AS fullName FROM doctors_registration WHERE id = :userId`,
            { replacements: { userId }, type: db.sequelize.QueryTypes.SELECT }
          );
          break;
        case 3: // Patient
          user = await db.sequelize.query(
            `SELECT CONCAT(FName, ' ', MName, ' ', LName) AS fullName FROM patients_registration WHERE id = :userId`,
            { replacements: { userId }, type: db.sequelize.QueryTypes.SELECT }
          );
          break;
        default:
          user = [{ fullName: "Unknown" }];
          break;
      }
      return user[0]?.fullName || "Unknown";
    };

    const auditActions = await db.sequelize.query(
      `SELECT * FROM clinicaltrials_actions 
       WHERE InitiatorType = 1 AND InitiatorID = :companyId AND ActionType = 0`,
      { replacements: { companyId }, type: db.sequelize.QueryTypes.SELECT }
    );

    const inviteActions = await db.sequelize.query(
      `SELECT * FROM clinicaltrials_actions 
       WHERE InitiatorType = 1 AND InitiatorID = :companyId AND ActionType = 1`,
      { replacements: { companyId }, type: db.sequelize.QueryTypes.SELECT }
    );

    const applyActionsRaw = await db.sequelize.query(
      `SELECT DISTINCT ActionID FROM clinicaltrials_actionrequests 
       WHERE ReceivedUserType = 1 AND ReceivedUserID = :companyId`,
      { replacements: { companyId }, type: db.sequelize.QueryTypes.SELECT }
    );

    const uniqueApplyActions = [...new Set(applyActionsRaw.map(action => action.ActionID))];

    const getDetailedActions = async (actions) => {
      return Promise.all(
        actions.map(async (action) => {
          const requests = await db.sequelize.query(
            `SELECT * FROM clinicaltrials_actionrequests WHERE ActionID = :actionId`,
            { replacements: { actionId: action.ActionID }, type: db.sequelize.QueryTypes.SELECT }
          );

          const responses = await db.sequelize.query(
            `SELECT * FROM clinicaltrials_actionresponses WHERE ActionID = :actionId`,
            { replacements: { actionId: action.ActionID }, type: db.sequelize.QueryTypes.SELECT }
          );

          const trial = await db.sequelize.query(
            `SELECT trial_name FROM clinical_trials WHERE CAST(trial_id AS UNSIGNED) = :trialId`,
            { replacements: { trialId: parseInt(action.TrialID) }, type: db.sequelize.QueryTypes.SELECT }
          );

          return {
            action: {
              ActionID: action.ActionID,
              ActionType: action.ActionType,
              TrialID: action.TrialID,
              InitiatorType: action.InitiatorType,
              InitiatorID: action.InitiatorID,
              IsCompleted: action.IsCompleted,
              Timestamp: action.Timestamp,
              initiatorName: await getUserFullName(action.InitiatorType, action.InitiatorID),
            },
            trialName: trial[0]?.trial_name || null,
            requests: await Promise.all(requests.map(async (request) => ({
              ReceivedUserType: request.ReceivedUserType,
              ReceivedUserID: request.ReceivedUserID,
              ReadStatus: request.ReadStatus,
              Note: request.Note,
              IsPrimaryRequest: request.IsPrimaryRequest,
              Timestamp: request.Timestamp,
              fullName: await getUserFullName(request.ReceivedUserType, request.ReceivedUserID)
            }))),
            responses: await Promise.all(responses.map(async (response) => ({
              ResponseUserType: response.ResponseUserType,
              ResponseUserID: response.ResponseUserID,
              ReadStatus: response.ReadStatus,
              ResponseStatus: response.ResponseStatus,
              Note: response.Note,
              Timestamp: response.Timestamp,
              fullName: await getUserFullName(response.ResponseUserType, response.ResponseUserID)
            }))),
          };
        })
      );
    };

    const auditActionDetails = await getDetailedActions(auditActions);
    const inviteActionDetails = await getDetailedActions(inviteActions);
    const applyActionDetails = await getDetailedActions(
      await Promise.all(uniqueApplyActions.map(async (actionId) => {
        const action = await db.sequelize.query(
          `SELECT * FROM clinicaltrials_actions WHERE ActionID = :actionId`,
          { replacements: { actionId }, type: db.sequelize.QueryTypes.SELECT }
        );
        return action[0];
      }))
    );

    res.json({ status: 'OK', result: { auditActions: auditActionDetails, inviteActions: inviteActionDetails, applyActions: applyActionDetails } });
  } catch (error) {
    console.error('Error fetching pharmaceuticals actions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 更新对反馈的阅读状态
exports.updateResponseReadStatus = async (req, res) => {
  const { actionId, responseUserType, responseUserId } = req.body;

  // 定义用户类型映射
  const userTypeMapping = {
    'Web staff': 0,
    'Company': 1,
    'Doctor': 2,
    'Patient': 3
  };

  // 转换 responseUserType 为数值
  const userTypeValue = typeof responseUserType === 'string' ? userTypeMapping[responseUserType] : responseUserType;

  // 检查请求体中的必要字段是否存在
  if (actionId === undefined || userTypeValue === undefined || responseUserId === undefined) {
    return res.status(400).json({ error: "Invalid request payload" });
  }

  const updateReadStatusQuery = `
      UPDATE clinicaltrials_actionresponses 
      SET ReadStatus = TRUE 
      WHERE ActionID = ? AND ResponseUserType = ? AND ResponseUserID = ?
  `;

  try {
    await db.sequelize.query(updateReadStatusQuery, {
      replacements: [actionId, userTypeValue, responseUserId],
      type: QueryTypes.UPDATE
    });

    res.json({ status: 'OK', result: true });
  } catch (error) {
    console.error('Error updating read status:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 更新对请求的阅读状态
exports.updateRequestReadStatus = async (req, res) => {
  const { actionId, responseUserType, responseUserId } = req.body;

  // 定义用户类型映射
  const userTypeMapping = {
    'Web staff': 0,
    'Company': 1,
    'Doctor': 2,
    'Patient': 3
  };

  // 转换 responseUserType 为数值
  const userTypeValue = typeof responseUserType === 'string' ? userTypeMapping[responseUserType] : responseUserType;

  // 检查请求体中的必要字段是否存在
  if (actionId === undefined || userTypeValue === undefined || responseUserId === undefined) {
    return res.status(400).json({ error: "Invalid request payload" });
  }

  const updateReadStatusQuery = `
      UPDATE clinicaltrials_actionrequests
      SET ReadStatus = TRUE 
      WHERE ActionID = ? AND ReceivedUserType = ? AND ReceivedUserID = ?
  `;

  try {
    await db.sequelize.query(updateReadStatusQuery, {
      replacements: [actionId, userTypeValue, responseUserId],
      type: QueryTypes.UPDATE
    });

    res.json({ status: 'OK', result: true });
  } catch (error) {
    console.error('Error updating read status:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

exports.getSyntheticPatients = async (req, res) => {
  try {
    const sqlQuery = `
      SELECT * FROM patients_registration pr
      INNER JOIN synthetic s ON pr.id = s.patient_id
    `;

    const patients = await db.sequelize.query(sqlQuery, {
      type: QueryTypes.SELECT,
    });

    // Transform the data to match the format in main.py while including all fields
    const transformedPatients = patients.map(patient => ({
      id: patient.id,
      FName: patient.FName,
      MName: patient.MName,
      LName: patient.LName,
      age: patient.Age,
      BloodGroup: patient.BloodGroup,
      gender: patient.Gender === 'Male' ? 1 : 0,
      height: patient.height,
      weight: patient.weight,
      race: patient.race,
      MobileNumber: patient.MobileNumber,
      EmailId: patient.EmailId,
      Address: patient.Address,
      Location: patient.Location,
      City: patient.City,
      Province: patient.Province,
      PostalCode: patient.PostalCode,
      Latitude: patient.Latitude,
      Longitude: patient.Longitude,
      HCardNumber: patient.HCardNumber,
      PassportNumber: patient.PassportNumber,
      PRNumber: patient.PRNumber,
      DLNumber: patient.DLNumber,
      uuid: patient.uuid,
      verification: patient.verification,
      dob: patient.date_of_birth,
      education: patient.education,
      social_class: patient.social_class,
      alcohol: patient.alcohol,
      physical_activity: patient.physical_activity,
      lack_of_cognitive_activity: patient.lack_of_cognitive_activity,
      family_history_of_dementia: patient.family_history_of_dementia,
      malnutrition: patient.malnutrition,
      poor_diet: patient.poor_diet,
      smoking: patient.smoking,
      cancer: patient.cancer,
      cardiovascular_disease: patient.cardiovascular_disease,
      congestive_heart_failure: patient.congestive_heart_failure,
      immune_system_dysfunction: patient.immune_system_dysfunction,
      micro_infarcts: patient.micro_infarcts,
      obesity: patient.obesity,
      poor_cholesterol_homeostasis: patient.poor_cholesterol_homeostasis,
      poor_controlled_type2_diabetes: patient.poor_controlled_type2_diabetes,
      stroke: patient.stroke,
      traumatic_brain_injury: patient.traumatic_brain_injury,
      depression: patient.depression,
      early_stress: patient.early_stress,
      air_pollution: patient.air_pollution,
      calcium_deficiency: patient.calcium_deficiency,
      metals: patient.metals,
      organic_solvents: patient.organic_solvents,
      vitamin_deficiency: patient.vitamin_deficiency,
      bacteria_infection: patient.bacteria_infection,
      dental_infection: patient.dental_infection,
      fungi_infection: patient.fungi_infection,
      viruses: patient.viruses,
      label: patient.label
    }));

    res.json({
      status: "OK",
      result: transformedPatients,
    });
  } catch (error) {
    console.error("Error fetching synthetic patients:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


//更新或创建反馈内容
exports.updateActionResponse = async (req, res) => {
  const { actionId, responseUserType, responseUserId, readStatus, responseStatus, note, timestamp } = req.body;

  // 定义用户类型映射
  const userTypeMapping = {
    'Web staff': 0,
    'Company': 1,
    'Doctor': 2,
    'Patient': 3
  };

  // 定义响应状态映射
  const responseStatusMapping = {
    'Agreed': 0,
    'Rejected': 1
  };

  // 定义阅读状态映射
  const readStatusMapping = {
    'Read': true,
    'Unread': false
  };

  // 转换 responseUserType 为数值
  const userTypeValue = typeof responseUserType === 'string' ? userTypeMapping[responseUserType] : responseUserType;

  // 转换 responseStatus 为数值
  const responseStatusValue = typeof responseStatus === 'string' ? responseStatusMapping[responseStatus] : responseStatus;

  // 转换 readStatus 为布尔值
  const readStatusValue = typeof readStatus === 'string' ? readStatusMapping[readStatus] : readStatus;

  // 转换 timestamp 为 MySQL 格式
  const mysqlTimestamp = new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');

  // 检查请求体中的必要字段是否存在
  if (actionId === undefined || userTypeValue === undefined || responseUserId === undefined || responseStatusValue === undefined || timestamp === undefined || readStatusValue === undefined) {
    return res.status(400).json({ error: "Invalid request payload" });
  }

  const checkExistenceQuery = `
      SELECT ResponseID FROM clinicaltrials_actionresponses
      WHERE ActionID = ? AND ResponseUserType = ? AND ResponseUserID = ?
  `;

  const updateQuery = `
      UPDATE clinicaltrials_actionresponses 
      SET ResponseStatus = ?, Note = ?, Timestamp = ?, ReadStatus = ?
      WHERE ActionID = ? AND ResponseUserType = ? AND ResponseUserID = ?
  `;

  const insertQuery = `
      INSERT INTO clinicaltrials_actionresponses (ActionID, ResponseUserType, ResponseUserID, ResponseStatus, Note, Timestamp, ReadStatus)
      VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    // 检查是否存在条目
    const results = await db.sequelize.query(checkExistenceQuery, {
      replacements: [actionId, userTypeValue, responseUserId],
      type: QueryTypes.SELECT
    });

    if (Array.isArray(results) && results.length > 0) {
      // 如果存在条目，更新条目
      await db.sequelize.query(updateQuery, {
        replacements: [responseStatusValue, note, mysqlTimestamp, readStatusValue, actionId, userTypeValue, responseUserId],
        type: QueryTypes.UPDATE
      });
    } else {
      // 如果不存在条目，插入新条目
      await db.sequelize.query(insertQuery, {
        replacements: [actionId, userTypeValue, responseUserId, responseStatusValue, note, mysqlTimestamp, readStatusValue],
        type: QueryTypes.INSERT
      });
    }

    res.json({ status: 'OK', result: true });
  } catch (error) {
    console.error('Error updating or inserting action response status:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

//为患者获取所有关联医生数据
exports.getPatientDoctor = async (req, res) => {
  const { patientId } = req.body;

  const selectDoctorIdsQuery = `
    SELECT doctor_id FROM patient_doctor WHERE patient_id = ?
  `;

  try {
    // 获取医生ID列表
    const doctorIdResults = await db.sequelize.query(selectDoctorIdsQuery, {
      replacements: [patientId],
      type: QueryTypes.SELECT
    });

    const doctorIds = doctorIdResults.map(row => row.doctor_id);

    if (doctorIds.length === 0) {
      return res.status(200).json({ status: 'OK', result: [] });
    }

    // 从 doctors_registration 表中获取医生信息
    const selectDoctorsQuery = `
      SELECT 
        id,
        Fname,
        Mname,
        Lname,
        MobileNumber,
        City,
        Province,
        Country,
        Specialization,
        PractincingHospital,
        Gender,
        Availability
      FROM doctors_registration
      WHERE id IN (:doctorIds)
    `;

    const doctorInfoResults = await db.sequelize.query(selectDoctorsQuery, {
      replacements: { doctorIds },
      type: QueryTypes.SELECT
    });

    // 返回医生信息列表
    res.status(200).json({ status: 'OK', result: doctorInfoResults });
  } catch (error) {
    console.error('Error fetching patient doctors:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// 消息发送模块
exports.MessageSend = async (req, res) => {
  let {
    conversationId,
    senderType,
    sender_id,
    receiverType,
    receiver_id,
    viewer_permissions,
    subject,
    content,
  } = req.body;

  const timestamp = new Date();

  const stripHtmlTags = (html) => html.replace(/<[^>]*>/g, '');

  const formatTimestamp = (date) => date.toISOString().split('T')[0];

  try {
    if (!subject || subject.trim() === '') {
      subject = `Untitled ${formatTimestamp(timestamp)}`;
    }

    const content_plain = stripHtmlTags(content);

    const processedViewerPermissions = Object.entries(viewer_permissions).reduce(
      (acc, [type, users]) => {
        acc[type] = users.map((user) => user.id);
        return acc;
      },
      {}
    );

    const formattedViewerPermissions = JSON.stringify(processedViewerPermissions);

    if (conversationId === 0) {
      const existingConversation = await db.sequelize.query(
        `
        SELECT * FROM conversations
        WHERE
          (
            (participant1_type = :senderType AND participant1_id = :sender_id AND participant2_type = :receiverType AND participant2_id = :receiver_id)
            OR
            (participant1_type = :receiverType AND participant1_id = :receiver_id AND participant2_type = :senderType AND participant2_id = :sender_id)
          )
          AND viewer_permissions = CAST(:viewer_permissions AS JSON)
        `,
        {
          replacements: {
            senderType,
            sender_id,
            receiverType,
            receiver_id,
            viewer_permissions: formattedViewerPermissions,
          },
          type: db.Sequelize.QueryTypes.SELECT,
        }
      );

      if (existingConversation.length > 0) {
        conversationId = existingConversation[0].conversation_id;
      } else {
        const insertConversationResult = await db.sequelize.query(
          `
          INSERT INTO conversations (
            participant1_type,
            participant1_id,
            participant2_type,
            participant2_id,
            viewer_permissions
          ) VALUES (
            :participant1_type,
            :participant1_id,
            :participant2_type,
            :participant2_id,
            CAST(:viewer_permissions AS JSON)
          )
          `,
          {
            replacements: {
              participant1_type: senderType,
              participant1_id: sender_id,
              participant2_type: receiverType,
              participant2_id: receiver_id,
              viewer_permissions: formattedViewerPermissions,
            },
            type: db.Sequelize.QueryTypes.INSERT,
          }
        );

        const [insertedId] = await db.sequelize.query("SELECT LAST_INSERT_ID() as conversation_id");
        conversationId = insertedId[0].conversation_id;

        for (const [type, ids] of Object.entries(processedViewerPermissions)) {
          for (const id of ids) {
            const existingPermission = await db.sequelize.query(
              `
              SELECT * FROM viewer_permissions
              WHERE viewer_type = :viewer_type AND viewer_id = :viewer_id
              `,
              {
                replacements: { viewer_type: type, viewer_id: id },
                type: db.Sequelize.QueryTypes.SELECT,
              }
            );

            if (existingPermission.length > 0) {
              let conversation_ids = existingPermission[0].conversation_ids || '[]';

              try {
                if (typeof conversation_ids === "number") {
                  conversation_ids = [conversation_ids];
                } else if (typeof conversation_ids === "string") {
                  conversation_ids = JSON.parse(conversation_ids);
                }
              } catch (error) {
                console.error("Error parsing conversation_ids:", error);
                conversation_ids = [];
              }

              if (!Array.isArray(conversation_ids)) {
                console.warn("conversation_ids is not an array, reinitializing as an empty array");
                conversation_ids = [];
              }

              if (!conversation_ids.includes(conversationId)) {
                conversation_ids.push(conversationId);

                await db.sequelize.query(
                  `
                  UPDATE viewer_permissions
                  SET conversation_ids = :conversation_ids
                  WHERE permission_id = :permission_id
                  `,
                  {
                    replacements: {
                      conversation_ids: JSON.stringify(conversation_ids),
                      permission_id: existingPermission[0].permission_id,
                    },
                    type: db.Sequelize.QueryTypes.UPDATE,
                  }
                );
              }
            } else {
              await db.sequelize.query(
                `
                INSERT INTO viewer_permissions (
                  viewer_type,
                  viewer_id,
                  conversation_ids
                ) VALUES (
                  :viewer_type,
                  :viewer_id,
                  :conversation_ids
                )
                `,
                {
                  replacements: {
                    viewer_type: type,
                    viewer_id: id,
                    conversation_ids: JSON.stringify([conversationId]),
                  },
                  type: db.Sequelize.QueryTypes.INSERT,
                }
              );
            }
          }
        }
      }
    }

    // **修改此处，插入消息时包含 sender_id**
    await db.sequelize.query(
      `
      INSERT INTO messages (
        conversation_id,
        sender_type,
        sender_id,
        subject,
        content,
        content_plain,
        timestamp,
        read_status
      ) VALUES (
        :conversation_id,
        :sender_type,
        :sender_id,         -- 添加 sender_id
        :subject,
        :content,
        :content_plain,
        :timestamp,
        :read_status
      )
      `,
      {
        replacements: {
          conversation_id: conversationId,
          sender_type: senderType,
          sender_id: sender_id, // 添加 sender_id
          subject,
          content,
          content_plain,
          timestamp,
          read_status: false,
        },
        type: db.Sequelize.QueryTypes.INSERT,
      }
    );

    res.status(200).json({ status: 'OK', result: 1 });
  } catch (error) {
    console.error('Error inserting message data:', error);
    res.status(500).json({ success: false, result: -1 });
  }
};


// 模块内部函数：根据用户类型和ID获取全名
const getNameByTypeAndId = async (type, id, db) => {
  let query = '';
  
  switch (type) {
    case 'Admin':
      query = `SELECT full_name AS name FROM admins WHERE admin_id = :id`;
      break;
    case 'Patient':
      query = `SELECT CONCAT(FName, ' ', COALESCE(MName, ''), ' ', LName) AS name FROM patients_registration WHERE id = :id`;
      break;
    case 'Doctor':
      query = `SELECT CONCAT(FName, ' ', COALESCE(MName, ''), ' ', LName) AS name FROM doctors_registration WHERE id = :id`;
      break;
    case 'Pharma':
      query = `SELECT name AS name FROM pharmaceutical_company WHERE id = :id`;
      break;
    case 'Clinic':
      query = `SELECT CONCAT(FName, ' ', COALESCE(MName, ''), ' ', LName) AS name FROM clinical_staff_registration WHERE id = :id`;
      break;
    default:
      console.log(`Unknown user type: ${type}`);
      return 'Unknown';
  }

  try {
    const result = await db.sequelize.query(query, {
      replacements: { id },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    if (result.length) {
      return result[0].name;
    } else {
      console.log(`No entry found for type: ${type}, id: ${id}`);
      return 'Unknown';
    }
  } catch (error) {
    console.error(`Error fetching name for type: ${type}, id: ${id}`, error);
    return 'Unknown';
  }
};

// 根据用户ID和类型查询相关会话及消息记录
exports.getMessagesByTypeAndId = async (req, res) => {
  const { user_id, user_type } = req.body;

  try {
    // 查询与给定用户ID和类型相关的所有会话
    const conversationsQuery = `
      SELECT conversation_id, 
             participant1_type, 
             participant1_id, 
             participant2_type, 
             participant2_id, 
             viewer_permissions
      FROM conversations
      WHERE (participant1_id = :user_id AND participant1_type = :user_type)
         OR (participant2_id = :user_id AND participant2_type = :user_type)
    `;

    const conversations = await db.sequelize.query(conversationsQuery, {
      replacements: { user_id: parseInt(user_id), user_type },
      type: db.Sequelize.QueryTypes.SELECT,
    });

    const categorizedConversations = {};
    const processedConversationIds = new Set();

    const conversationPromises = conversations.map(async (conversation) => {
      const isParticipant1 =
        conversation.participant1_type === user_type &&
        conversation.participant1_id === parseInt(user_id);
      const otherType = isParticipant1
        ? conversation.participant2_type
        : conversation.participant1_type;
      const otherId = isParticipant1
        ? conversation.participant2_id
        : conversation.participant1_id;
      const otherName = await getNameByTypeAndId(otherType, otherId, db);

      // 添加已处理的会话ID
      processedConversationIds.add(conversation.conversation_id);

      // 解析 viewer_permissions JSON
      if (typeof conversation.viewer_permissions === 'string') {
        try {
          conversation.viewer_permissions = JSON.parse(
            conversation.viewer_permissions
          );
        } catch {
          conversation.viewer_permissions = {};
        }
      }

      const simplifiedViewerPermissions = {};
      await Promise.all(
        Object.entries(conversation.viewer_permissions || {}).map(
          async ([viewerType, viewerIds]) => {
            simplifiedViewerPermissions[viewerType] = await Promise.all(
              viewerIds.map(async (viewerId) => ({
                id: viewerId,
                name: await getNameByTypeAndId(viewerType, viewerId, db),
              }))
            );
          }
        )
      );

      // **修改此处，包含 sender_id 字段**
      const messagesQuery = `
        SELECT message_id, sender_type, sender_id, subject, content, content_plain, timestamp, read_status
        FROM messages
        WHERE conversation_id = :conversation_id
        ORDER BY timestamp DESC
      `;
      const messages = await db.sequelize.query(messagesQuery, {
        replacements: { conversation_id: conversation.conversation_id },
        type: db.Sequelize.QueryTypes.SELECT,
      });

      const sendMessages = [];
      const receiveMessages = [];

      messages.forEach((message) => {
        const messageDetails = {
          message_id: message.message_id,
          sender_id: message.sender_id, // **添加 sender_id**
          subject: message.subject,
          content: message.content,
          content_plain: message.content_plain,
          timestamp: message.timestamp,
          read_status: message.read_status,
        };

        if (message.sender_type === user_type && message.sender_id === parseInt(user_id)) {
          sendMessages.push(messageDetails);
        } else {
          receiveMessages.push(messageDetails);
        }
      });

      if (!categorizedConversations[otherType]) {
        categorizedConversations[otherType] = [];
      }

      categorizedConversations[otherType].push({
        conversation_id: conversation.conversation_id,
        participant_name: otherName,
        participant_id: otherId,
        viewer_permissions: simplifiedViewerPermissions,
        send: sendMessages,
        receive: receiveMessages,
      });
    });

    await Promise.all(conversationPromises);

    // 获取用户的只读会话IDs
    const viewerPermissionsQuery = `
      SELECT conversation_ids
      FROM viewer_permissions
      WHERE viewer_type = :user_type AND viewer_id = :user_id
    `;

    const viewerPermissionsResult = await db.sequelize.query(
      viewerPermissionsQuery,
      {
        replacements: { user_id: parseInt(user_id), user_type },
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    const readOnlyConversationIds = new Set();
    viewerPermissionsResult.forEach((row) => {
      let conversationIds = row.conversation_ids;

      if (Array.isArray(conversationIds)) {
        conversationIds.forEach((id) =>
          readOnlyConversationIds.add(parseInt(id))
        );
      } else if (typeof conversationIds === 'string') {
        try {
          const ids = JSON.parse(conversationIds);
          if (Array.isArray(ids)) {
            ids.forEach((id) => readOnlyConversationIds.add(parseInt(id)));
          }
        } catch (e) {
          // Handle parse error
        }
      } else {
        // Unknown format
      }
    });

    // 排除已处理的会话IDs
    const newReadOnlyConversationIds = [...readOnlyConversationIds].filter(
      (id) => !processedConversationIds.has(id)
    );

    // 处理只读会话
    const readOnlyConversationPromises = newReadOnlyConversationIds.map(
      async (conversation_id) => {
        // 获取会话详情
        const conversationQuery = `
          SELECT conversation_id, 
                 participant1_type, 
                 participant1_id, 
                 participant2_type, 
                 participant2_id, 
                 viewer_permissions
          FROM conversations
          WHERE conversation_id = :conversation_id
        `;

        const [conversation] = await db.sequelize.query(conversationQuery, {
          replacements: { conversation_id },
          type: db.Sequelize.QueryTypes.SELECT,
        });

        if (!conversation) {
          // 会话不存在，跳过
          return;
        }

        // 获取参与者名称
        const participant1Name = await getNameByTypeAndId(
          conversation.participant1_type,
          conversation.participant1_id,
          db
        );
        const participant2Name = await getNameByTypeAndId(
          conversation.participant2_type,
          conversation.participant2_id,
          db
        );

        // 解析 viewer_permissions JSON
        if (typeof conversation.viewer_permissions === 'string') {
          try {
            conversation.viewer_permissions = JSON.parse(
              conversation.viewer_permissions
            );
          } catch {
            conversation.viewer_permissions = {};
          }
        }

        const simplifiedViewerPermissions = {};
        await Promise.all(
          Object.entries(conversation.viewer_permissions || {}).map(
            async ([viewerType, viewerIds]) => {
              simplifiedViewerPermissions[viewerType] = await Promise.all(
                viewerIds.map(async (viewerId) => ({
                  id: viewerId,
                  name: await getNameByTypeAndId(viewerType, viewerId, db),
                }))
              );
            }
          )
        );

        // **修改此处，包含 sender_id 字段**
        const messagesQuery = `
          SELECT message_id, sender_type, sender_id, subject, content, content_plain, timestamp, read_status
          FROM messages
          WHERE conversation_id = :conversation_id
          ORDER BY timestamp DESC
        `;
        const messages = await db.sequelize.query(messagesQuery, {
          replacements: { conversation_id },
          type: db.Sequelize.QueryTypes.SELECT,
        });

        // 按发送者类型分组消息
        const messagesBySenderType = {};

        for (const message of messages) {
          const senderType = message.sender_type;
          if (!messagesBySenderType[senderType]) {
            messagesBySenderType[senderType] = [];
          }
          messagesBySenderType[senderType].push({
            message_id: message.message_id,
            sender_id: message.sender_id, // **添加 sender_id**
            subject: message.subject,
            content: message.content,
            content_plain: message.content_plain,
            timestamp: message.timestamp,
            read_status: message.read_status,
          });
        }

        if (!categorizedConversations['Read only']) {
          categorizedConversations['Read only'] = [];
        }

        categorizedConversations['Read only'].push({
          conversation_id: conversation.conversation_id,
          participants: [
            {
              type: conversation.participant1_type,
              id: conversation.participant1_id,
              name: participant1Name,
            },
            {
              type: conversation.participant2_type,
              id: conversation.participant2_id,
              name: participant2Name,
            },
          ],
          viewer_permissions: simplifiedViewerPermissions,
          messages_by_sender_type: messagesBySenderType,
        });
      }
    );

    await Promise.all(readOnlyConversationPromises);

    res.status(200).json({
      status: 'OK',
      result: categorizedConversations,
    });
  } catch (error) {
    console.error('Error fetching conversations and messages:', error);
    res.status(500).json({
      status: 'Error',
      result: 'Failed to fetch conversations and messages.',
    });
  }
};



// 更新消息阅读状态
exports.MessageReadStatusUpdate = async (req, res) => {
  const { messageIds } = req.body; // 期望是一个消息ID的数组

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid input, expected an array of message IDs.' });
  }

  try {
    // 更新多条消息的阅读状态的 SQL 查询
    const updateMessageQuery = `
      UPDATE messages
      SET read_status = true
      WHERE message_id IN (:messageIds);
    `;

    // 执行更新查询
    await db.sequelize.query(updateMessageQuery, {
      replacements: { messageIds },
      type: db.Sequelize.QueryTypes.UPDATE,
    });

    console.log(`Message IDs ${messageIds.join(', ')} marked as read`);

    // 返回成功响应
    res.status(200).json({ status: 'OK', result: messageIds.length });
  } catch (error) {
    console.error('Error updating message read status:', error);
    res.status(500).json({ success: false, message: 'Failed to update message read status.' });
  }
};













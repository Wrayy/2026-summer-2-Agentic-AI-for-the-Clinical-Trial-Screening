const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

let raspberryData = {
  ecg: [],
  temperature: [],
  spo2: [],
};
let clients = [];
let previous = 0;

// Function to notify all SSE clients
function notifyAllSSEClients(data) {
  clients.forEach((client) =>
    client.res.write(`data: ${JSON.stringify(data)}\n\n`)
  );
  console.log("Notified all clients", data);
  raspberryData = { ecg: [], temperature: [], spo2: [] };
}

function processEcgData(ecgArray) {
  // 过滤出所有有效的ECG值并计算它们的平均值
  const validEcgValues = ecgArray.filter((value) => typeof value === "number");
  const sumOfValidEcgValues = validEcgValues.reduce(
    (sum, value) => sum + value,
    0
  );
  const defaultValue =
    validEcgValues.length > 0 ? sumOfValidEcgValues / validEcgValues.length : 0;

  return ecgArray.map((currentEcg) => {
    if (typeof currentEcg === "number") {
      previous = currentEcg; // 更新全局变量previous
      return currentEcg;
    } else {
      // 如果当前值不是一个有效数字，则使用前一个有效值或平均值作为替代
      return previous || defaultValue;
    }
  });
}

function processSpo2Data(spo2Data) {
  const validData = spo2Data.filter((val) => !isNaN(val));
  const sum = validData.reduce((acc, val) => acc + val, 0);
  return validData.length > 0 ? sum / validData.length : null;
}

exports.getDataFromRaspberry = async (req, res) => {
  data = req.body;
  console.log(data);
  if (data) {
    const ecgProcessed = processEcgData(data?.ecg);
    const spo2Average = processSpo2Data(data?.SPO2);

    raspberryData = {
      ecg: ecgProcessed,
      temperature: data?.temperature,
      spo2: spo2Average,
    };

    res.status(200).json({ message: "Data received" });
    notifyAllSSEClients(raspberryData);
  } else {
    res.status(400).json({ message: "No data received." });
  }
};

exports.getRaspberryData = async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const client = { id: Date.now(), res };
  clients.push(client);

  req.on("close", () => {
    clients = clients.filter((c) => c.id !== client.id);
  });

  res.write(`data: ${JSON.stringify(raspberryData)}\n\n`);
};

exports.getPatientPortalInfoById = async (req, res, db) => {
  const patientId = req.body.patientId;

  try {
    // 从 patients_registration 表中获取患者数据
    const patientData = await db("patients_registration")
      .where("id", patientId)
      .select("*");

    if (patientData.length === 0) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // 从 patients_pathology 表中获取病史数据
    const pathologyData = await db("patients_pathology")
      .where("patient_id", patientId)
      .select("pathology", "surgeries", "pregnancies", "prior_medication")
      .first(); // 假设病史数据是一对一关系

    // 从 patients_treatment 表中获取治疗数据，并关联 doctors_registration 表以获取医生姓名
    const treatmentData = await db("patients_treatment as pt")
      .join("doctors_registration as dr", "pt.doctor_id", "=", "dr.id")
      .where("pt.patient_id", patientId)
      .select(
        "pt.treatment",
        "pt.RecordDate",
        "pt.disease_type",
        "pt.disease_id",
        "dr.id as doctor_id",
        db.raw("CONCAT(dr.Fname, ' ', IFNULL(dr.Mname, ''), ' ', dr.Lname) as doctor_name")
      );

    // 将数据组合成一个响应对象
    const responseData = {
      ...patientData[0],
      pathology: pathologyData || {}, // 包含病史数据，未找到时为空对象
      treatments: treatmentData || [] // 包含治疗数据，未找到时为空数组
    };

    // 发送组合后的数据作为响应
    res.json(responseData);
  } catch (error) {
    console.error("Error fetching patient data:", error);
    res.status(500).json({ error: "Error fetching patient data" });
  }
};

exports.getPressureData = async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // set the necessary SSE head

  // send to client side
  setInterval(() => {
    const data = {
      value: Math.floor(400 + Math.random() * 300),
      // other data
    };
    res.write(`retry: 10000\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }, 2000);
};

exports.readSerialPortData = async (req, res) => {
  const PORT = "COM3"; // set serialport number

  try {
    const data = await new Promise((resolve, reject) => {
      const port = new SerialPort({
        path: PORT,
        baudRate: 115200,
      });
      const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

      parser.on("data", (data) => {
        console.log("Received data:", data);
        resolve(data); // return received data
        port.close(); // close serial after reading
      });

      port.on("error", (err) => {
        console.error("Serial port error: ", err);
        reject(err || new Error("Unknown error occurred with serial port"));
      });
    });

    res.json({ data });
  } catch (error) {
    res
      .status(500)
      .send("Error reading serial port data" + JSON.stringify(error));
  }
};

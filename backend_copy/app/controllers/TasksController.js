
const db = require("../../db");
const { Op, QueryTypes } = require("sequelize");

const DoctorTask = db.DoctorTask;

// Find all task, good
exports.getAllTasks = async (req, res) => {
  const { filter } = req.query;

  // Add condition based on the filter option
  const currentDate = new Date();
  let whereCondition;
  if (filter === 'today') {
    whereCondition = {
      Start: { [Op.gte]: new Date(currentDate.getTime() - 1 * 24 * 60 * 60 * 1000) },
    };
  } else if (filter === 'week') {
    whereCondition = {
      Start: { [Op.gte]: new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000) },
    };
  } else {
    whereCondition = {};
  }

  try{
    const data = await DoctorTask.findAll({
      // Include the where condition here
      where: {
        ...whereCondition,
      },
      attributes: {
        include: [
          [db.sequelize.literal(`(SELECT concat_ws(' ', FName, MName, LName) FROM patients_registration AS td WHERE td.id=DoctorTask.Patient)`), 'PatientName'],
        ],
      },
    });

    res.send(data.map((record) => record.dataValues));

  }catch(err) {
    res.status(400).send({
      message: err.message || `Some error occurred while retrieving tasks.`,
    });
  }
};

// Query specific task, good
exports.getTaskByPatientDetails = (req, res) => {
  DoctorTask.findOne({ 
    where: { 
      id: req.params.id,
     }
   })
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      res.status(400).send({
        message: `Error retrieving Tasks with the given details.`,
      });
    });
};

// Create a new task,good
exports.createTask = (req, res) => {
  console.log(req.body);

  // Create a task then save it in the database
  const task = {
    Doctor: req.body.Doctor,
    Patient: req.body.Patient,
    Start: req.body.Start,
    End: req.body.End,
    Description: req.body.Description,
  };

  // Save task in the database
  DoctorTask.create(task)
    .then((data) => {
      res.send(data);
    })
    .catch((err) => {
      console.log(err);
      res.status(400).send({
        message: `Some error occurred while creating the Task.`,
      });
    });
};

// Update task
exports.updateTask = (req, res) => {
  DoctorTask.update(req.body,{ where: { 
    id: req.params.id,
    } })
    .then((result) => {
      if (result.nModified > 0) {
        res.send({
          message: `${result.nModified} task(s) were updated successfully.`,
        });
      } else {
        res.send({
          message: `!`,
        });
      }
    })
    .catch((err) => {
      res.status(400).send({
        message: `Error updating task`,
      });
    });
};

// Delete task,good
exports.deleteTask = (req, res) => {
  const id = req.params.id;
  DoctorTask.destroy({ where: { 
    id,
   } })
    .then((data) => {
      if (data) {
        res.send({
          message: `Task was deleted successfully!`,
        });
      } else {
        res.send({
          message: `Cannot delete Task with id=${id}. Maybe Task was not found!`,
        });
      }
    })
    .catch((err) => {
      res.status(400).send({
        message: `Could not delete Task with id=${id}`,
      });
    });
};

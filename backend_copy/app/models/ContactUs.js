
module.exports = (sequelize, Sequelize) => {
  const ContactUs = sequelize.define("contact_us", {

    contact_id: {
      type: Sequelize.INTEGER,
    },
    contact_name: {
      type: Sequelize.STRING,
    },
    contact_email: {
      type: Sequelize.STRING,
    },
    contact_phone: {
      type: Sequelize.STRING,
    },
    contact_topic: {
      type: Sequelize.INTEGER,
    },
    contact_message: {
      type: Sequelize.STRING,
    },
    contact_time: {
      type: Sequelize.STRING,
    },
    contact_reply: {
      type: Sequelize.INTEGER,
    },
    // Define other fields here
  });
  return ContactUs;
};

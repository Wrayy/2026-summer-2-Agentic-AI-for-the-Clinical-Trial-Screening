module.exports = (sequelize, Sequelize) => {
  const ClinicalReasoning = sequelize.define("clinical_reasoning", {
    FName: {
      type: Sequelize.STRING,
    },
    MName: {
      type: Sequelize.STRING,
    },
    LName: {
      type: Sequelize.STRING,
    },
    EmailId: {
      type: Sequelize.STRING,
    },
    Password: {
      type: Sequelize.STRING,
    }
  });
  return ClinicalReasoning;
};

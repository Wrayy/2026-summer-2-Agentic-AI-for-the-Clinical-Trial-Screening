module.exports = (sequelize, Sequelize) => {
    const UserReview = sequelize.define("UserReview", {
      Patient: {
        type: Sequelize.TEXT,
        field: 'UserID',
      },
      TimeSegment:{
        type: Sequelize.TEXT,
        field: 'Review',
      },
      Status:{
        type: Sequelize.INTEGER,
        field: 'Rating',
      },
    }
     
   );
    return UserReview;
  };

const handelSubmit = (req,res,db)=>{
    const {email} = req.body;
    db.select('online_patient_id','email').from('online_patients').where('email','=',email).then(rows =>{
        if(rows.length > 0){
            return db('online_patients').where('email','=',email).update({ session_status: 'inactive'})
        }
    })
    .then(() =>{res.status(200).json('Operation successful')})
    .catch(err => res.status(400).json('Error in processing request'))
}

module.exports = {
    handelSubmit
}
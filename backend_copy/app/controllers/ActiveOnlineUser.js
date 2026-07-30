
const handelSubmit = (req,res,db)=>{
    const {id , name, email} = req.body;
    db.select('online_patient_id','email').from('online_patients').where('email','=',email).then(rows =>{
        if(rows.length > 0){
            return db('online_patients').where('email','=',email).update({ session_status: 'active', start_time: new Date() })
        }
        else{
            return db('online_patients').insert({
                online_patient_id: id,
                Fname: name,
                email: email,
                session_status: 'active',
                start_time: new Date()
            })
        }
    })
    .then(() =>{res.status(200).json({ message: 'Operation successful' });})
    .catch(err => res.status(400).json('Error in processing request'))
}

module.exports = {
    handelSubmit
}
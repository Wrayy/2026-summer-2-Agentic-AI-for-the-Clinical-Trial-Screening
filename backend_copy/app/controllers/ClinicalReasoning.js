

const handelSubmit = (req,res,db,bcrypt)=>{
    const {firstName,
        middleName,
        lastName,
        emailID,
        cEmailID,
        password,
        cPassword} = req.body;

    db('clinical_reasoning').insert({
        FName: firstName,
        MName: middleName,
        LName: lastName,
        EmailId: emailID,
        Password: password,
        verification:1
    })
    .then(() =>{res.status(200).json({ message: 'Operation successful' });})
    .catch(err => res.status(400).json('Error in processing request'))
}

module.exports = {
    handelSubmit
}
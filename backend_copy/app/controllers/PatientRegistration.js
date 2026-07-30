

const handelSubmit = (req,res,db,bcrypt)=>{
    const {firstName,
        middleName,
        lastName,
        gender,
        age,
        bloodGroup,
        mobileNumber,
        emailID,
        cEmailID,
        password,
        cPassword,
        address1,
        address2,
        postalCode,
        city,
        province,
        healthCardNumber,
        passportNumber,
        prNumber,
        drivingLicenseNumber} = req.body;
        const address = address1 + ' ' + address2

    db('patients_registration').insert({
        FName: firstName,
        MName: middleName,
        LName: lastName,
        Age: age,
        BloodGroup: bloodGroup,
        Gender: gender,
        MobileNumber: mobileNumber,
        EmailId: emailID,
        Address: address,
        Location: 'ottawa',
        City: city,
        Province: province,
        PostalCode: postalCode,
        HCardNumber: healthCardNumber,
        PassportNumber: passportNumber,
        PRNumber: prNumber,
        DLNumber: drivingLicenseNumber,
        password:password,
        verification:1
    })
    .then(() =>{res.status(200).json({ message: 'Operation successful' });})
    .catch(err => res.status(400).json('Error in processing request'))
}

module.exports = {
    handelSubmit
}
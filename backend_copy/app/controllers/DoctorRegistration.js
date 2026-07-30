

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
        country,
        medicalLicenseNumber,
        pHospital,
        specialization,
        drivingLicenseNumber} = req.body;

    db('doctors_registration').insert({
        FName: firstName,
        MName: middleName,
        LName: lastName,
        Age: age,
        BloodGroup: bloodGroup,
        Gender: gender,
        MobileNumber: mobileNumber,
        EmailId: emailID,
        Location1: address1,
        Location2: address2,
        City: city,
        Province: province,
        Country: country,
        PostalCode: postalCode,
        Medical_LICENSE_Number: medicalLicenseNumber,
        DLNumber: drivingLicenseNumber,
        Specialization: specialization,
        PractincingHospital: pHospital,
        password:password,
        verification:0,
        Availability:1
    })
    .then(() =>{res.status(200).json({ message: 'Operation successful' });})
    .catch(err => res.status(400).json('Error in processing request'))
}

module.exports = {
    handelSubmit
}
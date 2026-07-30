

const handelSubmit = (req,res,db,bcrypt)=>{
    const {hospitalName,
        emailID,
        password,
        mobileNumber,
        address1,
        address2,
        postalCode,
        city,
        province,
        country,
        departments,
        nDoctors,
        nNurses,
        nAdmins,
        nPatients,
        taxRegistrationNumber} = req.body;

    db('hospital_admin').insert({
        Hospital_Name: hospitalName,
        Email_Id: emailID,
        MobileNumber: mobileNumber,
        Location1: address1,
        Location2: address2,
        PostalCode: postalCode,
        City: city,
        Province: province,
        Country: country,
        Facilities_departments: departments,
        Number_Doctors: nDoctors,
        Number_Nurse: nNurses,
        No_Admins: nAdmins,
        Patients_per_year: nPatients,
        Tax_registration_number: taxRegistrationNumber,
        password:password,
        Availability:1
    })
    .then(() =>{res.status(200).json({ message: 'Operation successful' });})
    .catch(err => res.status(400).json('Error in processing request'))
}

module.exports = {
    handelSubmit
}
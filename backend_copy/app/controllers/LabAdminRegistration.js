

const handelSubmit = (req,res,db,bcrypt)=>{
    const {labName,
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
        referringPhysicianName,
        referringPhysicianCI,
        insuranceInformation,
        paymentMethod,
        taxRegistrationNumber} = req.body;

    db('lab_admin').insert({
        Lab_Name: labName,
        Email_Id: emailID,
        Location1: address1,
        Location2: address2,
        PostalCode: postalCode,
        City: city,
        Province: province,
        Country: country,
        Ref_Phy_Name: referringPhysicianName,
        Ref_Phy_Con_Info: referringPhysicianCI,
        Insu_Info: insuranceInformation,
        TRN: taxRegistrationNumber,
        Payment_Metho: paymentMethod,
        password:password,
        Availability:1
    })
    .then(() =>{res.status(200).json({ message: 'Operation successful' });})
    .catch(err => res.status(400).json('Error in processing request'))
}

module.exports = {
    handelSubmit
}
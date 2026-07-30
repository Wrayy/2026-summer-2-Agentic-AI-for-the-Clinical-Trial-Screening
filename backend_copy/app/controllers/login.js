
const handelLogin = (req, res, db, bcrypt) => {
    const { email, password, selectedOption } = req.body;
    //    'admin_id','full_name','email'
    if (selectedOption === 'Admin') {
        db.select('email', 'password').from('admins')
            .where('email', '=', email).
            then(data => {
                const isValid = password === data[0].password;
                if (isValid) {
                    req.session.identity = selectedOption;
                    req.session.email = email;
                    return db.select('*').from('admins')
                        .where('email', '=', email)
                        .then(user => {
                            res.json(user[0])
                        })
                        .catch(err => res.status(400).json('unable to get user'))
                } else {
                    res.status(400).json('wrong credentials');
                }
            })
            .catch(err => res.status(400).json('wrong credentials'))
    }
    else if (selectedOption === 'Patient') {
        db.select('EmailId', 'password').from('patients_registration')
            .where('EmailId', '=', email).
            then(data => {
                const isValid = password === data[0].password;
                if (isValid) {
                    req.session.identity = selectedOption;
                    req.session.email = email;
                    return db.select('*').from('patients_registration')
                        .where('EmailId', '=', email)
                        .then(user => {
                            res.json(user[0])
                        })
                        .catch(err => res.status(400).json('unable to get user'))
                } else {
                    res.status(400).json('wrong credentials');
                }
            })
            .catch(err => res.status(400).json('wrong credentials'))
    }
    else if (selectedOption === 'Doctor') {
        db.select('EmailId', 'password', 'verification').from('doctors_registration')
            .where('EmailId', '=', email).
            then(data => {
                if (password !== data[0].password) {
                    res.status(400).json('wrong credentials');
                    return;
                }

                if (data[0].verification !== 1) {
                    res.status(400).json('Account hasn\'t been verified');
                    return;
                }

                req.session.identity = selectedOption;
                req.session.email = email;
                return db.select('*').from('doctors_registration')
                    .where('EmailId', '=', email)
                    .then(user => {
                        res.json(user[0])
                    })
                    .catch(err => res.status(400).json('unable to get user'))
            })
            .catch(err => res.status(400).json('wrong credentials'))
    }
    else if (selectedOption === 'Clinic') {
        db.select('email', 'password').from('clinical_staff_registration')
            .where('email', '=', email).
            then(data => {
                const isValid = password === data[0].password;
                if (isValid) {
                    req.session.identity = selectedOption;
                    req.session.email = email;
                    return db.select('*').from('clinical_staff_registration')
                        .where('email', '=', email)
                        .then(user => {
                            res.json(user[0])
                        })
                        .catch(err => res.status(400).json('unable to get user'))
                } else {
                    res.status(400).json('wrong credentials');
                }
            })
            .catch(err => res.status(400).json('wrong credentials'))
    }
    else if (selectedOption === 'PharmaAdmin') {
        console.log('pharma admin');
        db.select('email', 'password').from('pharmacy_registration')
            .where('email', '=', email).
            then(data => {
                const isValid = password === data[0].password;
                if (isValid) {
                    req.session.identity = selectedOption;
                    req.session.email = email;
                    return db.select('*').from('pharmacy_registration')
                        .where('email', '=', email)
                        .then(user => {
                            res.json(user[0])
                        })
                        .catch(err => res.status(400).json('unable to get user'))
                } else {
                    res.status(400).json('wrong credentials');
                }
            })
            .catch(err => res.status(400).json('wrong credentials'))
    }
    else if (selectedOption === 'Pharma') {
        db.select('email', 'password').from('pharmaceutical_company')
            .where('email', '=', email).
            then(data => {
                const isValid = password === data[0].password;
                if (isValid) {
                    req.session.identity = selectedOption;
                    req.session.email = email;
                    return db.select('*').from('pharmaceutical_company')
                        .where('email', '=', email)
                        .then(user => {
                            res.json(user[0])
                        })
                        .catch(err => res.status(400).json('unable to get user'))
                } else {
                    res.status(400).json('wrong credentials');
                }
            })
            .catch(err => res.status(400).json('wrong credentials'))
    } else if (selectedOption === 'ClinicalReasoning') {
        db.select('EmailId', 'Password').from('clinical_reasoning')
            .where('EmailId', '=', email).
            then(data => {
                const isValid = password === data[0].Password;
                if (isValid) {
                    req.session.identity = selectedOption;
                    req.session.email = email;
                    return db.select('*').from('clinical_reasoning')
                        .where('EmailId', '=', email)
                        .then(user => {
                            res.json(user[0])
                        })
                        .catch(err => res.status(400).json('unable to get user'))
                } else {
                    res.status(400).json('wrong credentials');
                }
            })
            .catch(err => res.status(400).json('wrong credentials'))
    } else {
        db.select('Email_Id', 'password').from('hospital_admin')
            .where('Email_Id', '=', email).
            then(data => {
                const isValid = password === data[0].password;
                if (isValid) {
                    return db.select('*').from('hospital_admin')
                        .where('Email_Id', '=', email)
                        .then(user => {
                            res.json(user[0])
                        })
                        .catch(err => res.status(400).json('unable to get user'))
                } else {
                    res.status(400).json('wrong credentials');
                }
            })
            .catch(err => res.status(400).json('wrong credentials'))
    }
    // db.select('email','hash').from('login')
    // .where('email','=',email)
    // .then(data =>{
    //     const isValid = bcrypt.compareSync(password,data[0].hash);
    //     if(isValid){
    //         return db.select('*').from('users')
    //         .where('email','=',email)
    //         .then(user =>{
    //             res.json(user[0])
    //         })
    //         .catch(err => res.status(400).json('unable to get user'))
    //     }else{
    //         res.status(400).json('wrong credentials');
    //     }
    // })
    // .catch(err => res.status(400).json('wrong credentials'))
}

module.exports = {
    handelLogin
}
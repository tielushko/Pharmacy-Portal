const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
const bcrypt = require("bcrypt");
const { response } = require("express");
const session = require("express-session");
const flash = require("express-flash");

const pool = require("./db");
const passport = require("passport");
const initializePassport = require("./passportConfig");
const e = require("express");
initializePassport(passport);
//local port for the server
const port = process.env.PORT || 8000;

//create express app
const app = express();

//set the default path for templates to views, then we can work with what's inside of it.
app.set("views", path.join(__dirname, "/views"));

app.use(express.static(path.join(__dirname, "/views")))

//set templates view engine to be of ejs extension
app.set("view engine", "ejs");

//to be able to parse the POST form information from the body - may not need later
app.use(express.urlencoded({ extended: false }));
//to handle json data of request.body
app.use(express.json());
//method override to provide the methods outside of get and post in the form
app.use(methodOverride("_method"));

app.use(session({ secret: "secret", resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

/*
 ROUTES
*/
//handling home request - renders basic home ejs page that can be found in views folder.
app.get("/", (request, response) => {
    response.render("home.ejs");
});

// Renders registration page
app.get("/users/register", checkAuthenticated, (request, response) => {
    response.render("register");
});

// Renders login page
app.get("/users/login", checkAuthenticated, (request, response) => {
    response.render("login");
});

// Renders dashboard based on the user
app.get("/users/dashboard", checkNotAuthenticated, (request, response) => {
    console.log(request.user);
    response.render("dashboard", { user: request.user });
});

// redirects to home page on logout
app.get("/users/logout", (request, response) => {
    request.logOut();
    request.flash("success_msg", "You have successfully logged out");
    response.redirect("/users/login");
});

// adds to user table and then redirects to login page
app.post("/users/register", async (request, response) => {
    let { name, email, password, password2, usr_type } = request.body;
    console.log({ name, email, password, password2, usr_type });

    let errors = [];

    //validator for the registration form
    if (!name || !email || !password || !password2 || !usr_type) {
        errors.push({ message: "Please enter all fields!" });
    }

    if (password.length < 6) {
        errors.push({ message: "Password should be at least 6 characters!" });
    }

    if (password !== password2) {
        errors.push({ message: "Passwords do not match!" });
    }

    //if the error array is containing some errors, we re-render the registration page and displaying the errors.
    if (errors.length > 0) {
        response.render("register", { errors });
    } else {
        //form is ok, check the database for existing user
        let hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword);

        pool.query(
            `SELECT * FROM users WHERE email=$1`,
            [email],
            (error, results) => {
                if (error) {
                    throw error;
                }
                console.log(results.rows);
                //if user email was found in db, we need to indicate an error in registration
                if (results.rows.length > 0) {
                    errors.push({
                        message: "User with the specified email already exists",
                    });
                    response.render("register", { errors });
                } else {
                    pool.query(
                        "INSERT INTO users (name, email, password, usr_type) VALUES ($1, $2, $3, $4) RETURNING id, password",
                        [name, email, hashedPassword, usr_type],
                        (error, results) => {
                            if (error) {
                                throw error;
                            }
                            console.log(results.rows);
                            request.flash(
                                "success_msg",
                                "You have successfully registered an account. Please log in!"
                            );
                            response.redirect("/users/login");
                        }
                    );
                }
            }
        );
    }
});

// Authenticates user and renders dashboard
app.post(
    "/users/login",
    passport.authenticate("local", {
        successRedirect: "/users/dashboard",
        failureRedirect: "/users/login",
        failureFlash: true,
    })
);

//pulls up the form to create a prescription.
app.get("/prescriptions", checkNotAuthenticated, async (request, response) => {
    try {
        // const userID = request.session.passport.user;
        // console.log(userID);
        //ISSUE: DOES NOT RETURN DRUG NAME AND NAME OF PATIENT
        // const results = await pool.query(
        //     "SELECT * FROM prescribed_by as PB, patient as P, drugs as D WHERE PB.p_id=P.id AND PB.med_id=D.drug_id AND PB.id=$1",
        //     [doctorID]
        // );

        // const prescriptionList = results.rows;
        // console.log(prescriptionList);

        response.render("prescriptions", {
            // id: userID,
            user: request.user,
            error: "",
            success: "",
        });
    } catch (error) {
        console.error(error);
    }
});

app.get("/prescriptions/search", checkNotAuthenticated, async (request, response) => {
    try {
        const { patientName, patientEmail } = request.query;
        const userID = request.session.passport.user;
        const user = request.user
        console.log(userID, patientName, patientEmail);
        console.log(user)

        if (user.usr_type == 'doctor') {
            const patientsQuery = await pool.query(
                "SELECT * FROM prescribed_by as PB, patient as P, drugs as D WHERE PB.p_id=P.id AND PB.med_id=D.drug_id AND PB.id=$1 AND P.name=$2 AND P.email=$3",
                [userID, patientName, patientEmail],
                (err, result) => {
                    if (err) {
                        console.error(err.message);
                    } else {
                        const foundPrescriptions = result.rows;
                        console.log(foundPrescriptions);

                        if (foundPrescriptions.length > 0) {
                            response.render("prescriptions.ejs", {
                                userID,
                                foundPrescriptions,
                                user: user,
                                success: `Here is a list of your prescriptions for patient ${patientName}!`,
                                error: "",
                            });
                        } else {
                            response.render("prescriptions.ejs", {
                                userID,
                                foundPrescriptions,
                                user: user,
                                success: "",
                                error: `Sorry, you don't have any prescriptions for ${patientName}!`,
                            });
                        }
                    }
                }
            );
        }
        else if (user.usr_type == 'pharmacist') {
            const patientsQuery = await pool.query(
                "SELECT * FROM prescribed_by as PB, patient as P, drugs as D WHERE PB.p_id=P.id AND PB.med_id=D.drug_id AND P.name=$1 AND P.email=$2",
                [patientName, patientEmail],
                (err, result) => {
                    if (err) {
                        console.error(err.message);
                    } else {
                        const foundPrescriptions = result.rows;
                        console.log(foundPrescriptions);

                        if (foundPrescriptions.length > 0) {
                            response.render("prescriptions.ejs", {
                                userID,
                                foundPrescriptions,
                                user: user,
                                success: `Here is a list of your prescriptions for patient ${patientName}!`,
                                error: "",
                            });
                        } else {
                            response.render("prescriptions.ejs", {
                                userID,
                                foundPrescriptions,
                                user: user,
                                success: "",
                                error: `Sorry, you don't have any prescriptions for ${patientName}!`,
                            });
                        }
                    }
                }
            );
        }
    } catch (error) {
        console.error(error.message);
    }
});

//delete a particular prescription.
app.post(
    "/prescriptions/delete/:userID/:patientID/:medicineID",
    checkNotAuthenticated,
    async (request, response) => {
        const { userID, patientID, medicineID } = request.params;
        console.log(userID, patientID, medicineID);

        const deletePrescription = await pool.query(
            "DELETE FROM prescribed_by WHERE id=$1 AND p_id=$2 AND med_id=$3",
            [userID, patientID, medicineID],
            (err, result) => {
                if (err) {
                    console.log(err.message);
                } else {
                    if (result.rowCount > 0) {
                        response.render("prescriptions", {
                            userID,
                            user: request.user,
                            success:
                                "The prescription was successfully deleted",
                            error: "",
                        });
                    } else {
                        response.render("prescriptions", {
                            userID,
                            user: request.user,
                            success: "",
                            error:
                                "There was an  error deleting your prescription",
                        });
                    }
                }
            }
        );
    }
);

//TODO - delete this route as it is not needed anymore
app.get("/prescriptions/issue", checkNotAuthenticated, (request, response) => {
    console.log(request.session.passport);
    response.render("issuePrescription");
});

// add the medicine to the stock
app.post("/prescriptions/issue", checkNotAuthenticated, async (request, response) => {
    try {
        //get the required fields from the form body
        const {
            patientName,
            patientEmail,
            patientPhoneNumber,
            medicineLabel,
            medicineQuantity,
            medicineStrength,
            medicineDosage,
        } = request.body;
        const userID = request.session.passport.user;
        let patientID;
        let medicineID;

        console.log(request.body, userID);

        // insert a patient into the database if already not exists.
        const addPatientIfNotExists = await pool.query(
            "SELECT * FROM patient WHERE name=$1 AND email=$2 AND phone_number=$3",
            [patientName, patientEmail, patientPhoneNumber],
            async (err, result) => {
                try {
                    if (err) {
                        console.error(err.message);
                    } else {
                        console.log(result);
                        //patient was not found in the DB, we need to add his/her credentials
                        if (result.rowCount == 0) {
                            const addNewPatientToDB = await pool.query(
                                "INSERT INTO patient (name, email, phone_number) VALUES ($1, $2, $3) RETURNING *;",
                                [patientName, patientEmail, patientPhoneNumber],
                                (err, result) => {
                                    if (err) {
                                        console.error(err.message);
                                    } else {
                                        console.log(result);
                                        patientID = result.rows[0].id;
                                    }
                                }
                            );
                        } else {
                            // just set the patientID variable to the result id
                            patientID = result.rows[0].id;
                            console.log(patientID);
                        }
                    }
                } catch (error) {
                    console.error(error.message);
                }
            }
        );
        // check if the medicine inserted exists in the database, if exists, then we can finalize the prescription and add it to the prescribed_by table
        const searchMedicineInStock = await pool.query(
            "SELECT * FROM drugs WHERE drug_name=$1 AND drug_strength=$2",
            [medicineLabel, medicineStrength],
            async (err, result) => {
                try {
                    if (err) {
                        console.error(err.message);
                    } else {
                        console.log(result);
                        //medicine was found, we can insert the prescription into the database and render success
                        if (result.rowCount > 0) {
                            medicineID = result.rows[0].drug_id;
                            //get the prescription date and prepare for the psql format
                            let currentDate = new Date();
                            const psqlDate =
                                currentDate.getFullYear() +
                                "-" +
                                String(currentDate.getMonth() + 1) +
                                "-" +
                                String(currentDate.getDate());
                            const addPrescriptionToDB = await pool.query(
                                "INSERT INTO prescribed_by (med_id, id, p_id, quantity, dosage, prescription_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
                                [
                                    medicineID,
                                    userID,
                                    patientID,
                                    medicineQuantity,
                                    medicineDosage,
                                    psqlDate,
                                ],
                                (err, result) => {
                                    if (err) {
                                        console.error(err.message);
                                    } else {
                                        response.render("prescriptions", {
                                            userID,
                                            user: request.user,
                                            success:
                                                "Your prescription was added to the database",
                                            error: "",
                                        });
                                    }
                                }
                            );

                            // medicine is not found, we cannot assign the prescription.
                        } else {
                            response.render("prescriptions", {
                                userID,
                                user: request.user,
                                success: "",
                                error:
                                    "The medicine you are trying to prescribe is not currently in Pharmacy Stock!",
                            });
                        }
                    }
                } catch (error) {
                    console.error(error.message);
                }
            }
        );
    } catch (error) {
        console.error(error.message);
    }
});

// Pulls up Drug CRUD
app.get("/drugs", checkNotAuthenticated, (request, response) => {
    console.log(request.session.passport);
    response.render("updateMeds", { success: "", error: "" });
});

// Search drugs in the table
app.get("/drugs/search", checkNotAuthenticated, async (request, response) => {
    try {
        const { name, strength } = request.query;
        console.log(name, strength);
        const drugsQuery = await pool.query(
            "SELECT * FROM Drugs AS D WHERE D.drug_name = $1 AND D.drug_strength = $2;",
            [name, strength]
        );
        const foundDrugsList = drugsQuery.rows;
        console.log(foundDrugsList);

        if (foundDrugsList.length > 0) {
            response.render("updateMeds.ejs", {
                foundDrugsList,
                success: "Here are the drugs that match your query",
                error: "",
            });
        } else {
            response.render("updateMeds.ejs", {
                success: "",
                error:
                    "Sorry. The drug you are trying to search for does not exist in our database",
            });
        }
    } catch (error) {
        console.log(error.message);
    }
});

// Add drug to drug table
app.post("/drugs/addMed", checkNotAuthenticated, async (request, response) => {
    try {
        const { name, strength, cost, quantity } = request.body;
        console.log(request.body);
        const newMed = await pool.query(
            "INSERT INTO Drugs (drug_name, drug_strength, drug_cost, drug_quantity) VALUES ($1, $2, $3, $4) RETURNING *;",
            [name, strength, cost, quantity],
            (err, result) => {
                if (err) {
                    console.log(err.message);
                }
            }
        );
        response.render("updateMeds", {
            success: "Drug was added to the database.",
            error: "",
        });
        // response.json(newMed);
    } catch (error) {
        console.log(error.message);
    }
});

//delete the drugs from the table
app.post("/drugs/delete", checkNotAuthenticated, async (request, response) => {
    try {
        const { name, strength } = request.body;
        console.log(request.body);
        const deleteMed = await pool.query(
            "DELETE FROM DRUGS WHERE drug_name = $1 AND drug_strength = $2",
            [name, strength],
            (err, result) => {
                if (err) {
                    console.log(err.message);
                }
            }
        );
        response.render("updateMeds", {
            success: "Drug was deleted from the database.",
            error: "",
        });
    } catch (error) {
        console.log(error.message);
    }
});

//update the drug in the table
app.post("/drugs/update", checkNotAuthenticated, async (request, response) => {
    try {
        let { name, strength, quantity } = request.body;
        console.log(request.body);
        const deleteMed = await pool.query(
            "UPDATE DRUGS SET drug_quantity = $1 WHERE drug_name = $2 AND drug_strength = $3",
            [quantity, name, strength],
            (err, result) => {
                if (err) {
                    console.log(err.message);
                }
                console.log(result);

                //if drugs were found to update, return the success in updating, else return the failed action
                if (result.rowCount > 0) {
                    response.render("updateMeds", {
                        success: "Drug quantity was changed in the database.",
                        error: "",
                    });
                } else {
                    response.render("updateMeds", {
                        success: "",
                        error:
                            "Drug record to update was not found in the database!",
                    });
                }
            }
        );
    } catch (error) {
        console.log(error.message);
    }
});


app.get('/fulfill', checkNotAuthenticated, async (request, response) => {
    response.render('fulfill', { error: "", success: "" });
});


// add the medicine to the stock
app.post("/fulfill/prescription/:userID/:p_id/:med_id", checkNotAuthenticated, async (request, response) => {
    try {
        //get the required fields from the from body
        const { userID, p_id, med_id } = request.params;

        // Get prescription
        prescription = await pool.query(
            "SELECT drug_quantity, quantity, med_id, p_id, PB.id, drug_cost::money::numeric::float8 FROM prescribed_by AS P, drugs AS D, patient AS pt WHERE P.p_id = $1 AND P.med_id = $2 AND P.med_id = D.drug_id AND P.p_id = pt.id;",
            [p_id, med_id]
        );
        prescription = prescription.rows[0];
        console.log('Here is the prescription to be fulfilled:\n', prescription);

        // Get date for fulfilling prescription
        let currentDate = new Date();
        const psqlDate =
            currentDate.getFullYear() +
            "-" +
            String(currentDate.getMonth() + 1) +
            "-" +
            String(currentDate.getDate());

        try {
            if (prescription.drug_quantity == 0) {
                console.log("Medication not in stock.")
                response.render('prescriptions', { success: "", error: `Prescription cannot be fulfilled, ${prescription.medicineLabel} ${prescription.medicineStrength} not in stock.`, user: request.user })
            }
            else if (prescription.drug_quantity < prescription.quantity) {
                console.log("Prescription quantity more than current stock")
                // Insert in fulfilled by
                let insertFulfill = await pool.query(
                    "INSERT INTO fulfilled_by (med_id, pharmacist_id, patient_id, quantity_fulfilled, fulfilled_date) VALUES ($1, $2, $3, $4, $5) RETURNING *;",
                    [prescription.med_id, userID, prescription.p_id, prescription.drug_quantity, psqlDate]);
                console.log("Inserted into fulfulled by:\n", insertFulfill);
                // Update prescription quantity

                let updatePrescription = await pool.query(
                    "UPDATE prescribed_by SET quantity = $1 WHERE med_id = $2 AND id = $3 AND p_id = $4 RETURNING *;",
                    [prescription.quantity - prescription.drug_quantity, prescription.med_id, prescription.id, prescription.p_id])
                console.log("Updated prescribed by:\n", updatePrescription);

                //delete drug to 0
                let updateMed = await pool.query(
                    "UPDATE DRUGS SET drug_quantity = 0 WHERE drug_name = $1 AND drug_strength = $2 RETURNING *;",
                    [prescription.drug_name, prescription.drug_strength],
                );
                console.log('Updated meds:\n', updateMed);

                response.render('prescriptions', {
                    success: `Prescribed ${prescription.drug_quantity} unit(s). Total cost: $ ${prescription.drug_quantity * prescription.drug_cost}. Patient has ${prescription.quantity - prescription.drug_quantity} unit(s) remaining in prescription`,
                    error: "",
                    user: request.user
                });
            }
            else {
                console.log("Enough stock available.")

                // add amount to fulfilled by
                const insertFulfill = await pool.query("INSERT INTO fulfilled_by (med_id, pharmacist_id, patient_id, quantity_fulfilled, fulfilled_date) VALUES ($1, $2, $3, $4, $5) RETURNING *;",
                    [prescription.med_id, userID, prescription.p_id, prescription.quantity, psqlDate])
                console.log("Inserted into fulfulled by:\n", insertFulfill);

                //Delete prescription
                const deletePrescription = await pool.query(
                    "DELETE FROM prescribed_by WHERE med_id = $1 AND id = $2 AND p_id = $3;",
                    [prescription.med_id, prescription.id, prescription.p_id])
                console.log("Updated prescribed by:\n", deletePrescription);

                // update medicine from drugs
                const updateMed = await pool.query(
                    "UPDATE DRUGS SET drug_quantity = $1 WHERE drug_name = $2 AND drug_strength = $3 RETURNING *;",
                    [prescription.drug_quantity - prescription.quantity, prescription.drug_name, prescription.drug_strength],
                )
                console.log('Updated meds:\n', updateMed);

                response.render('prescriptions',
                    {
                        success: `Prescribed ${prescription.quantity} unit(s). Total cost:$ ${prescription.quantity * prescription.drug_cost}`,
                        error: "",
                        user: request.user
                    })
            }
        }
        catch (err) {
            console.error(err.message);
        }
    }
    catch (err) {
        console.error(err.message);
    }
});

//CREATE a new todo - create a new doctor from the form request.
// app.post("/todos", async (request, response) => {
//     try {
//         const { id, name, phone_number, email, password } = request.body;
//         console.log(request.body);
//         const newDoc = await pool.query(
//             "INSERT INTO Doctor (id, name, phone_number, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING *;",
//             [id, name, phone_number, email, password],
//             (err, result) => {
//                 if (err) {
//                     console.log(err.message);
//                 }
//             }
//         );
//         response.json(newDoc);
//     } catch (error) {
//         console.log(error.message);
//     }
// });

//Example of get request
// app.get("/doctor", async (request, response) => {
//     try {
//         const allDocs = await pool.query("SELECT * FROM DOCTOR");
//         response.json(allDocs.rows);
//     } catch (error) {
//         console.log(error.message);
//     }
// });

// app.get("/todos/:id", async (request, response) => {
//     try {
//         const { id } = request.params;
//         const todo = await pool.query(
//             "SELECT description FROM todo WHERE todo_id=$1",
//             [id]
//         );

//         response.json(todo.rows[0]);
//     } catch (error) {
//         console.error(error.message);
//     }
// });

//UPDATE the todo by id

// app.put("/todos/:id", async (request, response) => {
//     try {
//         const { id } = request.params; //WHERE
//         const { description } = request.body; //WHAT TO SET
//         const updateToDo = await pool.query(
//             "UPDATE todo SET description = $1 WHERE todo_id = $2",
//             [description, id]
//         );
//         response.json(`Todo with id ${id} was updated!`);
//     } catch (error) {
//         console.error(error.message);
//     }
// });

//DELETE the todo by id
// app.delete("/todos/:id", async (request, response) => {
//     try {
//         const { id } = request.params; //WHERE

//         const deleteTodo = await pool.query(
//             "DELETE FROM todo WHERE todo_id = $1",
//             [id]
//         );
//         response.json(`Todo with id ${id} was deleted!`);
//     } catch (error) {
//         console.error(error.message);
//     }
// });

// Helper functions for authentication
function checkAuthenticated(request, response, next) {
    if (request.isAuthenticated()) {
        return response.redirect("/users/dashboard");
    }
    next();
}

function checkNotAuthenticated(request, response, next) {
    if (request.isAuthenticated()) {
        return next();
    }

    response.redirect("/users/login");
}
// start the server
app.listen(port, () => {
    console.log(`LISTENING ON PORT ${port}!`);
});

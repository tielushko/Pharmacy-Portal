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
//to handle json data of req.body
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
        const docID = request.session.passport.user;
        console.log(docID);
        //ISSUE: DOES NOT RETURN DRUG NAME AND NAME OF PATIENT
        // const results = await pool.query(
        //     "SELECT * FROM prescribed_by as PB, patient as P, drugs as D WHERE PB.p_id=P.id AND PB.med_id=D.drug_id AND PB.id=$1",
        //     [doctorID]
        // );

        // const prescriptionList = results.rows;
        // console.log(prescriptionList);

        response.render("prescriptions", {
            docID,
            error: "",
            success: "",
        });
    } catch (error) {
        console.error(error);
    }
});

app.get("/prescriptions/search", checkNotAuthenticated, async (req, res) => {
    try {
        const { patientName, patientEmail } = req.query;
        const docID = req.session.passport.user;
        console.log(docID, patientName, patientEmail);

        const patientsQuery = await pool.query(
            "SELECT * FROM prescribed_by as PB, patient as P, drugs as D WHERE PB.p_id=P.id AND PB.med_id=D.drug_id AND PB.id=$1 AND P.name=$2 AND P.email=$3",
            [docID, patientName, patientEmail],
            (err, result) => {
                if (err) {
                    console.error(err.message);
                } else {
                    const foundPrescriptions = result.rows;
                    console.log(foundPrescriptions);

                    if (foundPrescriptions.length > 0) {
                        res.render("prescriptions.ejs", {
                            docID,
                            foundPrescriptions,
                            success: `Here is a list of your prescriptions for patient ${patientName}!`,
                            error: "",
                        });
                    } else {
                        res.render("prescriptions.ejs", {
                            docID,
                            foundPrescriptions,
                            success: "",
                            error: `Sorry, you don't have any prescriptions for ${patientName}!`,
                        });
                    }
                }
            }
        );
    } catch (error) {
        console.error(error.message);
    }
});

//delete a particular prescription.
app.post(
    "/prescriptions/delete/:docID/:patientID/:medicineID",
    checkNotAuthenticated,
    async (req, res) => {
        const { docID, patientID, medicineID } = req.params;
        console.log(docID, patientID, medicineID);

        const deletePrescription = await pool.query(
            "DELETE FROM prescribed_by WHERE id=$1 AND p_id=$2 AND med_id=$3",
            [docID, patientID, medicineID],
            (err, result) => {
                if (err) {
                    console.log(err.message);
                } else {
                    if (result.rowCount > 0) {
                        res.render("prescriptions", {
                            docID,
                            success:
                                "The prescription was successfully deleted",
                            error: "",
                        });
                    } else {
                        res.render("prescriptions", {
                            docID,
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
app.get("/prescriptions/issue", checkNotAuthenticated, (req, res) => {
    console.log(req.session.passport);
    res.render("issuePrescription");
});

// add the medicine to the stock
app.post("/prescriptions/issue", checkNotAuthenticated, async (req, res) => {
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
        } = req.body;
        const docID = req.session.passport.user;
        let patientID;
        let medicineID;

        console.log(req.body, docID);

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
                                currentDate.getMonth() +
                                "-" +
                                currentDate.getDay();
                            const addPrescriptionToDB = await pool.query(
                                "INSERT INTO prescribed_by (med_id, id, p_id, quantity, dosage, prescription_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
                                [
                                    medicineID,
                                    docID,
                                    patientID,
                                    medicineQuantity,
                                    medicineDosage,
                                    psqlDate,
                                ],
                                (err, result) => {
                                    if (err) {
                                        console.error(err.message);
                                    } else {
                                        res.render("prescriptions", {
                                            docID,
                                            success:
                                                "Your prescription was added to the database",
                                            error: "",
                                        });
                                    }
                                }
                            );

                            // medicine is not found, we cannot assign the prescription.
                        } else {
                            res.render("prescriptions", {
                                docID,
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
app.get("/drugs", checkNotAuthenticated, (req, res) => {
    console.log(req.session.passport);
    res.render("updateMeds", { success: "", error: "" });
});

// Search drugs in the table
app.get("/drugs/search", checkNotAuthenticated, async (req, res) => {
    try {
        const { name, strength } = req.query;
        console.log(name, strength);
        const drugsQuery = await pool.query(
            "SELECT * FROM Drugs AS D WHERE D.drug_name = $1 AND D.drug_strength = $2;",
            [name, strength]
        );
        const foundDrugsList = drugsQuery.rows;
        console.log(foundDrugsList);

        if (foundDrugsList.length > 0) {
            res.render("updateMeds.ejs", {
                foundDrugsList,
                success: "Here are the drugs that match your query",
                error: "",
            });
        } else {
            res.render("updateMeds.ejs", {
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
app.post("/drugs/addMed", checkNotAuthenticated, async (req, res) => {
    try {
        const { name, strength, cost, quantity } = req.body;
        console.log(req.body);
        const newMed = await pool.query(
            "INSERT INTO Drugs (drug_name, drug_strength, drug_cost, drug_quantity) VALUES ($1, $2, $3, $4) RETURNING *;",
            [name, strength, cost, quantity],
            (err, result) => {
                if (err) {
                    console.log(err.message);
                }
            }
        );
        res.render("updateMeds", {
            success: "Drug was added to the database.",
            error: "",
        });
        // res.json(newMed);
    } catch (error) {
        console.log(error.message);
    }
});

//delete the drugs from the table
app.post("/drugs/delete", checkNotAuthenticated, async (req, res) => {
    try {
        const { name, strength } = req.body;
        console.log(req.body);
        const deleteMed = await pool.query(
            "DELETE FROM DRUGS WHERE drug_name = $1 AND drug_strength = $2",
            [name, strength],
            (err, result) => {
                if (err) {
                    console.log(err.message);
                }
            }
        );
        res.render("updateMeds", {
            success: "Drug was deleted from the database.",
            error: "",
        });
    } catch (error) {
        console.log(error.message);
    }
});

//update the drug in the table
app.post("/drugs/update", checkNotAuthenticated, async (req, res) => {
    try {
        let { name, strength, quantity } = req.body;
        console.log(req.body);
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
                    res.render("updateMeds", {
                        success: "Drug quantity was changed in the database.",
                        error: "",
                    });
                } else {
                    res.render("updateMeds", {
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

//CREATE a new todo - create a new doctor from the form request.
// app.post("/todos", async (request, response) => {
//     try {
//         const { id, name, phone_number, email, password } = req.body;
//         console.log(req.body);
//         const newDoc = await pool.query(
//             "INSERT INTO Doctor (id, name, phone_number, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING *;",
//             [id, name, phone_number, email, password],
//             (err, result) => {
//                 if (err) {
//                     console.log(err.message);
//                 }
//             }
//         );
//         res.json(newDoc);
//     } catch (error) {
//         console.log(error.message);
//     }
// });

//Example of get request
// app.get("/doctor", async (req, res) => {
//     try {
//         const allDocs = await pool.query("SELECT * FROM DOCTOR");
//         res.json(allDocs.rows);
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

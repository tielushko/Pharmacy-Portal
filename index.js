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
initializePassport(passport);
//local port for the server
const port = process.env.PORT || 8000;

//create express app
const app = express();

//set the default path for templates to views, then we can work with what's inside of it.
app.set("views", path.join(__dirname, "/views"));

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
        const doctorID = request.session.passport.user;
        console.log(doctorID);
        //ISSUE: DOES NOT RETURN DRUG NAME AND NAME OF PATIENT
        const results = await pool.query(
            "SELECT * FROM prescribed_by as PB, patient as P, drugs as D WHERE PB.p_id=P.id AND PB.med_id=D.drug_id AND PB.id=$1",
            [doctorID]
        );

        const prescriptionList = results.rows;
        console.log(prescriptionList);

        response.render("prescriptions", { prescriptionList });
    } catch (error) {
        console.error(error);
    }
});
app.get("/prescriptions/issue", checkNotAuthenticated, (request, response) => {
    console.log(request.session.passport);
    response.render("issuePrescription");
});

app.post(
    "/prescriptions/issue",
    checkNotAuthenticated,
    (request, response) => {}
);

// Pulls up Drug CRUD
app.get("/drugs", checkNotAuthenticated, (request, response) => {
    console.log(request.session.passport);
    response.render("updateMeds", { success: "" });
});

// Add drug to drug table
app.post("/drugs/addMed", async (req, res) => {
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
        });
        // res.json(newMed);
    } catch (error) {
        console.log(error.message);
    }
});

app.post("/drugs/delete", async (req, res) => {
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
        });
        // res.json(deleteMed);
    } catch (error) {
        console.log(error.message);
    }
});

app.post("/drugs/update", async (req, res) => {
    try {
        const { name, strength, quantity } = req.body;
        console.log(req.body);
        const deleteMed = await pool.query(
            "UPDATE DRUGS SET drug_quantity = $1 WHERE drug_name = $2 AND drug_strength = $3",
            [quantity, name, strength],
            (err, result) => {
                if (err) {
                    console.log(err.message);
                }
            }
        );
        res.render("updateMeds", {
            success: "Drug quantity was changed in the database.",
        });
        // res.json(deleteMed);
    } catch (error) {
        console.log(error.message);
    }
});

app.get("/drugs/search", async (req, res) => {
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
            });
        } else {
            res.render("updateMeds.ejs", {
                success:
                    "Sorry. The drug you are trying to search for does not exist in our database",
            });
        }
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

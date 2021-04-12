const express = require("express");
const path = require("path");
const methodOverride = require("method-override");

const pool = require("./db");
const { response } = require("express");
//local port for the server
const port = 8000;

//create express app
const app = express();

//set the default path for templates to views, then we can work with what's inside of it.
app.set("views", path.join(__dirname, "/views"));

//set templates view engine to be of ejs extension
app.set("view engine", "ejs");

//to be able to parse the POST form information from the body - may not need later
app.use(express.urlencoded({ extended: true }));
//to handle json data of req.body
app.use(express.json());
//method override to provide the methods outside of get and post in the form
app.use(methodOverride("_method"));

/*
 ROUTES
*/
// Example of post request
app.post("/doctor", async(req, res)=>{
    try {
        const {id, name, phone_number, email, password} = req.body;
        console.log(req.body);
        const newDoc = await pool.query("INSERT INTO Doctor (id, name, phone_number, email, password) VALUES ($1, $2, $3, $4, $5) RETURNING *;", [id, name, phone_number, email, password], (err, result)=>{
            if(err){
                console.log(err.message);
            }
        });
        res.json(newDoc);
    } catch (error) {
        console.log(error.message);
        
    }
})

//Example of get request
app.get("/doctor", async (req, res) => {
    try {
        const allDocs = await pool.query("SELECT * FROM DOCTOR");
        res.json(allDocs.rows);
    } catch (error) {
        console.log(error.message);
    }
})


// handling home request - renders basic home ejs page that can be found in views folder.
app.get("/", (request, response) => {
    response.render("home.ejs");
});

app.post("/register", (request, response) => {});
app.get("/login", (request, response) => {});


// start the server
app.listen(port, () => {
    console.log(`LISTENING ON PORT ${port}!`);
});

const express = require("express");
const path = require("path");
const methodOverride = require("method-override");
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
//to handle json data
app.use(express.json());
//method override to provide the methods outside of get and post in the form
app.use(methodOverride("_method"));

//handling home request - renders basic home ejs page that can be found in views folder.
app.get("/", (request, response) => {
    response.render("home.ejs");
});

app.get("/login", (request, response) => {});

// start the server
app.listen(port, () => {
    console.log(`LISTENING ON PORT ${port}!`);
});

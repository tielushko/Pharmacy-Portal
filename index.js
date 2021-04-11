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
//handling home request - renders basic home ejs page that can be found in views folder.
app.get("/", (request, response) => {
    response.render("home.ejs");
});

app.post("/register", (request, response) => {});
app.get("/login", (request, response) => {});

//CREATE a new todo - create a new doctor from the form request.
app.post("/todos", async (request, response) => {
    try {
        const { description } = request.body;
        const newToDo = await pool.query(
            "INSERT INTO todo (description) VALUES ($1) RETURNING *",
            [description]
        );
        response.json(newToDo.rows[0]);
    } catch (error) {
        console.error(error.message);
    }
});

//READ all todos from the server
app.get("/todos", async (request, response) => {
    try {
        const allTodos = await pool.query("SELECT * FROM todo");
        response.json(allTodos.rows);
    } catch (error) {
        console.error(error.message);
    }
});

//READ a todo by ID from the server

app.get("/todos/:id", async (request, response) => {
    try {
        const { id } = request.params;
        const todo = await pool.query("SELECT * FROM todo WHERE todo_id=$1", [
            id,
        ]);

        response.json(todo.rows[0]);
    } catch (error) {
        console.error(error.message);
    }
});
// start the server
app.listen(port, () => {
    console.log(`LISTENING ON PORT ${port}!`);
});

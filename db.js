const Pool = require("pg").Pool;

//edit this object to change the database credentials -Oleg
const pool = new Pool({
    user: "postgres",
    password: "Admin",
    database: "todo_database",
    host: "localhost",
    port: 5432,
});

module.exports = pool;

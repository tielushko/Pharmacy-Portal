var conString = "postgres://yxqdwbpo:2cUEB5BjPRZZiVfPCZ0oflM4vecURGwW@queenie.db.elephantsql.com:5432/yxqdwbpo" //Can be found in the Details page
const {Pool} = require("pg");

const pool = new Pool({
    user: "yxqdwbpo",
    password: "2cUEB5BjPRZZiVfPCZ0oflM4vecURGwW",
    database: "portal-db",
    host: "http://queenie.db.elephantsql.com/",
    port: 5432,
    connectionString: conString
})

module.exports = pool

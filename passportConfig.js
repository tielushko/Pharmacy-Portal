const LocalStrategy = require("passport-local").Strategy;

const pool = require("./db");
const bcrypt = require("bcrypt");

function initialize(passport) {
    const authenticateUser = (email, password, done) => {
        pool.query(
            "SELECT * FROM users WHERE email=$1",
            [email],
            (error, results) => {
                if (error) {
                    throw error;
                } else {
                    console.log(results.rows);

                    //user is found in db
                    if (results.rows.length > 0) {
                        const user = results.rows[0];
                        bcrypt.compare(
                            password,
                            user.password,
                            (error, isMatch) => {
                                if (error) {
                                    throw error;
                                }

                                if (isMatch) {
                                    return done(null, user); //returns user and stores in cookie object
                                } else {
                                    return done(null, false, {
                                        message: "Password is not correct",
                                    }); // in case of incorrect password
                                }
                            }
                        );
                        // if there are no users with email found
                    } else {
                        return done(null, false, {
                            message: "User with this email is not registered",
                        });
                    }
                }
            }
        );
    };

    passport.use(
        new LocalStrategy(
            { usernameField: "email", passwordField: "password" },
            authenticateUser
        )
    );

    passport.serializeUser((user, done) => done(null, user.id));

    passport.deserializeUser((id, done) => {
        pool.query(
            "SELECT * FROM users WHERE id=$1",
            [id],
            (error, results) => {
                if (error) {
                    throw error;
                }
                return done(null, results.rows[0]);
            }
        );
    });
}

module.exports = initialize;

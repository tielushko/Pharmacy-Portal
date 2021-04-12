CREATE DATABASE portal_db;

-- query for password table for the users.
CREATE TYPE user_category AS ENUM ('doctor', 'pharmacist');

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY NOT NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL,
    password VARCHAR(200) NOT NULL,
    usr_type user_category NOT NULL,
    UNIQUE(email)--can only be either doctor or pharmacist see above the enum
);
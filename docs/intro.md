# JavaScript In-Memory Database

## Relational Database

Inspired by the [Mongoose](mongoosejs.com) api

[`jsimdb.relational()`](module-relational.html) returns an object that provides an api for inserting, removing, altering, and searching entries.
This object maintains a list of tables, with each table having its own [Schema](tutorial-schemas.html).
The information contained in the schema is used to ensure that before any data is added to the table, it satisfies the requirements.
const db = require('./database');
db.all('SELECT * FROM Aplicacion', (err, rows) => {
    console.log(rows);
    db.close();
});

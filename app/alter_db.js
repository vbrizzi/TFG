const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, 'nfr_framework.db'));

db.serialize(() => {
    try {
        db.run('ALTER TABLE Aplicacion ADD COLUMN url_objetivo TEXT');
        db.run('ALTER TABLE Aplicacion ADD COLUMN descripcion TEXT');
        console.log('Columnas agregadas a Aplicacion');
    } catch (e) {
        console.log('Error o las columnas ya existen', e.message);
    }
});
db.close();

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'nfr_framework.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        // Initialize tables
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS Aplicacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                repositorio TEXT NOT NULL,
                url_objetivo TEXT,
                fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS Configuracion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                clave TEXT UNIQUE NOT NULL,
                valor TEXT NOT NULL
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS Evaluacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_aplicacion INTEGER NOT NULL,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                puntaje_seguridad REAL,
                puntaje_calidad REAL,
                puntaje_performance REAL,
                indice_general REAL,
                detalles JSON,
                FOREIGN KEY (id_aplicacion) REFERENCES Aplicacion(id)
            )`);

            console.log('Tables initialized');
        });
    }
});

module.exports = db;

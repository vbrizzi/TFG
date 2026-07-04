// Script para actualizar el hash del usuario admin en la BD
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.resolve(__dirname, 'nfr_framework.db');
const db = new sqlite3.Database(dbPath);

const hash = '$2b$10$MixJTd6nlr8ygljDcDDju.XDFV23rfivdzwGRNidKn2uZZLGC/H4W';

db.serialize(() => {
    // Crear tabla si no existe
    db.run(`CREATE TABLE IF NOT EXISTS Usuario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        nombre_completo TEXT,
        rol TEXT NOT NULL DEFAULT 'admin',
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Borrar y reinsertar usuario admin con hash correcto
    db.run(`DELETE FROM Usuario WHERE username = 'admin'`);
    db.run(
        `INSERT INTO Usuario (username, password_hash, nombre_completo, rol) VALUES (?, ?, ?, ?)`,
        ['admin', hash, 'Administrador', 'admin'],
        (err) => {
            if (err) console.error('Error:', err.message);
            else console.log('Usuario admin creado con hash correcto.');
            db.close();
        }
    );
});

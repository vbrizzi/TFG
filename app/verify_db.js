const db = require('./database');
setTimeout(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (e, r) => {
        console.log('Tablas:', r.map(t => t.name).join(', '));
        db.all("SELECT * FROM Herramienta", (e2, r2) => {
            console.log('Herramientas:', JSON.stringify(r2, null, 2));
            process.exit(0);
        });
    });
}, 1000);

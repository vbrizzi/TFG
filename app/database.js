const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'nfr_framework.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        db.run('PRAGMA foreign_keys = ON');

        // Initialize tables
        db.serialize(() => {

            // ========== APLICACION ==========
            // Entidad principal: representa una aplicación de software registrada para evaluación.
            db.run(`CREATE TABLE IF NOT EXISTS Aplicacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                repositorio TEXT,
                url_objetivo TEXT,
                fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // ========== HERRAMIENTA ==========
            // Catálogo de herramientas externas integradas al framework.
            // Enum TipoHerramienta: ANALISIS_ESTATICO | SEGURIDAD | RENDIMIENTO
            db.run(`CREATE TABLE IF NOT EXISTS Herramienta (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                tipo TEXT NOT NULL,
                version TEXT,
                configuracion_default TEXT
            )`);

            // ========== CONFIGURACION_EVALUACION ==========
            // Almacena la configuración definida por el usuario antes de ejecutar una evaluación.
            // Corresponde a CU-02 (Configurar evaluación) y RF02, RF03, RF04.
            db.run(`CREATE TABLE IF NOT EXISTS ConfiguracionEvaluacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_aplicacion INTEGER NOT NULL,
                categorias TEXT NOT NULL,
                parametros TEXT,
                herramientas TEXT NOT NULL,
                fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_aplicacion) REFERENCES Aplicacion(id)
            )`);

            // ========== EVALUACION ==========
            // Registro de cada ejecución de evaluación. Incluye el campo 'estado'
            // requerido por RF10: PENDIENTE | EN_PROCESO | FINALIZADA | ERROR
            db.run(`CREATE TABLE IF NOT EXISTS Evaluacion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_aplicacion INTEGER NOT NULL,
                id_configuracion INTEGER,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                estado TEXT NOT NULL DEFAULT 'PENDIENTE',
                FOREIGN KEY (id_aplicacion) REFERENCES Aplicacion(id),
                FOREIGN KEY (id_configuracion) REFERENCES ConfiguracionEvaluacion(id)
            )`);

            // ========== RESULTADO ==========
            // Un registro por cada herramienta ejecutada dentro de una evaluación.
            // Almacena los datos crudos (JSON) devueltos por la herramienta.
            db.run(`CREATE TABLE IF NOT EXISTS Resultado (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_evaluacion INTEGER NOT NULL,
                categoria TEXT NOT NULL,
                herramienta_utilizada TEXT NOT NULL,
                datos TEXT,
                fecha_procesamiento DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (id_evaluacion) REFERENCES Evaluacion(id)
            )`);

            // ========== SCORE ==========
            // Puntajes normalizados (0-100) calculados por el motor de scoring.
            // Separado de Evaluacion para respetar el diagrama de clases.
            db.run(`CREATE TABLE IF NOT EXISTS Score (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_evaluacion INTEGER NOT NULL UNIQUE,
                puntaje_global REAL,
                puntaje_mantenibilidad REAL,
                puntaje_seguridad REAL,
                puntaje_rendimiento REAL,
                FOREIGN KEY (id_evaluacion) REFERENCES Evaluacion(id)
            )`);

            // ========== HALLAZGO ==========
            // Cada alerta, vulnerabilidad o issue individual detectado por una herramienta.
            // Enum SeveridadHallazgo: ALTO | MEDIO | BAJO | INFO
            // Enum CategoriaCalidad: MANTENIBILIDAD | SEGURIDAD | RENDIMIENTO
            db.run(`CREATE TABLE IF NOT EXISTS Hallazgo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_resultado INTEGER NOT NULL,
                severidad TEXT NOT NULL,
                categoria_calidad TEXT NOT NULL,
                descripcion TEXT NOT NULL,
                recomendacion TEXT,
                FOREIGN KEY (id_resultado) REFERENCES Resultado(id)
            )`);

            // ========== METRICA ==========
            // Cada métrica individual obtenida y normalizada.
            db.run(`CREATE TABLE IF NOT EXISTS Metrica (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_evaluacion INTEGER NOT NULL,
                nombre TEXT NOT NULL,
                valor REAL,
                valor_normalizado REAL,
                unidad TEXT,
                categoria TEXT NOT NULL,
                FOREIGN KEY (id_evaluacion) REFERENCES Evaluacion(id)
            )`);

            // ========== REPORTE ==========
            // Registro de reportes generados.
            // Enum FormatoReporte: PDF | HTML | JSON
            db.run(`CREATE TABLE IF NOT EXISTS Reporte (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                id_evaluacion INTEGER NOT NULL,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                formato TEXT NOT NULL DEFAULT 'PDF',
                ruta_archivo TEXT,
                FOREIGN KEY (id_evaluacion) REFERENCES Evaluacion(id)
            )`);

            // ========== SEED: Herramientas ==========
            db.run(`INSERT OR IGNORE INTO Herramienta (id, nombre, tipo, version, configuracion_default) VALUES
                (1, 'SonarQube', 'ANALISIS_ESTATICO', '10.x', '{"qualityGate": "default"}'),
                (2, 'OWASP ZAP', 'SEGURIDAD', '2.15', '{"scanType": "baseline"}'),
                (3, 'k6', 'RENDIMIENTO', '0.49', '{"vus": 10, "duration": "10s"}')`);

            console.log('All tables initialized (diagram-aligned schema).');
        });
    }
});

module.exports = db;

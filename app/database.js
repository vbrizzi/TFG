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
                progreso TEXT DEFAULT '{}',
                FOREIGN KEY (id_aplicacion) REFERENCES Aplicacion(id),
                FOREIGN KEY (id_configuracion) REFERENCES ConfiguracionEvaluacion(id)
            )`);
            // Migración: agregar columna progreso si no existe
            db.run(`ALTER TABLE Evaluacion ADD COLUMN progreso TEXT DEFAULT '{}'`, () => {});


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

            // ========== USUARIO ==========
            // Tabla de usuarios del sistema para autenticación.
            db.run(`CREATE TABLE IF NOT EXISTS Usuario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                nombre_completo TEXT,
                rol TEXT NOT NULL DEFAULT 'admin',
                fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (!err) {
                    // Seed: usuario admin por defecto (password: nfr2026)
                    const defaultHash = '$2b$10$MixJTd6nlr8ygljDcDDju.XDFV23rfivdzwGRNidKn2uZZLGC/H4W';
                    db.run(
                        `INSERT OR IGNORE INTO Usuario (username, password_hash, nombre_completo, rol) VALUES (?, ?, ?, ?)`,
                        ['admin', defaultHash, 'Administrador', 'admin'],
                        () => {}
                    );
                }
            });

            // ========== SEED: Herramientas ==========
            db.run(`INSERT OR IGNORE INTO Herramienta (id, nombre, tipo, version, configuracion_default) VALUES
                (1, 'SonarQube', 'ANALISIS_ESTATICO', '10.x', '{"qualityGate": "default"}'),
                (2, 'OWASP ZAP', 'SEGURIDAD', '2.15', '{"scanType": "baseline"}'),
                (3, 'k6', 'RENDIMIENTO', '0.49', '{"vus": 10, "duration": "10s"}')`);

            // ========== SEED: Aplicación Demo ==========
            db.run(`INSERT OR IGNORE INTO Aplicacion (id, nombre, descripcion, repositorio, url_objetivo) VALUES
                (99, 'App Demo TFG', 'Aplicación vulnerable de prueba para demostración del framework', 'https://github.com/vbrizzi/TFG.git', 'http://host.docker.internal:3000')`, (err) => {
                
                // Si no hubo error insertando la app, vamos a sembrar el historial falso para la demo
                if (!err) {
                    db.serialize(() => {
                        const evaluaciones = [
                            { id: 101, dias: -25, estado: 'FINALIZADA', mant: 30, seg: 20, perf: 45, global: 32 },
                            { id: 102, dias: -20, estado: 'FINALIZADA', mant: 42, seg: 30, perf: 50, global: 41 },
                            { id: 103, dias: -15, estado: 'FINALIZADA', mant: 50, seg: 38, perf: 55, global: 48 },
                            { id: 104, dias: -10, estado: 'FINALIZADA', mant: 58, seg: 45, perf: 62, global: 55 },
                            { id: 105, dias: -7,  estado: 'FINALIZADA', mant: 62, seg: 50, perf: 68, global: 60 },
                            { id: 106, dias: -4,  estado: 'FINALIZADA', mant: 65, seg: 55, perf: 72, global: 64 },
                            { id: 107, dias: -1,  estado: 'FINALIZADA', mant: 68, seg: 58, perf: 75, global: 67 },
                        ];

                        evaluaciones.forEach(ev => {
                            db.run(`INSERT OR IGNORE INTO Evaluacion (id, id_aplicacion, fecha, estado, progreso) VALUES (?, 99, datetime('now', ? || ' days'), ?, '{"sonar":"done","zap":"done","k6":"done"}')`, [ev.id, ev.dias, ev.estado]);
                            db.run(`INSERT OR IGNORE INTO Score (id_evaluacion, puntaje_global, puntaje_mantenibilidad, puntaje_seguridad, puntaje_rendimiento) VALUES (?, ?, ?, ?, ?)`, [ev.id, ev.global, ev.mant, ev.seg, ev.perf]);
                            
                            // Resultados vacíos para enlazar hallazgos
                            db.run(`INSERT OR IGNORE INTO Resultado (id_evaluacion, categoria, herramienta_utilizada, datos) VALUES (?, 'MANTENIBILIDAD', 'SonarQube', '{}')`, [ev.id]);
                            db.run(`INSERT OR IGNORE INTO Resultado (id_evaluacion, categoria, herramienta_utilizada, datos) VALUES (?, 'SEGURIDAD', 'OWASP ZAP', '{}')`, [ev.id]);
                            db.run(`INSERT OR IGNORE INTO Resultado (id_evaluacion, categoria, herramienta_utilizada, datos) VALUES (?, 'RENDIMIENTO', 'k6', '{}')`, [ev.id]);
                        });

                        // Metricas falsas para la última (107)
                        const metricas = [
                            { evalId: 107, nombre: 'Complejidad Ciclomática', valor: 8, valorNorm: 85, unidad: '', categoria: 'MANTENIBILIDAD' },
                            { evalId: 107, nombre: 'Duplicación de Código',   valor: 3.2, valorNorm: 80, unidad: '%', categoria: 'MANTENIBILIDAD' },
                            { evalId: 107, nombre: 'Vulnerabilidades Altas',  valor: 2,   valorNorm: 40, unidad: '', categoria: 'SEGURIDAD' },
                            { evalId: 107, nombre: 'Tiempo respuesta p95',    valor: 420, valorNorm: 80, unidad: 'ms', categoria: 'RENDIMIENTO' }
                        ];
                        metricas.forEach(m => {
                            db.run(`INSERT OR IGNORE INTO Metrica (id_evaluacion, nombre, valor, valor_normalizado, unidad, categoria) VALUES (?, ?, ?, ?, ?, ?)`, [m.evalId, m.nombre, m.valor, m.valorNorm, m.unidad, m.categoria]);
                        });

                        // Hallazgos falsos
                        setTimeout(() => {
                            db.get(`SELECT id FROM Resultado WHERE id_evaluacion = 107 AND herramienta_utilizada = 'SonarQube'`, (err, rS) => {
                                db.get(`SELECT id FROM Resultado WHERE id_evaluacion = 107 AND herramienta_utilizada = 'OWASP ZAP'`, (err, rZ) => {
                                    if (rS) {
                                        db.run(`INSERT INTO Hallazgo (id_resultado, severidad, categoria_calidad, descripcion, recomendacion) VALUES (?, 'MEDIO', 'MANTENIBILIDAD', 'Complejidad ciclomática alta en módulo de auth.', 'Refactorizar en funciones más pequeñas.')`, [rS.id]);
                                        db.run(`INSERT INTO Hallazgo (id_resultado, severidad, categoria_calidad, descripcion, recomendacion) VALUES (?, 'BAJO', 'MANTENIBILIDAD', 'Variables no utilizadas detectadas.', 'Limpiar código muerto.')`, [rS.id]);
                                    }
                                    if (rZ) {
                                        db.run(`INSERT INTO Hallazgo (id_resultado, severidad, categoria_calidad, descripcion, recomendacion) VALUES (?, 'ALTO', 'SEGURIDAD', 'Falta de cabecera Content-Security-Policy (CSP).', 'Implementar middleware Helmet o similar.')`, [rZ.id]);
                                        db.run(`INSERT INTO Hallazgo (id_resultado, severidad, categoria_calidad, descripcion, recomendacion) VALUES (?, 'MEDIO', 'SEGURIDAD', 'Cookie sin flag HttpOnly.', 'Ajustar configuración de cookies en el servidor.')`, [rZ.id]);
                                    }
                                });
                            });
                        }, 1000);
                    });
                }
            });

            console.log('All tables initialized (diagram-aligned schema).');
        });
    }
});

module.exports = db;

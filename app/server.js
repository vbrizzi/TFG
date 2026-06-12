const express = require('express');
const cors = require('cors');
const db = require('./database');

const sonarService = require('./services/sonarService');
const zapService = require('./services/zapService');
const k6Service = require('./services/k6Service');
const evaluator = require('./services/evaluator');
const pdfService = require('./services/pdfService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ========== HEALTH ==========
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'NFR Framework Orchestrator is running' });
});

// ========== APLICACIONES (RF01) ==========

// Registrar aplicación
app.post('/api/aplicaciones', (req, res) => {
    const { nombre, descripcion, url_objetivo, repositorio } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    db.run(
        `INSERT INTO Aplicacion (nombre, descripcion, url_objetivo, repositorio) VALUES (?, ?, ?, ?)`,
        [nombre, descripcion || null, url_objetivo || null, repositorio || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, nombre, descripcion, url_objetivo, repositorio });
        }
    );
});

// Listar aplicaciones
app.get('/api/aplicaciones', (req, res) => {
    db.all(`SELECT * FROM Aplicacion ORDER BY fecha_registro DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ========== HERRAMIENTAS ==========

app.get('/api/herramientas', (req, res) => {
    db.all(`SELECT * FROM Herramienta`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// ========== CONFIGURACION DE EVALUACION (RF02, RF03, RF04) ==========

// Guardar configuración
app.post('/api/configuraciones', (req, res) => {
    const { id_aplicacion, categorias, parametros, herramientas } = req.body;
    if (!id_aplicacion || !categorias || !herramientas) {
        return res.status(400).json({ error: 'Faltan campos obligatorios (id_aplicacion, categorias, herramientas).' });
    }

    db.run(
        `INSERT INTO ConfiguracionEvaluacion (id_aplicacion, categorias, parametros, herramientas) VALUES (?, ?, ?, ?)`,
        [
            id_aplicacion,
            JSON.stringify(categorias),
            JSON.stringify(parametros || {}),
            JSON.stringify(herramientas)
        ],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, message: 'Configuración guardada.' });
        }
    );
});

// Obtener configuraciones de una app
app.get('/api/configuraciones/:id_app', (req, res) => {
    db.all(
        `SELECT * FROM ConfiguracionEvaluacion WHERE id_aplicacion = ? ORDER BY fecha_creacion DESC`,
        [req.params.id_app],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// ========== EVALUACION (RF05, RF06, RF07, RF08, RF09, RF10) ==========

// Ejecutar evaluación completa
app.post('/api/evaluar', async (req, res) => {
    const { id_aplicacion, id_configuracion, repositoryUrl, targetUrl, projectName, runSonar, runZap, runK6 } = req.body;

    if (!id_aplicacion || !projectName) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos (id_aplicacion, projectName).' });
    }

    // 1. Crear evaluación con estado PENDIENTE
    const evalId = await new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO Evaluacion (id_aplicacion, id_configuracion, estado) VALUES (?, ?, 'PENDIENTE')`,
            [id_aplicacion, id_configuracion || null],
            function(err) {
                if (err) return reject(err);
                resolve(this.lastID);
            }
        );
    });

    // 2. Actualizar a EN_PROCESO
    db.run(`UPDATE Evaluacion SET estado = 'EN_PROCESO' WHERE id = ?`, [evalId]);

    try {
        console.log(`[Orchestrator] Evaluación #${evalId} iniciada para ${projectName}`);

        let sonarRes = { status: 'skipped', data: {} };
        let zapRes = { status: 'skipped', data: {} };
        let k6Res = { status: 'skipped', data: {} };

        // 3. Ejecutar herramientas seleccionadas
        if (runSonar) {
            try {
                sonarRes = await sonarService.analyze(repositoryUrl, projectName);
            } catch (e) {
                sonarRes = { status: 'error', data: {}, error: e.message };
            }
        }
        if (runZap) {
            try {
                zapRes = await zapService.scan(targetUrl, projectName);
            } catch (e) {
                zapRes = { status: 'error', data: {}, error: e.message };
            }
        }
        if (runK6) {
            try {
                k6Res = await k6Service.runTest(targetUrl, projectName);
            } catch (e) {
                k6Res = { status: 'error', data: {}, error: e.message };
            }
        }

        // 4. Insertar Resultados (uno por herramienta)
        const insertResult = (categoria, herramienta, datos) => {
            return new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO Resultado (id_evaluacion, categoria, herramienta_utilizada, datos) VALUES (?, ?, ?, ?)`,
                    [evalId, categoria, herramienta, JSON.stringify(datos)],
                    function(err) {
                        if (err) return reject(err);
                        resolve(this.lastID);
                    }
                );
            });
        };

        let sonarResultId = null, zapResultId = null, k6ResultId = null;
        if (runSonar) sonarResultId = await insertResult('MANTENIBILIDAD', 'SonarQube', sonarRes.data || {});
        if (runZap) zapResultId = await insertResult('SEGURIDAD', 'OWASP ZAP', zapRes.data || {});
        if (runK6) k6ResultId = await insertResult('RENDIMIENTO', 'k6', k6Res.data || {});

        // 5. Procesar resultados con el evaluator
        const processed = evaluator.processReports(
            sonarRes.data || null,
            zapRes.data || null,
            k6Res.data || null
        );

        // 6. Insertar Hallazgos
        if (processed.hallazgos && processed.hallazgos.length > 0) {
            const insertHallazgo = db.prepare(
                `INSERT INTO Hallazgo (id_resultado, severidad, categoria_calidad, descripcion, recomendacion) VALUES (?, ?, ?, ?, ?)`
            );
            for (const h of processed.hallazgos) {
                const resultId = h.categoria === 'SEGURIDAD' ? zapResultId :
                                 h.categoria === 'RENDIMIENTO' ? k6ResultId : sonarResultId;
                if (resultId) {
                    insertHallazgo.run([resultId, h.severidad, h.categoria, h.descripcion, h.recomendacion || null]);
                }
            }
            insertHallazgo.finalize();
        }

        // 7. Insertar Métricas
        if (processed.metricas && processed.metricas.length > 0) {
            const insertMetrica = db.prepare(
                `INSERT INTO Metrica (id_evaluacion, nombre, valor, valor_normalizado, unidad, categoria) VALUES (?, ?, ?, ?, ?, ?)`
            );
            for (const m of processed.metricas) {
                insertMetrica.run([evalId, m.nombre, m.valor, m.valorNormalizado, m.unidad || null, m.categoria]);
            }
            insertMetrica.finalize();
        }

        // 8. Insertar Score
        db.run(
            `INSERT INTO Score (id_evaluacion, puntaje_global, puntaje_mantenibilidad, puntaje_seguridad, puntaje_rendimiento) VALUES (?, ?, ?, ?, ?)`,
            [evalId, processed.scores.global, processed.scores.quality, processed.scores.security, processed.scores.performance]
        );

        // 9. Actualizar estado a FINALIZADA
        db.run(`UPDATE Evaluacion SET estado = 'FINALIZADA' WHERE id = ?`, [evalId]);

        res.json({
            id_evaluacion: evalId,
            estado: 'FINALIZADA',
            scores: processed.scores,
            hallazgos_count: (processed.hallazgos || []).length,
            metricas_count: (processed.metricas || []).length
        });

    } catch (err) {
        // En caso de error global, marcar la evaluación como ERROR
        db.run(`UPDATE Evaluacion SET estado = 'ERROR' WHERE id = ?`, [evalId]);
        console.error(`[Orchestrator] Error en evaluación #${evalId}:`, err);
        res.status(500).json({ error: err.message, id_evaluacion: evalId, estado: 'ERROR' });
    }
});

// ========== HISTORIAL Y CONSULTAS (RF11, RF13) ==========

// Dashboard stats para una app (o general)
app.get('/api/dashboard', (req, res) => {
    const idApp = req.query.id_app;

    const queries = {};

    // Total de aplicaciones
    queries.totalApps = new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as total FROM Aplicacion`, (err, row) => {
            if (err) return reject(err);
            resolve(row.total);
        });
    });

    // Total de evaluaciones
    const evalWhere = idApp ? `WHERE id_aplicacion = ${idApp}` : '';
    queries.totalEvals = new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as total FROM Evaluacion ${evalWhere}`, (err, row) => {
            if (err) return reject(err);
            resolve(row.total);
        });
    });

    // Total de hallazgos
    queries.totalHallazgos = new Promise((resolve, reject) => {
        const sql = idApp
            ? `SELECT COUNT(*) as total FROM Hallazgo h JOIN Resultado r ON h.id_resultado = r.id JOIN Evaluacion e ON r.id_evaluacion = e.id WHERE e.id_aplicacion = ?`
            : `SELECT COUNT(*) as total FROM Hallazgo`;
        db.get(sql, idApp ? [idApp] : [], (err, row) => {
            if (err) return reject(err);
            resolve(row.total);
        });
    });

    // Score promedio
    queries.scorePromedio = new Promise((resolve, reject) => {
        const sql = idApp
            ? `SELECT AVG(s.puntaje_global) as promedio FROM Score s JOIN Evaluacion e ON s.id_evaluacion = e.id WHERE e.id_aplicacion = ?`
            : `SELECT AVG(puntaje_global) as promedio FROM Score`;
        db.get(sql, idApp ? [idApp] : [], (err, row) => {
            if (err) return reject(err);
            resolve(row.promedio ? parseFloat(row.promedio.toFixed(1)) : 0);
        });
    });

    // Últimas evaluaciones
    queries.ultimasEvals = new Promise((resolve, reject) => {
        const sql = `SELECT e.id, e.fecha, e.estado, a.nombre as app_nombre, s.puntaje_global
            FROM Evaluacion e
            JOIN Aplicacion a ON e.id_aplicacion = a.id
            LEFT JOIN Score s ON s.id_evaluacion = e.id
            ${idApp ? 'WHERE e.id_aplicacion = ?' : ''}
            ORDER BY e.fecha DESC LIMIT 10`;
        db.all(sql, idApp ? [idApp] : [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });

    Promise.all([queries.totalApps, queries.totalEvals, queries.totalHallazgos, queries.scorePromedio, queries.ultimasEvals])
        .then(([totalApps, totalEvals, totalHallazgos, scorePromedio, ultimasEvals]) => {
            res.json({ totalApps, totalEvals, totalHallazgos, scorePromedio, ultimasEvals });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// Historial de evaluaciones de una app con scores
app.get('/api/evaluaciones/:id_app', (req, res) => {
    db.all(
        `SELECT e.id, e.fecha, e.estado, s.puntaje_global, s.puntaje_mantenibilidad, s.puntaje_seguridad, s.puntaje_rendimiento
         FROM Evaluacion e
         LEFT JOIN Score s ON s.id_evaluacion = e.id
         WHERE e.id_aplicacion = ?
         ORDER BY e.fecha DESC`,
        [req.params.id_app],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// Detalle de una evaluación (resultados + score)
app.get('/api/evaluaciones/:id/detalle', (req, res) => {
    const id = req.params.id;

    const evalQuery = new Promise((resolve, reject) => {
        db.get(
            `SELECT e.*, a.nombre as app_nombre, a.repositorio, a.url_objetivo
             FROM Evaluacion e JOIN Aplicacion a ON e.id_aplicacion = a.id WHERE e.id = ?`,
            [id], (err, row) => { if (err) reject(err); else resolve(row); }
        );
    });

    const scoreQuery = new Promise((resolve, reject) => {
        db.get(`SELECT * FROM Score WHERE id_evaluacion = ?`, [id], (err, row) => {
            if (err) reject(err); else resolve(row);
        });
    });

    const resultadosQuery = new Promise((resolve, reject) => {
        db.all(`SELECT * FROM Resultado WHERE id_evaluacion = ?`, [id], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    const hallazgosQuery = new Promise((resolve, reject) => {
        db.all(
            `SELECT h.* FROM Hallazgo h JOIN Resultado r ON h.id_resultado = r.id WHERE r.id_evaluacion = ?`,
            [id], (err, rows) => { if (err) reject(err); else resolve(rows); }
        );
    });

    const metricasQuery = new Promise((resolve, reject) => {
        db.all(`SELECT * FROM Metrica WHERE id_evaluacion = ?`, [id], (err, rows) => {
            if (err) reject(err); else resolve(rows);
        });
    });

    Promise.all([evalQuery, scoreQuery, resultadosQuery, hallazgosQuery, metricasQuery])
        .then(([evaluacion, score, resultados, hallazgos, metricas]) => {
            if (!evaluacion) return res.status(404).json({ error: 'Evaluación no encontrada' });
            res.json({ evaluacion, score, resultados, hallazgos, metricas });
        })
        .catch(err => res.status(500).json({ error: err.message }));
});

// Hallazgos de una evaluación
app.get('/api/evaluaciones/:id/hallazgos', (req, res) => {
    db.all(
        `SELECT h.*, r.herramienta_utilizada
         FROM Hallazgo h
         JOIN Resultado r ON h.id_resultado = r.id
         WHERE r.id_evaluacion = ?
         ORDER BY CASE h.severidad WHEN 'ALTO' THEN 1 WHEN 'MEDIO' THEN 2 WHEN 'BAJO' THEN 3 ELSE 4 END`,
        [req.params.id],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        }
    );
});

// ========== REPORTES PDF (RF12) ==========

app.get('/api/reporte/:id_evaluacion', async (req, res) => {
    const id = req.params.id_evaluacion;

    db.get(`
        SELECT e.*, a.nombre as appName, s.puntaje_global, s.puntaje_mantenibilidad, s.puntaje_seguridad, s.puntaje_rendimiento
        FROM Evaluacion e
        JOIN Aplicacion a ON e.id_aplicacion = a.id
        LEFT JOIN Score s ON s.id_evaluacion = e.id
        WHERE e.id = ?`, [id], async (err, row) => {

        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Evaluación no encontrada' });

        try {
            const pdfPath = await pdfService.generatePdf(row, row.appName);

            // Registrar en tabla Reporte
            db.run(
                `INSERT INTO Reporte (id_evaluacion, formato, ruta_archivo) VALUES (?, 'PDF', ?)`,
                [id, pdfPath]
            );

            res.download(pdfPath);
        } catch (pdfErr) {
            console.error('Error generando PDF', pdfErr);
            res.status(500).json({ error: pdfErr.message });
        }
    });
});

// ========== SERVER ==========

app.listen(PORT, () => {
    console.log(`NFR Framework Orchestrator listening on port ${PORT}`);
});

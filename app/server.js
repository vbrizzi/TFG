const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
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

// ========== SISTEMA DE LOGS EN TIEMPO REAL ==========
// Buffer de logs por evaluacion y herramienta, con suscriptores SSE.
const evalLogs = new Map(); // evalId -> { sonar: [], zap: [], k6: [] }
const evalSubs = new Map(); // evalId -> { sonar: [res...], zap: [res...], k6: [res...] }

function initEvalLogs(evalId) {
    evalLogs.set(evalId, { sonar: [], zap: [], k6: [], general: [] });
    evalSubs.set(evalId, { sonar: [], zap: [], k6: [], general: [] });
}

function pushLog(evalId, tool, message) {
    const logs = evalLogs.get(evalId);
    if (!logs) return;
    const entry = `[${new Date().toISOString().substring(11,19)}] ${message}`;
    if (logs[tool]) logs[tool].push(entry);
    logs.general.push(`[${tool.toUpperCase()}] ${entry}`);

    // Notificar a los suscriptores SSE
    const subs = evalSubs.get(evalId);
    if (subs && subs[tool]) {
        subs[tool].forEach(res => {
            try { res.write(`data: ${JSON.stringify({ log: entry })}\n\n`); } catch(e) {}
        });
    }
}

function cleanEvalLogs(evalId) {
    // Cerrar conexiones y limpiar después de 5 minutos
    setTimeout(() => {
        const subs = evalSubs.get(evalId);
        if (subs) {
            Object.values(subs).forEach(arr => arr.forEach(res => { try { res.end(); } catch(e) {} }));
        }
        evalLogs.delete(evalId);
        evalSubs.delete(evalId);
    }, 5 * 60 * 1000);
}

// Endpoint SSE: el frontend se suscribe para recibir logs de una herramienta específica
app.get('/api/evaluar/logs/:id/:tool', (req, res) => {
    const { id, tool } = req.params;
    const evalId = parseInt(id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Enviar logs previos que ya se acumularon
    const logs = evalLogs.get(evalId);
    if (logs && logs[tool]) {
        logs[tool].forEach(entry => {
            res.write(`data: ${JSON.stringify({ log: entry })}\n\n`);
        });
    }

    // Registrar suscriptor
    const subs = evalSubs.get(evalId);
    if (subs && subs[tool]) {
        subs[tool].push(res);
    } else {
        // Si no hay buffer, mandar un mensaje de no encontrado
        res.write(`data: ${JSON.stringify({ log: 'Evaluación no encontrada o ya finalizada.' })}\n\n`);
        res.end();
        return;
    }

    req.on('close', () => {
        const s = evalSubs.get(evalId);
        if (s && s[tool]) {
            const idx = s[tool].indexOf(res);
            if (idx > -1) s[tool].splice(idx, 1);
        }
    });
});

// ========== HEALTH ==========
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'NFR Framework Orchestrator is running' });
});

// ========== AUTENTICACIÓN ==========

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
    }
    db.get(`SELECT * FROM Usuario WHERE username = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

        res.json({
            success: true,
            user: { id: user.id, username: user.username, nombre: user.nombre_completo, rol: user.rol }
        });
    });
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

// Eliminar aplicación (y dependencias para evitar error FK)
app.delete('/api/aplicaciones/:id', (req, res) => {
    const id = req.params.id;
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. Borrar Hallazgos (dependen de Resultado)
        db.run(`DELETE FROM Hallazgo WHERE id_resultado IN (
            SELECT id FROM Resultado WHERE id_evaluacion IN (
                SELECT id FROM Evaluacion WHERE id_aplicacion = ?
            )
        )`, [id]);

        // 2. Borrar dependientes directos de Evaluacion
        db.run(`DELETE FROM Resultado WHERE id_evaluacion IN (SELECT id FROM Evaluacion WHERE id_aplicacion = ?)`, [id]);
        db.run(`DELETE FROM Metrica WHERE id_evaluacion IN (SELECT id FROM Evaluacion WHERE id_aplicacion = ?)`, [id]);
        db.run(`DELETE FROM Score WHERE id_evaluacion IN (SELECT id FROM Evaluacion WHERE id_aplicacion = ?)`, [id]);
        db.run(`DELETE FROM Reporte WHERE id_evaluacion IN (SELECT id FROM Evaluacion WHERE id_aplicacion = ?)`, [id]);

        // 3. Borrar Evaluacion y ConfiguracionEvaluacion
        db.run(`DELETE FROM Evaluacion WHERE id_aplicacion = ?`, [id]);
        db.run(`DELETE FROM ConfiguracionEvaluacion WHERE id_aplicacion = ?`, [id]);

        // 4. Borrar la Aplicacion
        db.run(`DELETE FROM Aplicacion WHERE id = ?`, [id], function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: 'Aplicación no encontrada.' });
            }
            db.run('COMMIT', (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Aplicación eliminada.' });
            });
        });
    });
});

// Actualizar aplicación
app.put('/api/aplicaciones/:id', (req, res) => {
    const id = req.params.id;
    const { nombre, descripcion, url_objetivo, repositorio } = req.body;
    db.run(`UPDATE Aplicacion SET nombre = ?, descripcion = ?, url_objetivo = ?, repositorio = ? WHERE id = ?`,
        [nombre, descripcion, url_objetivo, repositorio, id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Aplicación no encontrada.' });
            res.json({ success: true, message: 'Aplicación actualizada.' });
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

    // 2. Actualizar a EN_PROCESO e inicializar buffer de logs
    db.run(`UPDATE Evaluacion SET estado = 'EN_PROCESO' WHERE id = ?`, [evalId]);
    initEvalLogs(evalId);

    // 3. *** RESPONDER DE INMEDIATO AL CLIENTE con el evalId ***
    // La evaluación corre en background; el frontend usa SSE + polling para monitorear.
    res.json({ id_evaluacion: evalId, estado: 'EN_PROCESO' });

    // 4. Correr la evaluación de forma asíncrona (fire-and-forget)
    setImmediate(async () => {
        try {
            console.log(`[Orchestrator] Evaluación #${evalId} iniciada en background para ${projectName}`);

            let sonarRes = { status: 'skipped', data: {} };
            let zapRes   = { status: 'skipped', data: {} };
            let k6Res    = { status: 'skipped', data: {} };

            // Helper para guardar progreso en BD
            const setProgreso = (herramienta, estado) => {
                db.run(`UPDATE Evaluacion SET progreso = json_patch(COALESCE(progreso,'{}'), ?) WHERE id = ?`,
                    [JSON.stringify({ [herramienta]: estado }), evalId]);
            };

            // Helpers de log por herramienta
            const logSonar = (msg) => { pushLog(evalId, 'sonar', msg); console.log(msg); };
            const logZap   = (msg) => { pushLog(evalId, 'zap',   msg); console.log(msg); };
            const logK6    = (msg) => { pushLog(evalId, 'k6',    msg); console.log(msg); };

            // 5. Ejecutar herramientas seleccionadas
            if (runSonar) {
                setProgreso('sonar', 'running');
                try {
                    sonarRes = await sonarService.analyze(repositoryUrl, projectName, logSonar);
                    setProgreso('sonar', sonarRes.status === 'error' ? 'error' : 'done');
                } catch (e) {
                    logSonar(`[SonarQube] ❌ Error inesperado: ${e.message}`);
                    sonarRes = { status: 'error', data: {}, error: e.message };
                    setProgreso('sonar', 'error');
                }
            }
            if (runZap) {
                setProgreso('zap', 'running');
                try {
                    zapRes = await zapService.scan(targetUrl, projectName, logZap);
                    setProgreso('zap', zapRes.status === 'error' ? 'error' : 'done');
                } catch (e) {
                    logZap(`[OWASP ZAP] ❌ Error inesperado: ${e.message}`);
                    zapRes = { status: 'error', data: {}, error: e.message };
                    setProgreso('zap', 'error');
                }
            }
            if (runK6) {
                setProgreso('k6', 'running');
                try {
                    k6Res = await k6Service.runTest(targetUrl, projectName, logK6);
                    setProgreso('k6', k6Res.status === 'error' ? 'error' : 'done');
                } catch (e) {
                    logK6(`[k6] ❌ Error inesperado: ${e.message}`);
                    k6Res = { status: 'error', data: {}, error: e.message };
                    setProgreso('k6', 'error');
                }
            }

            // 6. Insertar Resultados (uno por herramienta)
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
            if (runZap)   zapResultId   = await insertResult('SEGURIDAD',      'OWASP ZAP', zapRes.data   || {});
            if (runK6)    k6ResultId    = await insertResult('RENDIMIENTO',    'k6',        k6Res.data    || {});

            // 7. Procesar resultados con el evaluator
            const processed = evaluator.processReports(
                sonarRes.data || null,
                zapRes.data   || null,
                k6Res.data    || null
            );

            // 8. Insertar Hallazgos
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

            // 9. Insertar Métricas
            if (processed.metricas && processed.metricas.length > 0) {
                const insertMetrica = db.prepare(
                    `INSERT INTO Metrica (id_evaluacion, nombre, valor, valor_normalizado, unidad, categoria) VALUES (?, ?, ?, ?, ?, ?)`
                );
                for (const m of processed.metricas) {
                    insertMetrica.run([evalId, m.nombre, m.valor, m.valorNormalizado, m.unidad || null, m.categoria]);
                }
                insertMetrica.finalize();
            }

            // 10. Insertar Score
            db.run(
                `INSERT INTO Score (id_evaluacion, puntaje_global, puntaje_mantenibilidad, puntaje_seguridad, puntaje_rendimiento) VALUES (?, ?, ?, ?, ?)`,
                [evalId, processed.scores.global, processed.scores.quality, processed.scores.security, processed.scores.performance]
            );

            // 11. Actualizar estado a FINALIZADA
            db.run(`UPDATE Evaluacion SET estado = 'FINALIZADA' WHERE id = ?`, [evalId]);

            // Emitir scores finales por SSE y cerrar streams
            pushLog(evalId, 'sonar', `\n[RESULTADO] Score Mantenibilidad: ${processed.scores.quality}/100`);
            pushLog(evalId, 'zap',   `\n[RESULTADO] Score Seguridad: ${processed.scores.security}/100`);
            pushLog(evalId, 'k6',    `\n[RESULTADO] Score Rendimiento: ${processed.scores.performance}/100`);

            cleanEvalLogs(evalId);
            console.log(`[Orchestrator] Evaluación #${evalId} FINALIZADA. Scores: Q=${processed.scores.quality} S=${processed.scores.security} P=${processed.scores.performance}`);

        } catch (err) {
            db.run(`UPDATE Evaluacion SET estado = 'ERROR' WHERE id = ?`, [evalId]);
            console.error(`[Orchestrator] Error en evaluación #${evalId}:`, err);
            pushLog(evalId, 'sonar', `[ERROR CRÍTICO] ${err.message}`);
            pushLog(evalId, 'zap',   `[ERROR CRÍTICO] ${err.message}`);
            pushLog(evalId, 'k6',    `[ERROR CRÍTICO] ${err.message}`);
            cleanEvalLogs(evalId);
        }
    });

});

// Consultar progreso de una evaluación en curso

app.get('/api/evaluar/progreso/:id', (req, res) => {
    db.get(
        `SELECT id, estado, progreso FROM Evaluacion WHERE id = ?`,
        [req.params.id],
        (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Evaluación no encontrada' });
            let progreso = {};
            try { progreso = JSON.parse(row.progreso || '{}'); } catch(e) {}
            res.json({ id: row.id, estado: row.estado, progreso });
        }
    );
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
            `SELECT h.*, r.herramienta_utilizada FROM Hallazgo h JOIN Resultado r ON h.id_resultado = r.id WHERE r.id_evaluacion = ?`,
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

    try {
        const row = await new Promise((resolve, reject) => {
            db.get(`
                SELECT e.*, a.nombre as appName, s.puntaje_global, s.puntaje_mantenibilidad, s.puntaje_seguridad, s.puntaje_rendimiento
                FROM Evaluacion e
                JOIN Aplicacion a ON e.id_aplicacion = a.id
                LEFT JOIN Score s ON s.id_evaluacion = e.id
                WHERE e.id = ?`, [id], (err, row) => {
                if (err) reject(err); else resolve(row);
            });
        });

        if (!row) return res.status(404).json({ error: 'Evaluación no encontrada' });

        const hallazgos = await new Promise((resolve, reject) => {
            db.all(`
                SELECT h.*, r.herramienta_utilizada 
                FROM Hallazgo h 
                JOIN Resultado r ON h.id_resultado = r.id 
                WHERE r.id_evaluacion = ?
                ORDER BY CASE h.severidad WHEN 'ALTO' THEN 1 WHEN 'MEDIO' THEN 2 WHEN 'BAJO' THEN 3 ELSE 4 END`,
                [id], (err, rows) => {
                if (err) reject(err); else resolve(rows);
            });
        });

        const pdfPath = await pdfService.generatePdf(row, row.appName, hallazgos);

        // Registrar en tabla Reporte
        db.run(
            `INSERT INTO Reporte (id_evaluacion, formato, ruta_archivo) VALUES (?, 'PDF', ?)`,
            [id, pdfPath]
        );

        res.download(pdfPath);
    } catch (err) {
        console.error('Error generando PDF', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== SERVER ==========

app.listen(PORT, () => {
    console.log(`NFR Framework Orchestrator listening on port ${PORT}`);
});

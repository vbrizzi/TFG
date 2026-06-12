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
// Servir archivos estáticos del frontend
app.use(express.static('public'));

// Basic health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'NFR Framework Orchestrator is running' });
});

// Registrar aplicación
app.post('/api/aplicaciones', (req, res) => {
    const { nombre, descripcion, url_objetivo, repositorio } = req.body;
    db.run(
        `INSERT INTO Aplicacion (nombre, descripcion, url_objetivo, repositorio) VALUES (?, ?, ?, ?)`,
        [nombre, descripcion, url_objetivo, repositorio],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID, nombre, descripcion, url_objetivo, repositorio });
        }
    );
});

// Listar aplicaciones
app.get('/api/aplicaciones', (req, res) => {
    db.all(`SELECT * FROM Aplicacion`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Endpoint to trigger an evaluation
app.post('/api/evaluar', async (req, res) => {
    const { id_aplicacion, repositoryUrl, targetUrl, projectName, runSonar, runZap, runK6 } = req.body;
    
    if (!id_aplicacion || !projectName) {
        return res.status(400).json({ error: 'Faltan parámetros requeridos.' });
    }

    try {
        console.log(`[Orchestrator] Iniciando evaluación para ${projectName}`);
        
        let sonarRes = { status: 'skipped', data: {} };
        let zapRes = { status: 'skipped', data: {} };
        let k6Res = { status: 'skipped', data: {} };

        // Ejecución secuencial y selectiva
        if (runSonar) sonarRes = await sonarService.analyze(repositoryUrl, projectName);
        if (runZap) zapRes = await zapService.scan(targetUrl, projectName);
        if (runK6) k6Res = await k6Service.runTest(targetUrl, projectName);

        // Procesar resultados
        // Evaluator normally expects data from all three. We might need to handle empty data.
        const score = evaluator.processReports(
            runSonar ? null : null, // sonar no devuelve json acá, lo simulamos o pasamos null
            runZap ? zapRes.data : {}, 
            runK6 ? k6Res.data : {}
        );

        // Guardar detalles
        const resultJson = JSON.stringify({
            sonar: sonarRes.status,
            zap: zapRes.status,
            k6: k6Res.status
        });

        db.run(
            `INSERT INTO Evaluacion (id_aplicacion, puntaje_seguridad, puntaje_calidad, puntaje_performance, indice_general, detalles)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [id_aplicacion, score.security, score.quality, score.performance, score.global, resultJson],
            function(err) {
                if (err) {
                    console.error('Error insertando evaluación', err);
                    return res.status(500).json({ error: err.message });
                }
                res.json({
                    id_evaluacion: this.lastID,
                    scores: score,
                    status: 'success'
                });
            }
        );
    } catch (err) {
        console.error('[Orchestrator] Error global en evaluación:', err);
        res.status(500).json({ error: err.message });
    }
});

// Historial de evaluaciones
app.get('/api/evaluaciones/:id_aplicacion', (req, res) => {
    const id = req.params.id_aplicacion;
    db.all(`SELECT * FROM Evaluacion WHERE id_aplicacion = ? ORDER BY fecha DESC`, [id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Endpoint para descargar reporte en PDF
app.get('/api/reporte/:id_evaluacion', async (req, res) => {
    const id = req.params.id_evaluacion;
    
    db.get(`
        SELECT e.*, a.nombre as appName 
        FROM Evaluacion e 
        JOIN Aplicacion a ON e.id_aplicacion = a.id 
        WHERE e.id = ?`, [id], async (err, row) => {
        
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Evaluación no encontrada' });

        try {
            const pdfPath = await pdfService.generatePdf(row, row.appName);
            res.download(pdfPath);
        } catch (pdfErr) {
            console.error('Error generando PDF', pdfErr);
            res.status(500).json({ error: pdfErr.message });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Orchestrator server listening on port ${PORT}`);
});

/**
 * Script de carga de datos de prueba para el Framework NFR.
 * Genera una aplicación de ejemplo con múltiples evaluaciones y scores variados
 * para poder analizar el dashboard y los gráficos de evolución.
 */

const path = require('path');
// Usar el sqlite3 instalado en la carpeta app
const sqlite3 = require('./app/node_modules/sqlite3').verbose();

const dbPath = path.resolve(__dirname, 'app', 'nfr_framework.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error abriendo BD:', err.message);
        process.exit(1);
    }
    console.log('Conectado a la BD:', dbPath);
});

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    // ── 1. APLICACIÓN DE PRUEBA ──────────────────────────────────────────────
    db.run(
        `INSERT OR IGNORE INTO Aplicacion (id, nombre, descripcion, url_objetivo, repositorio, fecha_registro)
         VALUES (99, 'App Demo TFG', 'Aplicación de prueba para análisis del dashboard', 'http://localhost:3000', 'https://github.com/vbrizzi/TFG.git', datetime('now', '-30 days'))`,
        (err) => { if (err) console.error('App:', err.message); else console.log('✓ Aplicación de prueba creada.'); }
    );

    // ── 2. EVALUACIONES con distintos scores (simulan evolución en el tiempo) ─
    // Cada evaluación tiene scores que van mejorando gradualmente pero terminan bajos 
    // para que la ejecución real en la demo (que da ~90-100) muestre una "mejora" clara.
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
        db.run(
            `INSERT OR IGNORE INTO Evaluacion (id, id_aplicacion, fecha, estado, progreso)
             VALUES (?, 99, datetime('now', ? || ' days'), ?, '{"sonar":"done","zap":"done","k6":"done"}')`,
            [ev.id, ev.dias, ev.estado],
            (err) => { if (err) console.error(`Eval ${ev.id}:`, err.message); }
        );

        db.run(
            `INSERT OR IGNORE INTO Score (id_evaluacion, puntaje_global, puntaje_mantenibilidad, puntaje_seguridad, puntaje_rendimiento)
             VALUES (?, ?, ?, ?, ?)`,
            [ev.id, ev.global, ev.mant, ev.seg, ev.perf],
            (err) => { if (err) console.error(`Score ${ev.id}:`, err.message); }
        );

        // Insertar resultados por herramienta
        db.run(`INSERT OR IGNORE INTO Resultado (id_evaluacion, categoria, herramienta_utilizada, datos) VALUES (?, 'MANTENIBILIDAD', 'SonarQube', '{}')`, [ev.id]);
        db.run(`INSERT OR IGNORE INTO Resultado (id_evaluacion, categoria, herramienta_utilizada, datos) VALUES (?, 'SEGURIDAD', 'OWASP ZAP', '{}')`, [ev.id]);
        db.run(`INSERT OR IGNORE INTO Resultado (id_evaluacion, categoria, herramienta_utilizada, datos) VALUES (?, 'RENDIMIENTO', 'k6', '{}')`, [ev.id]);
    });

    // ── 3. MÉTRICAS para la última evaluación ──────────────────────────────
    const metricas = [
        { evalId: 107, nombre: 'Complejidad Ciclomática', valor: 8, valorNorm: 85, unidad: '', categoria: 'MANTENIBILIDAD' },
        { evalId: 107, nombre: 'Duplicación de Código',   valor: 3.2, valorNorm: 80, unidad: '%', categoria: 'MANTENIBILIDAD' },
        { evalId: 107, nombre: 'Deuda Técnica',           valor: 42,  valorNorm: 78, unidad: 'min', categoria: 'MANTENIBILIDAD' },
        { evalId: 107, nombre: 'Vulnerabilidades Altas',  valor: 0,   valorNorm: 100, unidad: '', categoria: 'SEGURIDAD' },
        { evalId: 107, nombre: 'Vulnerabilidades Medias', valor: 2,   valorNorm: 70, unidad: '', categoria: 'SEGURIDAD' },
        { evalId: 107, nombre: 'Tiempo respuesta p95',    valor: 420, valorNorm: 80, unidad: 'ms', categoria: 'RENDIMIENTO' },
        { evalId: 107, nombre: 'Tasa de error',           valor: 0.5, valorNorm: 90, unidad: '%', categoria: 'RENDIMIENTO' },
        { evalId: 107, nombre: 'Peticiones/segundo',      valor: 95,  valorNorm: 88, unidad: 'req/s', categoria: 'RENDIMIENTO' },
    ];

    metricas.forEach(m => {
        db.run(
            `INSERT OR IGNORE INTO Metrica (id_evaluacion, nombre, valor, valor_normalizado, unidad, categoria)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [m.evalId, m.nombre, m.valor, m.valorNorm, m.unidad, m.categoria],
            (err) => { if (err) console.error(`Métrica ${m.nombre}:`, err.message); }
        );
    });

    // ── 4. HALLAZGOS para la última evaluación ─────────────────────────────
    // Los hallazgos necesitan id_resultado; usamos subquery-like approach
    setTimeout(() => {
        db.get(`SELECT id FROM Resultado WHERE id_evaluacion = 107 AND herramienta_utilizada = 'SonarQube'`, [], (err, rowSonar) => {
            db.get(`SELECT id FROM Resultado WHERE id_evaluacion = 107 AND herramienta_utilizada = 'OWASP ZAP'`, [], (err2, rowZap) => {
                db.get(`SELECT id FROM Resultado WHERE id_evaluacion = 107 AND herramienta_utilizada = 'k6'`, [], (err3, rowK6) => {
                    const hallazgos = [
                        { rid: rowSonar?.id, sev: 'MEDIO', cat: 'MANTENIBILIDAD', desc: 'Se detectaron 3 métodos con complejidad ciclomática mayor a 8.', rec: 'Refactorizar las funciones detectadas en módulos más pequeños.' },
                        { rid: rowSonar?.id, sev: 'BAJO',  cat: 'MANTENIBILIDAD', desc: 'Duplicación de código detectada en módulos de validación (3.2%).', rec: 'Extraer funciones comunes a utilidades compartidas.' },
                        { rid: rowZap?.id,   sev: 'MEDIO', cat: 'SEGURIDAD',      desc: 'Cabeceras de seguridad HTTP faltantes (X-Frame-Options, CSP).', rec: 'Agregar middleware de cabeceras de seguridad en el servidor Express.' },
                        { rid: rowZap?.id,   sev: 'BAJO',  cat: 'SEGURIDAD',      desc: 'Cookie de sesión sin el atributo Secure activado.', rec: 'Configurar las cookies con los flags Secure y HttpOnly.' },
                        { rid: rowK6?.id,    sev: 'BAJO',  cat: 'RENDIMIENTO',    desc: 'Tiempo de respuesta p95 en 420ms, cerca del umbral definido de 500ms.', rec: 'Revisar consultas a base de datos y agregar índices donde corresponda.' },
                    ];

                    hallazgos.forEach(h => {
                        if (!h.rid) return;
                        db.run(
                            `INSERT INTO Hallazgo (id_resultado, severidad, categoria_calidad, descripcion, recomendacion) VALUES (?, ?, ?, ?, ?)`,
                            [h.rid, h.sev, h.cat, h.desc, h.rec],
                            (err) => { if (err) console.error('Hallazgo:', err.message); }
                        );
                    });

                    console.log('✓ Métricas y hallazgos de la última evaluación insertados.');
                    console.log('✓ Listo! Entrá al dashboard en http://localhost:3000 para ver los datos.');
                    db.close();
                });
            });
        });
    }, 500);
});

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PdfService {
    async generatePdf(evaluationData, appName) {
        const reportsDir = path.join(__dirname, '..', 'reports', 'pdf');
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

        const pdfName = `reporte_NFR_${appName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        const pdfPath = path.join(reportsDir, pdfName);

        const global   = evaluationData.puntaje_global        != null ? Number(evaluationData.puntaje_global).toFixed(1)        : '—';
        const mant     = evaluationData.puntaje_mantenibilidad != null ? Number(evaluationData.puntaje_mantenibilidad).toFixed(1) : '—';
        const seg      = evaluationData.puntaje_seguridad      != null ? Number(evaluationData.puntaje_seguridad).toFixed(1)      : '—';
        const perf     = evaluationData.puntaje_rendimiento    != null ? Number(evaluationData.puntaje_rendimiento).toFixed(1)    : '—';
        const fecha    = evaluationData.fecha ? new Date(evaluationData.fecha).toLocaleString('es-AR') : new Date().toLocaleString('es-AR');
        const evalId   = evaluationData.id || '—';
        const estado   = evaluationData.estado || 'FINALIZADA';

        const scoreNum = parseFloat(global) || 0;
        const scoreColor = scoreNum >= 80 ? '#4caf50' : scoreNum >= 60 ? '#ff9800' : '#f44336';
        const nivelCalidad = scoreNum >= 80 ? 'Satisfactorio' : scoreNum >= 60 ? 'Aceptable' : 'Deficiente';

        const barHtml = (label, value, color) => {
            const pct = parseFloat(value) || 0;
            return `
            <div class="score-row">
                <span class="score-label">${label}</span>
                <div class="score-bar-wrap">
                    <div class="score-bar-fill" style="width:${pct}%;background:${color};"></div>
                </div>
                <span class="score-num" style="color:${color};">${value}/100</span>
            </div>`;
        };

        const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; background: #fff; }

        /* HEADER */
        .header {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff; padding: 32px 40px; display: flex;
            align-items: center; justify-content: space-between;
        }
        .header-title h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .header-title p  { font-size: 12px; color: #a0a0b8; }
        .header-badge {
            background: #6c63ff; border-radius: 8px;
            padding: 8px 16px; font-size: 13px; font-weight: 600;
        }

        /* BODY */
        .body { padding: 32px 40px; }
        .section { margin-bottom: 28px; }
        .section-title {
            font-size: 14px; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.5px; color: #6c63ff;
            border-bottom: 2px solid #6c63ff; padding-bottom: 6px; margin-bottom: 16px;
        }

        /* METADATA */
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .meta-item { background: #f8f9fa; border-radius: 8px; padding: 12px 16px; }
        .meta-item .label { font-size: 11px; color: #888; margin-bottom: 3px; }
        .meta-item .value { font-size: 14px; font-weight: 600; }

        /* SCORE GLOBAL */
        .score-global-wrap { display: flex; align-items: center; gap: 24px; margin-bottom: 20px; }
        .score-circle {
            width: 90px; height: 90px; border-radius: 50%;
            border: 6px solid ${scoreColor};
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .score-circle .num { font-size: 26px; font-weight: 800; color: ${scoreColor}; }
        .score-circle .denom { font-size: 12px; color: #888; }
        .score-summary h3 { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
        .score-summary p  { font-size: 13px; color: #555; line-height: 1.5; }
        .nivel-badge {
            display: inline-block; padding: 3px 12px; border-radius: 20px;
            font-size: 12px; font-weight: 700; background: ${scoreColor}22; color: ${scoreColor};
            margin-top: 6px;
        }

        /* SCORE BARS */
        .score-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .score-label { width: 130px; font-size: 13px; font-weight: 600; }
        .score-bar-wrap { flex: 1; height: 14px; background: #f0f0f0; border-radius: 7px; overflow: hidden; }
        .score-bar-fill { height: 100%; border-radius: 7px; }
        .score-num { width: 70px; text-align: right; font-size: 13px; font-weight: 700; }

        /* TABLE */
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: left; padding: 9px 12px; background: #f0f0f8; font-weight: 700; color: #444; border-bottom: 2px solid #6c63ff22; }
        td { padding: 9px 12px; border-bottom: 1px solid #f0f0f0; }
        tr:hover td { background: #f8f9ff; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .badge-ok   { background: #e8f5e9; color: #2e7d32; }
        .badge-warn { background: #fff3e0; color: #e65100; }
        .badge-err  { background: #ffebee; color: #c62828; }
        .badge-info { background: #e3f2fd; color: #1565c0; }

        /* FOOTER */
        .footer {
            margin-top: 40px; padding: 16px 40px;
            background: #f8f9fa; border-top: 1px solid #eee;
            font-size: 11px; color: #aaa; text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">
            <h1>Reporte de Evaluación de Calidad No Funcional</h1>
            <p>NFR Framework — Modelo Automatizado de Evaluación Continua</p>
        </div>
        <div class="header-badge">Evaluación #${evalId}</div>
    </div>

    <div class="body">

        <!-- METADATA -->
        <div class="section">
            <div class="section-title">Información de la Evaluación</div>
            <div class="meta-grid">
                <div class="meta-item">
                    <div class="label">Aplicación</div>
                    <div class="value">${appName}</div>
                </div>
                <div class="meta-item">
                    <div class="label">Estado</div>
                    <div class="value">${estado}</div>
                </div>
                <div class="meta-item">
                    <div class="label">Fecha de ejecución</div>
                    <div class="value">${fecha}</div>
                </div>
                <div class="meta-item">
                    <div class="label">Categorías evaluadas</div>
                    <div class="value">Mantenibilidad · Seguridad · Rendimiento</div>
                </div>
            </div>
        </div>

        <!-- SCORE GLOBAL -->
        <div class="section">
            <div class="section-title">Resumen Ejecutivo</div>
            <div class="score-global-wrap">
                <div class="score-circle">
                    <span class="num">${global}</span>
                    <span class="denom">/100</span>
                </div>
                <div class="score-summary">
                    <h3>Score Global de Calidad No Funcional</h3>
                    <p>La evaluación de la aplicación <strong>${appName}</strong> arrojó un score global de <strong>${global}/100</strong>.</p>
                    <span class="nivel-badge">${nivelCalidad}</span>
                </div>
            </div>
            ${barHtml('Mantenibilidad', mant, '#4caf50')}
            ${barHtml('Seguridad',      seg,  '#ff9800')}
            ${barHtml('Rendimiento',    perf, '#2196f3')}
        </div>

        <!-- MÉTRICAS -->
        <div class="section">
            <div class="section-title">Métricas Detalladas</div>
            <table>
                <thead>
                    <tr><th>Categoría</th><th>Herramienta</th><th>Métrica</th><th>Valor</th><th>Umbral</th><th>Estado</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Mantenibilidad</td><td>SonarQube</td>
                        <td>Score Normalizado</td>
                        <td>${mant}/100</td><td>≥ 70</td>
                        <td><span class="badge ${parseFloat(mant)>=70?'badge-ok':'badge-warn'}">${parseFloat(mant)>=70?'Cumple':'Revisar'}</span></td>
                    </tr>
                    <tr>
                        <td>Seguridad</td><td>OWASP ZAP</td>
                        <td>Score Normalizado</td>
                        <td>${seg}/100</td><td>≥ 70</td>
                        <td><span class="badge ${parseFloat(seg)>=70?'badge-ok':'badge-warn'}">${parseFloat(seg)>=70?'Cumple':'Revisar'}</span></td>
                    </tr>
                    <tr>
                        <td>Rendimiento</td><td>k6</td>
                        <td>Score Normalizado</td>
                        <td>${perf}/100</td><td>≥ 70</td>
                        <td><span class="badge ${parseFloat(perf)>=70?'badge-ok':'badge-warn'}">${parseFloat(perf)>=70?'Cumple':'Revisar'}</span></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- OBSERVACIONES -->
        <div class="section">
            <div class="section-title">Observaciones y Recomendaciones</div>
            <table>
                <thead><tr><th>#</th><th>Observación</th></tr></thead>
                <tbody>
                    <tr><td>1</td><td>La evaluación integró herramientas especializadas: SonarQube (mantenibilidad), OWASP ZAP (seguridad) y k6 (rendimiento).</td></tr>
                    <tr><td>2</td><td>${parseFloat(mant)<70 ? 'Se detectaron oportunidades de mejora en la calidad del código. Se recomienda revisar la complejidad ciclomática y la duplicación.' : 'La mantenibilidad del código se encuentra en niveles satisfactorios.'}</td></tr>
                    <tr><td>3</td><td>${parseFloat(seg)<70 ? 'Se encontraron vulnerabilidades que requieren atención. Se recomienda revisar los hallazgos de OWASP ZAP y aplicar las correcciones sugeridas.' : 'No se detectaron vulnerabilidades críticas de seguridad.'}</td></tr>
                    <tr><td>4</td><td>${parseFloat(perf)<70 ? 'El sistema presenta problemas de rendimiento bajo carga. Se recomienda revisar los tiempos de respuesta p95 y la tasa de error.' : 'El rendimiento cumple con los umbrales definidos (p95 < 500ms, error < 1%).'}</td></tr>
                    <tr><td>5</td><td>Se recomienda ejecutar una nueva evaluación posterior a la corrección de los hallazgos detectados para verificar la mejora.</td></tr>
                </tbody>
            </table>
        </div>

    </div>

    <div class="footer">
        Reporte generado automáticamente por NFR Framework Orchestrator · ${new Date().toLocaleString('es-AR')} · Evaluación #${evalId}
    </div>
</body>
</html>`;

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });
        await browser.close();

        return pdfPath;
    }
}

module.exports = new PdfService();

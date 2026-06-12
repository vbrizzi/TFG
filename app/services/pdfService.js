const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class PdfService {
    async generatePdf(evaluationData, appName) {
        const reportsDir = path.join(__dirname, '..', 'reports', 'pdf');
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        
        const pdfName = `reporte_NFR_${appName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        const pdfPath = path.join(reportsDir, pdfName);

        // Generamos un HTML simple con los datos para el PDF
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Helvetica', Arial, sans-serif; padding: 40px; color: #333; }
                h1 { color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
                .metric { margin-bottom: 20px; }
                .score { font-size: 24px; font-weight: bold; }
                .good { color: #4caf50; }
                .medium { color: #ff9800; }
                .bad { color: #f44336; }
                table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f5f5f5; }
            </style>
        </head>
        <body>
            <h1>Reporte de Evaluación NFR</h1>
            <p><strong>Aplicación:</strong> ${appName}</p>
            <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
            
            <div class="metric">
                <h3>Score Global</h3>
                <span class="score ${evaluationData.indice_general > 70 ? 'good' : 'medium'}">${evaluationData.indice_general}/100</span>
            </div>

            <table>
                <tr><th>Categoría</th><th>Puntaje</th></tr>
                <tr><td>Mantenibilidad (SonarQube)</td><td>${evaluationData.puntaje_calidad}</td></tr>
                <tr><td>Seguridad (OWASP ZAP)</td><td>${evaluationData.puntaje_seguridad}</td></tr>
                <tr><td>Rendimiento (k6)</td><td>${evaluationData.puntaje_performance}</td></tr>
            </table>
            
            <p style="margin-top: 50px; font-size: 12px; color: #777; text-align: center;">Generado automáticamente por NFR Framework Orchestrator</p>
        </body>
        </html>
        `;

        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
        await browser.close();

        return pdfPath;
    }
}

module.exports = new PdfService();

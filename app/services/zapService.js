const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Servicio para ejecutar OWASP ZAP (Análisis Dinámico)
 * Ejecuta el contenedor oficial de ZAP apuntando a una URL objetivo.
 */
class ZapService {
    async scan(targetUrl, projectName) {
        // Directorio para guardar los reportes
        const reportsDir = path.join(__dirname, '..', 'reports', 'zap');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const reportName = `zap_report_${projectName}.json`;
        const reportPath = path.join(reportsDir, reportName);

        try {
            console.log(`[ZapService] Iniciando escaneo ZAP Baseline contra: ${targetUrl}`);
            
            const normalizedReportsDir = reportsDir.replace(/\\/g, '/');

            // Comando docker para ejecutar el escaneo baseline de ZAP
            // Usamos -t para el target, -J para generar reporte JSON
            const dockerCmd = `docker run --rm -v "${normalizedReportsDir}:/zap/wrk/:rw" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t ${targetUrl} -J ${reportName}`;
            
            // execSync tirará una excepción si ZAP detecta vulnerabilidades (exit code distinto de 0)
            // por lo que capturaremos eso en el bloque catch o permitiremos la falla.
            try {
                execSync(dockerCmd, { stdio: 'inherit' });
            } catch (dockerErr) {
                // ZAP devuelve exit code 1 o 2 si encuentra vulnerabilidades, es normal.
                console.log(`[ZapService] ZAP finalizó (con hallazgos o advertencias).`);
            }

            console.log(`[ZapService] Escaneo finalizado. Reporte generado en: ${reportPath}`);
            
            // Leemos el JSON generado
            let zapData = {};
            if (fs.existsSync(reportPath)) {
                zapData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            }

            return {
                status: 'success',
                targetUrl: targetUrl,
                data: zapData
            };
        } catch (error) {
            console.error(`[ZapService] Error durante el escaneo:`, error.message);
            return {
                status: 'error',
                message: error.message
            };
        }
    }
}

module.exports = new ZapService();

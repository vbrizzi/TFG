const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Servicio para ejecutar OWASP ZAP (Análisis Dinámico de Seguridad)
 * Ejecuta el contenedor oficial de ZAP apuntando a una URL objetivo.
 */
class ZapService {

    /**
     * @param {string} targetUrl - URL objetivo a escanear.
     * @param {string} projectName - Nombre del proyecto.
     * @param {Function} logFn - Función de callback para enviar logs al frontend.
     */
    async scan(targetUrl, projectName, logFn = console.log) {
        const reportsDir = path.join(__dirname, '..', 'reports', 'zap');
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

        const reportName = `zap_report_${projectName}.json`;
        const reportPath = path.join(reportsDir, reportName);
        const normalizedReportsDir = reportsDir.replace(/\\/g, '/');

        logFn(`[OWASP ZAP] Iniciando análisis dinámico de seguridad...`);
        logFn(`[OWASP ZAP] Target URL: ${targetUrl}`);
        logFn(`[OWASP ZAP] Descargando/preparando imagen Docker de ZAP...`);

        const dockerArgs = [
            'run', '--rm',
            '-v', `${normalizedReportsDir}:/zap/wrk/:rw`,
            'ghcr.io/zaproxy/zaproxy:stable',
            'zap-baseline.py',
            '-t', targetUrl,
            '-J', reportName,
            '-I'  // No fallar si hay alertas (exit code 0 siempre)
        ];

        try {
            await this._runDockerWithLogs('docker', dockerArgs, logFn, '[OWASP ZAP]');
        } catch (e) {
            // ZAP retorna exit code 2 cuando encuentra alertas, eso es NORMAL y esperado.
            logFn(`[OWASP ZAP] Escaneo finalizado (se encontraron hallazgos de seguridad).`);
        }

        logFn(`[OWASP ZAP] Procesando reporte generado...`);

        let zapData = {};
        if (fs.existsSync(reportPath)) {
            try {
                zapData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                const sites = zapData.site || [];
                let totalAlerts = 0;
                for (const site of sites) totalAlerts += (site.alerts || []).length;
                logFn(`[OWASP ZAP] ✅ Escaneo completado. Alertas encontradas: ${totalAlerts}`);
            } catch (e) {
                logFn(`[OWASP ZAP] ⚠️ No se pudo parsear el reporte JSON: ${e.message}`);
            }
        } else {
            logFn(`[OWASP ZAP] ⚠️ No se generó el archivo de reporte. Puede que el target no esté accesible.`);
        }

        return {
            status: 'success',
            targetUrl,
            data: zapData
        };
    }

    /**
     * Ejecuta un proceso Docker y emite sus logs línea a línea via logFn.
     */
    _runDockerWithLogs(cmd, args, logFn, prefix) {
        return new Promise((resolve, reject) => {
            const proc = spawn(cmd, args, { shell: true });
            proc.stdout.on('data', (data) => {
                data.toString().split('\n').filter(l => l.trim()).forEach(line => logFn(`${prefix} ${line}`));
            });
            proc.stderr.on('data', (data) => {
                data.toString().split('\n').filter(l => l.trim()).forEach(line => logFn(`${prefix} ${line}`));
            });
            proc.on('close', (code) => resolve(code));
            proc.on('error', reject);
        });
    }
}

module.exports = new ZapService();

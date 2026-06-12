const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Servicio para ejecutar k6 (Pruebas de Carga y Performance)
 * Ejecuta scripts de k6 para evaluar los tiempos de respuesta.
 */
class K6Service {
    async runTest(targetUrl, projectName) {
        const reportsDir = path.join(__dirname, '..', 'reports', 'k6');
        const scriptsDir = path.join(__dirname, '..', 'scripts');
        
        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });

        const scriptName = `load_${projectName}.js`;
        const scriptPath = path.join(scriptsDir, scriptName);
        const reportName = `k6_report_${projectName}.json`;
        
        // Generar un script base de k6
        const k6ScriptContent = `
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '10s',
};

export default function () {
  http.get('${targetUrl}');
  sleep(1);
}
`;
        fs.writeFileSync(scriptPath, k6ScriptContent);

        try {
            console.log(`[K6Service] Iniciando prueba de carga contra: ${targetUrl}`);
            
            const normalizedScriptsDir = scriptsDir.replace(/\\/g, '/');
            const normalizedReportsDir = reportsDir.replace(/\\/g, '/');

            // Ejecuta k6 montando las carpetas y genera un resumen en JSON
            const dockerCmd = `docker run --rm -v "${normalizedScriptsDir}:/scripts" -v "${normalizedReportsDir}:/reports" grafana/k6 run --summary-export=/reports/${reportName} /scripts/${scriptName}`;
            
            execSync(dockerCmd, { stdio: 'inherit' });

            const reportPath = path.join(reportsDir, reportName);
            let k6Data = {};
            if (fs.existsSync(reportPath)) {
                k6Data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            }

            console.log(`[K6Service] Prueba de carga finalizada.`);
            return {
                status: 'success',
                targetUrl: targetUrl,
                data: k6Data
            };
        } catch (error) {
            console.error(`[K6Service] Error durante la prueba de carga:`, error.message);
            return {
                status: 'error',
                message: error.message
            };
        }
    }
}

module.exports = new K6Service();

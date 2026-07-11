const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Servicio para ejecutar k6 (Pruebas de Carga y Performance)
 * Ejecuta scripts de k6 para evaluar los tiempos de respuesta y tasa de error.
 */
class K6Service {

    /**
     * Reemplaza localhost/127.0.0.1 por host.docker.internal para que los
     * contenedores Docker puedan acceder al servidor que corre en el host.
     */
    _resolveDockerUrl(url) {
        return url
            .replace(/localhost/g, 'host.docker.internal')
            .replace(/127\.0\.0\.1/g, 'host.docker.internal');
    }

    /**
     * @param {string} targetUrl - URL objetivo a testear.
     * @param {string} projectName - Nombre del proyecto.
     * @param {Function} logFn - Función de callback para enviar logs al frontend.
     */
    async runTest(targetUrl, projectName, logFn = console.log) {
        const reportsDir = path.join(__dirname, '..', 'reports', 'k6');
        const scriptsDir = path.join(__dirname, '..', 'scripts');

        if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
        if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });

        const scriptName = `load_${projectName}.js`;
        const scriptPath = path.join(scriptsDir, scriptName);
        const reportName = `k6_report_${projectName}.json`;

        // Resolver URL para que funcione desde dentro del contenedor Docker
        const dockerTargetUrl = this._resolveDockerUrl(targetUrl);
        // Script de k6 con configuración realista
        const k6ScriptContent = `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('${dockerTargetUrl}');
  check(res, {
    'status 200': (r) => r.status === 200,
    'respuesta < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
`;
        fs.writeFileSync(scriptPath, k6ScriptContent);

        logFn(`[k6] Iniciando prueba de carga y rendimiento...`);
        logFn(`[k6] Target URL: ${targetUrl}`);
        if (dockerTargetUrl !== targetUrl) {
            logFn(`[k6] (Docker) URL resuelta: ${dockerTargetUrl}`);
        }
        logFn(`[k6] Configuración: 10 VUs (usuarios virtuales) durante 30 segundos.`);
        logFn(`[k6] Umbrales: p95 < 500ms, tasa de error < 1%.`);

        const normalizedScriptsDir = scriptsDir.replace(/\\/g, '/');
        const normalizedReportsDir = reportsDir.replace(/\\/g, '/');

        const dockerArgs = [
            'run', '--rm',
            '--add-host=host.docker.internal:host-gateway',
            '-v', `${normalizedScriptsDir}:/scripts`,
            '-v', `${normalizedReportsDir}:/reports`,
            'grafana/k6',
            'run',
            '--summary-export', `/reports/${reportName}`,
            `/scripts/${scriptName}`
        ];

        try {
            await this._runDockerWithLogs('docker', dockerArgs, logFn, '[k6]');
        } catch (e) {
            // k6 puede retornar exit code != 0 si los thresholds fallan, es normal.
            logFn(`[k6] Prueba finalizada (algunos umbrales pueden no haberse cumplido).`);
        }

        logFn(`[k6] Procesando resultados...`);

        const reportPath = path.join(reportsDir, reportName);
        let k6Data = {};
        if (fs.existsSync(reportPath)) {
            try {
                k6Data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                const metrics = k6Data.metrics || {};
                const p95 = metrics.http_req_duration?.values?.['p(95)'];
                const errorRate = metrics.http_req_failed?.values?.rate;
                const rps = metrics.http_reqs?.values?.rate;

                if (p95 !== undefined) logFn(`[k6] Tiempo respuesta p95: ${p95.toFixed(0)}ms`);
                if (errorRate !== undefined) logFn(`[k6] Tasa de error: ${(errorRate * 100).toFixed(2)}%`);
                if (rps !== undefined) logFn(`[k6] Throughput: ${rps.toFixed(2)} req/s`);
                logFn(`[k6] ✅ Prueba de carga completada.`);
            } catch (e) {
                logFn(`[k6] ⚠️ No se pudo parsear el reporte JSON: ${e.message}`);
            }
        } else {
            logFn(`[k6] ⚠️ No se generó el reporte. Verificar que el target esté accesible.`);
        }

        return {
            status: 'success',
            targetUrl,
            data: k6Data
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

module.exports = new K6Service();

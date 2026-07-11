const { spawn } = require('child_process');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const http = require('http');

/**
 * Servicio para ejecutar SonarQube (Análisis Estático)
 * Clona el repositorio, ejecuta el sonar-scanner vía Docker,
 * espera a que SonarQube procese el análisis y luego obtiene las métricas reales.
 */
class SonarService {

    /**
     * Ejecuta el análisis y devuelve las métricas reales de la API de SonarQube.
     * @param {string} repositoryUrl - URL del repositorio a clonar.
     * @param {string} projectName - Clave del proyecto en SonarQube.
     * @param {Function} logFn - Función de callback para enviar logs al frontend.
     */
    async analyze(repositoryUrl, projectName, logFn = console.log) {
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const runId = uuidv4();
        const repoPath = path.join(tempDir, runId);

        try {
            // --- PASO 1: Clonar repositorio ---
            logFn(`[SonarQube] Iniciando análisis estático...`);
            logFn(`[SonarQube] Clonando repositorio: ${repositoryUrl}`);
            execSync(`git clone --depth=1 ${repositoryUrl} "${repoPath}"`, { stdio: 'pipe' });
            logFn(`[SonarQube] Repositorio clonado correctamente.`);

            // --- PASO 2: Ejecutar sonar-scanner en Docker ---
            logFn(`[SonarQube] Lanzando sonar-scanner-cli en Docker...`);
            const sonarHost = 'http://host.docker.internal:9000';
            const normalizedPath = repoPath.replace(/\\/g, '/');
            const dockerCmd = [
                'run', '--rm',
                '-v', `${normalizedPath}:/usr/src`,
                'sonarsource/sonar-scanner-cli',
                `-Dsonar.projectKey=${projectName}`,
                `-Dsonar.projectName=${projectName}`,
                `-Dsonar.sources=.`,
                `-Dsonar.host.url=${sonarHost}`,
                `-Dsonar.login=admin`,
                `-Dsonar.password=admin`,
                `-Dsonar.scm.disabled=true`
            ];

            await this._runDockerWithLogs('docker', dockerCmd, logFn, '[SonarQube Scanner]');
            logFn(`[SonarQube] Scanner finalizado. Esperando procesamiento en servidor...`);

            // --- PASO 3: Esperar a que SonarQube procese el reporte (hasta 60s) ---
            const taskStatus = await this._waitForSonarAnalysis(projectName, logFn);
            if (taskStatus !== 'SUCCESS') {
                logFn(`[SonarQube] ⚠️ El análisis finalizó con estado: ${taskStatus}`);
            } else {
                logFn(`[SonarQube] ✅ Análisis procesado correctamente por SonarQube.`);
            }

            // --- PASO 4: Obtener métricas reales de la API ---
            logFn(`[SonarQube] Consultando métricas desde la API...`);
            const metricas = await this._fetchMetrics(projectName);
            logFn(`[SonarQube] Métricas obtenidas: Bugs=${metricas.bugs}, Smells=${metricas.code_smells}, Complejidad=${metricas.complexity}, Duplicación=${metricas.duplicated_lines_density}%`);
            logFn(`[SonarQube] ✅ Análisis completado exitosamente.`);

            return {
                status: 'success',
                projectKey: projectName,
                data: metricas
            };

        } catch (error) {
            logFn(`[SonarQube] ❌ Error durante el análisis: ${error.message}`);
            return { status: 'error', data: {}, message: error.message };
        } finally {
            try {
                if (fs.existsSync(repoPath)) {
                    fs.rmSync(repoPath, { recursive: true, force: true });
                    logFn(`[SonarQube] Directorio temporal limpiado.`);
                }
            } catch (err) {
                logFn(`[SonarQube] ⚠️ No se pudo limpiar directorio temporal: ${err.message}`);
            }
        }
    }

    /**
     * Espera hasta 90 segundos a que SonarQube procese el último análisis del proyecto.
     */
    async _waitForSonarAnalysis(projectName, logFn) {
        const maxWait = 90000; // 90 segundos
        const interval = 3000;
        const start = Date.now();

        while (Date.now() - start < maxWait) {
            await new Promise(r => setTimeout(r, interval));
            try {
                const taskData = await this._sonarGet(`/api/ce/component?component=${projectName}`);
                const current = taskData.current;
                if (current) {
                    logFn(`[SonarQube] Estado del análisis: ${current.status}...`);
                    if (current.status === 'SUCCESS' || current.status === 'FAILED' || current.status === 'CANCELED') {
                        return current.status;
                    }
                }
            } catch (e) {
                // Ignorar errores de polling
            }
        }
        return 'TIMEOUT';
    }

    /**
     * Obtiene las métricas reales del proyecto desde la API de SonarQube.
     */
    async _fetchMetrics(projectName) {
        const metricKeys = 'bugs,vulnerabilities,code_smells,complexity,duplicated_lines_density,coverage,reliability_rating,security_rating,sqale_rating';
        const data = await this._sonarGet(`/api/measures/component?component=${projectName}&metricKeys=${metricKeys}`);

        const measures = data.component && data.component.measures ? data.component.measures : [];
        const get = (key) => {
            const m = measures.find(m => m.metric === key);
            return m ? parseFloat(m.value) || 0 : null;
        };

        return {
            bugs:                      get('bugs')                      ?? 0,
            vulnerabilities:           get('vulnerabilities')           ?? 0,
            code_smells:               get('code_smells')               ?? 0,
            complexity:                get('complexity')                ?? 0,
            duplicated_lines_density:  get('duplicated_lines_density')  ?? 0,
            coverage:                  get('coverage'),        // null si no hay tests configurados
            reliability_rating:        get('reliability_rating')        ?? 5, // 1=A … 5=E
            sqale_rating:              get('sqale_rating')              ?? 5, // 1=A … 5=E
        };
    }

    /**
     * Helper para hacer llamadas GET a la API de SonarQube.
     */
    _sonarGet(path) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 9000,
                path: path,
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64')
                },
                timeout: 10000
            };
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error(`Respuesta inválida de SonarQube: ${data.substring(0, 200)}`)); }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout conectando a SonarQube')); });
            req.end();
        });
    }

    /**
     * Ejecuta un proceso y va emitiendo sus logs línea a línea via logFn.
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
            proc.on('close', (code) => {
                if (code === 0 || code === null) resolve(code);
                else reject(new Error(`Proceso Docker finalizó con código ${code}`));
            });
            proc.on('error', reject);
        });
    }
}

module.exports = new SonarService();

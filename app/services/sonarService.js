const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Servicio para ejecutar SonarQube (Análisis Estático)
 * Clona el repositorio y ejecuta el sonar-scanner vía Docker.
 */
class SonarService {
    async analyze(repositoryUrl, projectName) {
        // Directorio temporal para clonar
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const runId = uuidv4();
        const repoPath = path.join(tempDir, runId);

        try {
            console.log(`[SonarService] Clonando repositorio: ${repositoryUrl}...`);
            execSync(`git clone ${repositoryUrl} "${repoPath}"`, { stdio: 'inherit' });

            console.log(`[SonarService] Ejecutando Sonar Scanner en Docker...`);
            // Se utiliza host.docker.internal para alcanzar el SonarQube hosteado en la misma máquina
            const sonarHost = 'http://host.docker.internal:9000';
            
            // Reemplazamos las barras invertidas por barras normales para el volumen de Docker en Windows
            const normalizedPath = repoPath.replace(/\\/g, '/');

            const dockerCmd = `docker run --rm -v "${normalizedPath}:/usr/src" sonarsource/sonar-scanner-cli -Dsonar.projectKey=${projectName} -Dsonar.sources=. -Dsonar.host.url=${sonarHost} -Dsonar.login=admin -Dsonar.password=admin`;
            
            execSync(dockerCmd, { stdio: 'inherit' });
            console.log(`[SonarService] Análisis de SonarQube finalizado para ${projectName}`);
            
            return {
                status: 'success',
                projectKey: projectName,
                message: 'Análisis enviado a SonarQube. Los resultados se procesarán desde la API.'
            };
        } catch (error) {
            console.error(`[SonarService] Error durante el análisis:`, error.message);
            return {
                status: 'error',
                message: error.message
            };
        } finally {
            // Limpieza del directorio temporal
            try {
                if (fs.existsSync(repoPath)) {
                    fs.rmSync(repoPath, { recursive: true, force: true });
                }
            } catch (err) {
                console.error(`[SonarService] No se pudo limpiar el directorio temporal: ${err.message}`);
            }
        }
    }
}

module.exports = new SonarService();

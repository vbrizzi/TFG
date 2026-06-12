/**
 * Motor de Normalización (Scoring Engine)
 * Procesa los reportes de SonarQube, OWASP ZAP y k6, calculando 
 * métricas normalizadas (0 a 100) y el Índice General de Calidad.
 */
class Evaluator {
    
    /**
     * Evalúa los datos de SonarQube.
     * Ejemplo básico: restamos puntos por cada issue mayor/crítico.
     */
    evaluateSonar(sonarData) {
        let score = 100;
        if (!sonarData) return score;

        // Si tuviéramos data estructurada de SonarQube, restaríamos así:
        // const criticalIssues = sonarData.critical || 0;
        // const majorIssues = sonarData.major || 0;
        // score -= (criticalIssues * 5) + (majorIssues * 2);
        
        return Math.max(0, score);
    }

    /**
     * Evalúa los datos de OWASP ZAP.
     * Resta puntos según el nivel de riesgo de las alertas.
     */
    evaluateZap(zapData) {
        let score = 100;
        if (!zapData || !zapData.site || zapData.site.length === 0) return score;

        const alerts = zapData.site[0].alerts || [];
        alerts.forEach(alert => {
            const risk = parseInt(alert.riskcode);
            // riskcode: 3 (High), 2 (Medium), 1 (Low), 0 (Info)
            if (risk === 3) score -= 15;
            else if (risk === 2) score -= 5;
            else if (risk === 1) score -= 2;
        });

        return Math.max(0, score);
    }

    /**
     * Evalúa los datos de k6.
     * Resta puntos si el tiempo de respuesta p95 supera un umbral (ej. 500ms).
     */
    evaluateK6(k6Data) {
        let score = 100;
        if (!k6Data || !k6Data.metrics || !k6Data.metrics.http_req_duration || !k6Data.metrics.http_req_duration.values) return score;

        const p95Duration = k6Data.metrics.http_req_duration.values['p(95)'];
        if (!p95Duration) return score;
        
        // Si el p95 es mayor a 500ms, empezamos a restar puntos
        if (p95Duration > 500) {
            const penalty = Math.floor((p95Duration - 500) / 50); // Resta 1 punto por cada 50ms extra
            score -= penalty;
        }

        return Math.max(0, score);
    }

    /**
     * Consolida todas las herramientas en un puntaje final.
     */
    calculateGlobalIndex(sonarScore, zapScore, k6Score) {
        // Promedio simple, pero aquí se podrían aplicar pesos (ej. ZAP más peso en Seguridad)
        const total = (sonarScore + zapScore + k6Score) / 3;
        return parseFloat(total.toFixed(2));
    }

    /**
     * Función principal del motor de scoring.
     */
    processReports(sonarData, zapData, k6Data) {
        const qualityScore = this.evaluateSonar(sonarData);
        const securityScore = this.evaluateZap(zapData);
        const performanceScore = this.evaluateK6(k6Data);

        const globalIndex = this.calculateGlobalIndex(qualityScore, securityScore, performanceScore);

        return {
            quality: qualityScore,
            security: securityScore,
            performance: performanceScore,
            global: globalIndex
        };
    }
}

module.exports = new Evaluator();

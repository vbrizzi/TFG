/**
 * Motor de Normalización (Scoring Engine)
 * Procesa los reportes de SonarQube, OWASP ZAP y k6, calculando 
 * métricas normalizadas (0 a 100), hallazgos individuales y el Índice General de Calidad.
 * 
 * Corresponde a CU-04: Procesar resultados y calcular scoring (RF06, RF07, RF08, RF09)
 */
class Evaluator {

    /**
     * Evalúa los datos de SonarQube (Mantenibilidad).
     * Retorna: { score, hallazgos[], metricas[] }
     */
    evaluateSonar(sonarData) {
        let score = 100;
        const hallazgos = [];
        const metricas = [];

        if (!sonarData || Object.keys(sonarData).length === 0) {
            return { score, hallazgos, metricas };
        }

        // Si tenemos datos de la API de SonarQube
        const bugs = sonarData.bugs || 0;
        const vulnerabilities = sonarData.vulnerabilities || 0;
        const codeSmells = sonarData.code_smells || 0;
        const complexity = sonarData.complexity || 0;
        const duplicatedDensity = sonarData.duplicated_lines_density || 0;
        const coverage = sonarData.coverage || 0;

        // Penalizaciones
        score -= bugs * 10;
        score -= vulnerabilities * 8;
        score -= codeSmells * 1;
        if (complexity > 10) score -= (complexity - 10) * 2;
        if (duplicatedDensity > 5) score -= (duplicatedDensity - 5) * 3;

        score = Math.max(0, Math.min(100, score));

        // Métricas individuales
        metricas.push(
            { nombre: 'Bugs', valor: bugs, valorNormalizado: Math.max(0, 100 - bugs * 10), unidad: 'count', categoria: 'MANTENIBILIDAD' },
            { nombre: 'Code Smells', valor: codeSmells, valorNormalizado: Math.max(0, 100 - codeSmells), unidad: 'count', categoria: 'MANTENIBILIDAD' },
            { nombre: 'Complejidad Ciclomática', valor: complexity, valorNormalizado: complexity <= 10 ? 100 : Math.max(0, 100 - (complexity - 10) * 5), unidad: 'avg', categoria: 'MANTENIBILIDAD' },
            { nombre: 'Duplicación de Código', valor: duplicatedDensity, valorNormalizado: duplicatedDensity <= 5 ? 100 : Math.max(0, 100 - (duplicatedDensity - 5) * 10), unidad: '%', categoria: 'MANTENIBILIDAD' },
            { nombre: 'Cobertura de Tests', valor: coverage, valorNormalizado: coverage, unidad: '%', categoria: 'MANTENIBILIDAD' }
        );

        // Hallazgos
        if (bugs > 0) {
            hallazgos.push({ severidad: 'ALTO', categoria: 'MANTENIBILIDAD', descripcion: `${bugs} bug(s) detectado(s) en el código`, recomendacion: 'Corregir los bugs reportados por SonarQube.' });
        }
        if (codeSmells > 5) {
            hallazgos.push({ severidad: 'MEDIO', categoria: 'MANTENIBILIDAD', descripcion: `${codeSmells} code smells detectados`, recomendacion: 'Refactorizar el código para reducir los code smells.' });
        } else if (codeSmells > 0) {
            hallazgos.push({ severidad: 'BAJO', categoria: 'MANTENIBILIDAD', descripcion: `${codeSmells} code smell(s) detectado(s)`, recomendacion: 'Revisar y considerar refactorización.' });
        }
        if (complexity > 10) {
            hallazgos.push({ severidad: 'MEDIO', categoria: 'MANTENIBILIDAD', descripcion: `Complejidad ciclomática elevada (${complexity})`, recomendacion: 'Simplificar funciones con complejidad mayor a 10.' });
        }
        if (duplicatedDensity > 5) {
            hallazgos.push({ severidad: 'MEDIO', categoria: 'MANTENIBILIDAD', descripcion: `Duplicación de código: ${duplicatedDensity}%`, recomendacion: 'Extraer código duplicado a funciones reutilizables.' });
        }

        return { score, hallazgos, metricas };
    }

    /**
     * Evalúa los datos de OWASP ZAP (Seguridad).
     * Resta puntos según el nivel de riesgo de las alertas.
     * Retorna: { score, hallazgos[], metricas[] }
     */
    evaluateZap(zapData) {
        let score = 100;
        const hallazgos = [];
        const metricas = [];

        if (!zapData || Object.keys(zapData).length === 0) {
            return { score, hallazgos, metricas };
        }

        // ZAP puede devolver datos en formato site[] (JSON report) 
        const sites = zapData.site || [];
        let highCount = 0, mediumCount = 0, lowCount = 0, infoCount = 0;

        for (const site of sites) {
            const alerts = site.alerts || [];
            for (const alert of alerts) {
                const risk = parseInt(alert.riskcode);
                const instances = (alert.instances || []).length || 1;

                if (risk === 3) {
                    highCount++;
                    score -= 15;
                    hallazgos.push({
                        severidad: 'ALTO',
                        categoria: 'SEGURIDAD',
                        descripcion: alert.name || alert.alert || 'Vulnerabilidad de riesgo alto',
                        recomendacion: alert.solution || 'Aplicar las correcciones recomendadas por OWASP ZAP.'
                    });
                } else if (risk === 2) {
                    mediumCount++;
                    score -= 5;
                    hallazgos.push({
                        severidad: 'MEDIO',
                        categoria: 'SEGURIDAD',
                        descripcion: alert.name || alert.alert || 'Vulnerabilidad de riesgo medio',
                        recomendacion: alert.solution || 'Revisar y corregir.'
                    });
                } else if (risk === 1) {
                    lowCount++;
                    score -= 2;
                    hallazgos.push({
                        severidad: 'BAJO',
                        categoria: 'SEGURIDAD',
                        descripcion: alert.name || alert.alert || 'Hallazgo de riesgo bajo',
                        recomendacion: alert.solution || 'Considerar corrección.'
                    });
                } else {
                    infoCount++;
                    hallazgos.push({
                        severidad: 'INFO',
                        categoria: 'SEGURIDAD',
                        descripcion: alert.name || alert.alert || 'Información',
                        recomendacion: alert.solution || null
                    });
                }
            }
        }

        score = Math.max(0, score);

        metricas.push(
            { nombre: 'Vulnerabilidades Altas', valor: highCount, valorNormalizado: highCount === 0 ? 100 : Math.max(0, 100 - highCount * 25), unidad: 'count', categoria: 'SEGURIDAD' },
            { nombre: 'Vulnerabilidades Medias', valor: mediumCount, valorNormalizado: mediumCount <= 3 ? 100 : Math.max(0, 100 - mediumCount * 10), unidad: 'count', categoria: 'SEGURIDAD' },
            { nombre: 'Vulnerabilidades Bajas', valor: lowCount, valorNormalizado: 100, unidad: 'count', categoria: 'SEGURIDAD' },
            { nombre: 'Alertas Informativas', valor: infoCount, valorNormalizado: 100, unidad: 'count', categoria: 'SEGURIDAD' }
        );

        return { score, hallazgos, metricas };
    }

    /**
     * Evalúa los datos de k6 (Rendimiento).
     * Resta puntos si el tiempo de respuesta p95 supera un umbral (500ms).
     * Retorna: { score, hallazgos[], metricas[] }
     */
    evaluateK6(k6Data) {
        let score = 100;
        const hallazgos = [];
        const metricas = [];

        if (!k6Data || !k6Data.metrics || Object.keys(k6Data.metrics).length === 0) {
            return { score, hallazgos, metricas };
        }

        const httpDuration = k6Data.metrics.http_req_duration;
        const httpReqFailed = k6Data.metrics.http_req_failed;
        const httpReqs = k6Data.metrics.http_reqs;

        // Tiempo de respuesta p95
        let p95 = null;
        if (httpDuration && httpDuration.values) {
            p95 = httpDuration.values['p(95)'];
            const avg = httpDuration.values['avg'];
            const med = httpDuration.values['med'];

            if (p95 !== null && p95 !== undefined) {
                if (p95 > 500) {
                    const penalty = Math.floor((p95 - 500) / 50);
                    score -= penalty;
                    hallazgos.push({
                        severidad: p95 > 2000 ? 'ALTO' : p95 > 1000 ? 'MEDIO' : 'BAJO',
                        categoria: 'RENDIMIENTO',
                        descripcion: `Tiempo de respuesta p95: ${p95.toFixed(0)}ms (umbral: 500ms)`,
                        recomendacion: 'Optimizar los endpoints con mayor latencia.'
                    });
                }

                metricas.push(
                    { nombre: 'Tiempo respuesta p95', valor: parseFloat(p95.toFixed(2)), valorNormalizado: p95 <= 500 ? 100 : Math.max(0, 100 - Math.floor((p95 - 500) / 50)), unidad: 'ms', categoria: 'RENDIMIENTO' },
                    { nombre: 'Tiempo respuesta promedio', valor: parseFloat((avg || 0).toFixed(2)), valorNormalizado: (avg || 0) <= 300 ? 100 : Math.max(0, 100 - Math.floor(((avg || 0) - 300) / 30)), unidad: 'ms', categoria: 'RENDIMIENTO' },
                    { nombre: 'Tiempo respuesta mediana', valor: parseFloat((med || 0).toFixed(2)), valorNormalizado: null, unidad: 'ms', categoria: 'RENDIMIENTO' }
                );
            }
        }

        // Tasa de error
        if (httpReqFailed && httpReqFailed.values) {
            const errorRate = httpReqFailed.values.rate || 0;
            const errorPct = parseFloat((errorRate * 100).toFixed(2));

            if (errorPct > 1) {
                score -= Math.floor(errorPct * 5);
                hallazgos.push({
                    severidad: errorPct > 10 ? 'ALTO' : 'MEDIO',
                    categoria: 'RENDIMIENTO',
                    descripcion: `Tasa de error: ${errorPct}% (umbral: 1%)`,
                    recomendacion: 'Investigar las causas de los errores HTTP.'
                });
            }

            metricas.push(
                { nombre: 'Tasa de error', valor: errorPct, valorNormalizado: errorPct <= 1 ? 100 : Math.max(0, 100 - errorPct * 10), unidad: '%', categoria: 'RENDIMIENTO' }
            );
        }

        // Requests por segundo
        if (httpReqs && httpReqs.values) {
            metricas.push(
                { nombre: 'Requests por segundo', valor: parseFloat((httpReqs.values.rate || 0).toFixed(2)), valorNormalizado: null, unidad: 'req/s', categoria: 'RENDIMIENTO' }
            );
        }

        score = Math.max(0, score);

        return { score, hallazgos, metricas };
    }

    /**
     * Consolida todas las herramientas en un puntaje final.
     */
    calculateGlobalIndex(sonarScore, zapScore, k6Score) {
        const total = (sonarScore + zapScore + k6Score) / 3;
        return parseFloat(total.toFixed(2));
    }

    /**
     * Función principal del motor de scoring.
     * Retorna un objeto enriquecido con scores, hallazgos y métricas.
     */
    processReports(sonarData, zapData, k6Data) {
        const sonarResult = this.evaluateSonar(sonarData);
        const zapResult = this.evaluateZap(zapData);
        const k6Result = this.evaluateK6(k6Data);

        const globalIndex = this.calculateGlobalIndex(sonarResult.score, zapResult.score, k6Result.score);

        return {
            scores: {
                quality: sonarResult.score,
                security: zapResult.score,
                performance: k6Result.score,
                global: globalIndex
            },
            hallazgos: [
                ...sonarResult.hallazgos,
                ...zapResult.hallazgos,
                ...k6Result.hallazgos
            ],
            metricas: [
                ...sonarResult.metricas,
                ...zapResult.metricas,
                ...k6Result.metricas
            ]
        };
    }
}

module.exports = new Evaluator();

/**
 * Motor de Normalización (Scoring Engine)
 * Procesa los reportes de SonarQube, OWASP ZAP y k6, calculando
 * métricas normalizadas (0 a 100), hallazgos individuales y el Índice General de Calidad.
 *
 * Corresponde a CU-04: Procesar resultados y calcular scoring (RF06, RF07, RF08, RF09)
 */
class Evaluator {

    // ─────────────────────────────────────────────────────────────────────────
    // SONARQUBE — Mantenibilidad
    // Fórmula: promedio de ratings internos de SonarQube (reliability + sqale)
    // mapeados a la escala A-E, más penalidades por duplicación y cobertura.
    // ─────────────────────────────────────────────────────────────────────────
    evaluateSonar(sonarData) {
        let score = 100;
        const hallazgos = [];
        const metricas  = [];

        if (!sonarData || Object.keys(sonarData).length === 0) {
            return { score, hallazgos, metricas };
        }

        const bugs                 = sonarData.bugs                    || 0;
        const vulnerabilities      = sonarData.vulnerabilities         || 0;
        const codeSmells           = sonarData.code_smells             || 0;
        const complexity           = sonarData.complexity              || 0;
        const duplicatedDensity    = sonarData.duplicated_lines_density || 0;
        const coverage             = sonarData.coverage;               // puede ser null
        const reliabilityRating    = sonarData.reliability_rating      || 5;
        const sqaleRating          = sonarData.sqale_rating            || 5;

        // ── Mapeo rating interno SonarQube (1=A … 5=E) → score 0-100 ─────────
        const ratingToScore = (r) => ({ 1: 100, 2: 80, 3: 60, 4: 40, 5: 20 }[Math.round(r)] ?? 20);

        const reliabilityScore = ratingToScore(reliabilityRating);
        const sqaleScore       = ratingToScore(sqaleRating);

        // Base = promedio ponderado (50% fiabilidad + 50% deuda técnica)
        score = reliabilityScore * 0.5 + sqaleScore * 0.5;

        // ── Penalidades extra ─────────────────────────────────────────────────
        if (duplicatedDensity > 40) {
            score -= 10;
        } else if (duplicatedDensity > 20) {
            score -= 5;
        }

        if (coverage !== null && coverage !== undefined) {
            if (coverage === 0) {
                score -= 10;
            } else if (coverage < 20) {
                score -= 5;
            }
        }

        score = Math.round(Math.max(0, Math.min(100, score)));

        // ── Métricas individuales ─────────────────────────────────────────────
        metricas.push(
            {
                nombre: 'Rating Fiabilidad',
                valor: reliabilityRating,
                valorNormalizado: reliabilityScore,
                unidad: 'rating',
                categoria: 'MANTENIBILIDAD'
            },
            {
                nombre: 'Rating Mantenibilidad',
                valor: sqaleRating,
                valorNormalizado: sqaleScore,
                unidad: 'rating',
                categoria: 'MANTENIBILIDAD'
            },
            {
                nombre: 'Bugs',
                valor: bugs,
                valorNormalizado: Math.max(0, 100 - bugs * 5),
                unidad: 'count',
                categoria: 'MANTENIBILIDAD'
            },
            {
                nombre: 'Code Smells',
                valor: codeSmells,
                valorNormalizado: Math.max(0, 100 - Math.log10(codeSmells + 1) * 30),
                unidad: 'count',
                categoria: 'MANTENIBILIDAD'
            },
            {
                nombre: 'Complejidad Ciclomática',
                valor: complexity,
                valorNormalizado: complexity <= 10 ? 100 : Math.max(0, 100 - Math.log10(complexity) * 30),
                unidad: 'total',
                categoria: 'MANTENIBILIDAD'
            },
            {
                nombre: 'Duplicación de Código',
                valor: duplicatedDensity,
                valorNormalizado: duplicatedDensity <= 5 ? 100 : Math.max(0, 100 - duplicatedDensity * 1.5),
                unidad: '%',
                categoria: 'MANTENIBILIDAD'
            },
            {
                nombre: 'Cobertura de Tests',
                valor: coverage ?? 0,
                valorNormalizado: coverage ?? 0,
                unidad: '%',
                categoria: 'MANTENIBILIDAD'
            }
        );

        // ── Hallazgos ─────────────────────────────────────────────────────────
        const ratingLabel = (r) => ({ 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' }[Math.round(r)] ?? 'E');

        if (reliabilityRating >= 4) {
            hallazgos.push({
                severidad: reliabilityRating === 5 ? 'ALTO' : 'MEDIO',
                categoria: 'MANTENIBILIDAD',
                descripcion: `Rating de fiabilidad: ${ratingLabel(reliabilityRating)} (${bugs} bugs detectados)`,
                recomendacion: 'Corregir los bugs reportados por SonarQube para mejorar la fiabilidad.'
            });
        } else if (bugs > 0) {
            hallazgos.push({
                severidad: 'BAJO',
                categoria: 'MANTENIBILIDAD',
                descripcion: `${bugs} bug(s) detectado(s) — Rating ${ratingLabel(reliabilityRating)}`,
                recomendacion: 'Revisar y corregir los bugs reportados por SonarQube.'
            });
        }

        if (sqaleRating >= 4) {
            hallazgos.push({
                severidad: sqaleRating === 5 ? 'ALTO' : 'MEDIO',
                categoria: 'MANTENIBILIDAD',
                descripcion: `Deuda técnica elevada — Rating ${ratingLabel(sqaleRating)} (${codeSmells} code smells)`,
                recomendacion: 'Refactorizar el código para reducir la deuda técnica.'
            });
        } else if (codeSmells > 5) {
            hallazgos.push({
                severidad: 'BAJO',
                categoria: 'MANTENIBILIDAD',
                descripcion: `${codeSmells} code smells detectados — Rating ${ratingLabel(sqaleRating)}`,
                recomendacion: 'Revisar y considerar refactorización progresiva.'
            });
        }

        if (duplicatedDensity > 40) {
            hallazgos.push({
                severidad: 'MEDIO',
                categoria: 'MANTENIBILIDAD',
                descripcion: `Duplicación de código crítica: ${duplicatedDensity.toFixed(1)}%`,
                recomendacion: 'Extraer bloques duplicados a funciones o módulos reutilizables.'
            });
        } else if (duplicatedDensity > 20) {
            hallazgos.push({
                severidad: 'BAJO',
                categoria: 'MANTENIBILIDAD',
                descripcion: `Duplicación de código elevada: ${duplicatedDensity.toFixed(1)}%`,
                recomendacion: 'Considerar refactorización para reducir la duplicación.'
            });
        }

        if (coverage !== null && coverage < 20) {
            hallazgos.push({
                severidad: 'BAJO',
                categoria: 'MANTENIBILIDAD',
                descripcion: `Cobertura de tests baja: ${(coverage ?? 0).toFixed(1)}%`,
                recomendacion: 'Implementar tests unitarios para aumentar la cobertura.'
            });
        }

        return { score, hallazgos, metricas };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OWASP ZAP — Seguridad
    // Fórmula: basada en la presencia de alertas según severidad.
    // Si hay alertas HIGH → score capado en 50 (máximo), con penalidades adicionales.
    // Si solo hay MEDIUM/LOW → penalidades progresivas desde 100.
    // ─────────────────────────────────────────────────────────────────────────
    evaluateZap(zapData) {
        const hallazgos = [];
        const metricas  = [];

        if (!zapData || Object.keys(zapData).length === 0) {
            return { score: 100, hallazgos, metricas };
        }

        const sites = zapData.site || [];
        let highCount = 0, mediumCount = 0, lowCount = 0, infoCount = 0;

        for (const site of sites) {
            const alerts = site.alerts || [];
            for (const alert of alerts) {
                const risk = parseInt(alert.riskcode);

                if (risk === 3) {
                    highCount++;
                    hallazgos.push({
                        severidad: 'ALTO',
                        categoria: 'SEGURIDAD',
                        descripcion: alert.name || 'Vulnerabilidad de riesgo alto',
                        recomendacion: alert.solution || 'Aplicar las correcciones recomendadas por OWASP ZAP.'
                    });
                } else if (risk === 2) {
                    mediumCount++;
                    hallazgos.push({
                        severidad: 'MEDIO',
                        categoria: 'SEGURIDAD',
                        descripcion: alert.name || 'Vulnerabilidad de riesgo medio',
                        recomendacion: alert.solution || 'Revisar y corregir.'
                    });
                } else if (risk === 1) {
                    lowCount++;
                    hallazgos.push({
                        severidad: 'BAJO',
                        categoria: 'SEGURIDAD',
                        descripcion: alert.name || 'Hallazgo de riesgo bajo',
                        recomendacion: alert.solution || 'Considerar corrección.'
                    });
                } else {
                    infoCount++;
                    hallazgos.push({
                        severidad: 'INFO',
                        categoria: 'SEGURIDAD',
                        descripcion: alert.name || 'Información',
                        recomendacion: alert.solution || null
                    });
                }
            }
        }

        // ── Cálculo de score ──────────────────────────────────────────────────
        let score;

        if (highCount > 0) {
            // Presencia de vulnerabilidades ALTAS: score máximo 50
            // Cada HIGH adicional al primero resta 5 pts (piso en 5)
            score = 50 - (highCount - 1) * 5;
            score = Math.max(5, score);
            // Penalidades adicionales por MEDIUM y LOW (más suaves en este contexto)
            score -= mediumCount * 3;
            score -= lowCount * 1;
        } else {
            // Sin HIGH: escala completa 0-100
            score = 100;
            score -= mediumCount * 7;
            score -= lowCount  * 2;
        }

        score = Math.round(Math.max(0, Math.min(100, score)));

        // ── Métricas ──────────────────────────────────────────────────────────
        metricas.push(
            {
                nombre: 'Vulnerabilidades Altas',
                valor: highCount,
                valorNormalizado: highCount === 0 ? 100 : Math.max(0, 100 - highCount * 25),
                unidad: 'count',
                categoria: 'SEGURIDAD'
            },
            {
                nombre: 'Vulnerabilidades Medias',
                valor: mediumCount,
                valorNormalizado: mediumCount === 0 ? 100 : Math.max(0, 100 - mediumCount * 10),
                unidad: 'count',
                categoria: 'SEGURIDAD'
            },
            {
                nombre: 'Vulnerabilidades Bajas',
                valor: lowCount,
                valorNormalizado: lowCount === 0 ? 100 : Math.max(0, 100 - lowCount * 3),
                unidad: 'count',
                categoria: 'SEGURIDAD'
            },
            {
                nombre: 'Alertas Informativas',
                valor: infoCount,
                valorNormalizado: 100,
                unidad: 'count',
                categoria: 'SEGURIDAD'
            }
        );

        return { score, hallazgos, metricas };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // k6 — Rendimiento
    // Fórmula: score = latencia (60%) + error rate (40%)
    // Ambos componentes tienen pendientes suaves para no colapsar el score
    // ante valores moderados fuera del umbral.
    // ─────────────────────────────────────────────────────────────────────────
    evaluateK6(k6Data) {
        const hallazgos = [];
        const metricas  = [];

        if (!k6Data || !k6Data.metrics || Object.keys(k6Data.metrics).length === 0) {
            return { score: 100, hallazgos, metricas };
        }

        const httpDuration  = k6Data.metrics.http_req_duration;
        const httpReqFailed = k6Data.metrics.http_req_failed;
        const httpReqs      = k6Data.metrics.http_reqs;

        // ── Score de latencia (60%) ───────────────────────────────────────────
        let latencyScore = 100;
        let p95 = null, avgDuration = null, medDuration = null;

        if (httpDuration && httpDuration.values) {
            p95         = httpDuration.values['p(95)'] ?? null;
            avgDuration = httpDuration.values['avg']   ?? null;
            medDuration = httpDuration.values['med']   ?? null;

            if (p95 !== null) {
                if (p95 <= 300) {
                    latencyScore = 100;
                } else if (p95 <= 500) {
                    // 300-500ms: suave degradación 100→90
                    latencyScore = 100 - ((p95 - 300) / 200) * 10;
                } else if (p95 <= 1000) {
                    // 500-1000ms: umbral roto, degradación 90→70
                    latencyScore = 90 - ((p95 - 500) / 500) * 20;
                } else if (p95 <= 2000) {
                    // 1000-2000ms: degradación seria 70→50
                    latencyScore = 70 - ((p95 - 1000) / 1000) * 20;
                } else {
                    // >2000ms: nunca baja de 20
                    latencyScore = Math.max(20, 50 - ((p95 - 2000) / 2000) * 30);
                }

                // Hallazgo si umbral roto (p95 > 500ms)
                if (p95 > 500) {
                    hallazgos.push({
                        severidad: p95 > 2000 ? 'ALTO' : p95 > 1000 ? 'MEDIO' : 'BAJO',
                        categoria: 'RENDIMIENTO',
                        descripcion: `Tiempo de respuesta p95: ${p95.toFixed(0)}ms (umbral: 500ms)`,
                        recomendacion: 'Optimizar los endpoints con mayor latencia.'
                    });
                }
            }

            metricas.push(
                {
                    nombre: 'Tiempo respuesta p95',
                    valor: p95 !== null ? parseFloat(p95.toFixed(2)) : 0,
                    valorNormalizado: Math.round(latencyScore),
                    unidad: 'ms',
                    categoria: 'RENDIMIENTO'
                },
                {
                    nombre: 'Tiempo respuesta promedio',
                    valor: avgDuration !== null ? parseFloat(avgDuration.toFixed(2)) : 0,
                    valorNormalizado: null,
                    unidad: 'ms',
                    categoria: 'RENDIMIENTO'
                },
                {
                    nombre: 'Tiempo respuesta mediana',
                    valor: medDuration !== null ? parseFloat(medDuration.toFixed(2)) : 0,
                    valorNormalizado: null,
                    unidad: 'ms',
                    categoria: 'RENDIMIENTO'
                }
            );
        }

        // ── Score de error rate (40%) ─────────────────────────────────────────
        let errorScore = 100;
        let errorPct   = 0;

        if (httpReqFailed && httpReqFailed.values) {
            const errorRate = httpReqFailed.values.rate || 0;
            errorPct = parseFloat((errorRate * 100).toFixed(2));

            if (errorRate <= 0.005) {
                errorScore = 100;
            } else if (errorRate <= 0.01) {
                // 0.5-1%: casi perfecto, dentro del umbral técnico
                errorScore = 95;
            } else if (errorRate <= 0.05) {
                // 1-5%: lineal 95→75
                errorScore = 95 - ((errorRate - 0.01) / 0.04) * 20;
            } else if (errorRate <= 0.20) {
                // 5-20%: lineal 75→30
                errorScore = 75 - ((errorRate - 0.05) / 0.15) * 45;
            } else {
                // >20%: piso en 10
                errorScore = Math.max(10, 30 - ((errorRate - 0.20) / 0.80) * 20);
            }

            if (errorPct > 1) {
                hallazgos.push({
                    severidad: errorPct > 10 ? 'ALTO' : 'MEDIO',
                    categoria: 'RENDIMIENTO',
                    descripcion: `Tasa de error: ${errorPct}% (umbral: 1%)`,
                    recomendacion: 'Investigar las causas de los errores HTTP en los endpoints evaluados.'
                });
            }

            metricas.push({
                nombre: 'Tasa de error',
                valor: errorPct,
                valorNormalizado: Math.round(errorScore),
                unidad: '%',
                categoria: 'RENDIMIENTO'
            });
        }

        // ── Score final ponderado ─────────────────────────────────────────────
        const score = Math.round(Math.max(0, latencyScore * 0.6 + errorScore * 0.4));

        // Requests por segundo (métrica informativa, no impacta score)
        if (httpReqs && httpReqs.values) {
            metricas.push({
                nombre: 'Requests por segundo',
                valor: parseFloat((httpReqs.values.rate || 0).toFixed(2)),
                valorNormalizado: null,
                unidad: 'req/s',
                categoria: 'RENDIMIENTO'
            });
        }

        return { score, hallazgos, metricas };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ÍNDICE GLOBAL
    // ─────────────────────────────────────────────────────────────────────────
    calculateGlobalIndex(sonarScore, zapScore, k6Score) {
        // Ponderación: Seguridad 40%, Mantenibilidad 35%, Rendimiento 25%
        const global = sonarScore * 0.35 + zapScore * 0.40 + k6Score * 0.25;
        return Math.round(global);
    }

    /**
     * Función principal del motor de scoring.
     * Retorna un objeto enriquecido con scores, hallazgos y métricas.
     */
    processReports(sonarData, zapData, k6Data) {
        const sonarResult = this.evaluateSonar(sonarData);
        const zapResult   = this.evaluateZap(zapData);
        const k6Result    = this.evaluateK6(k6Data);

        const globalIndex = this.calculateGlobalIndex(
            sonarResult.score,
            zapResult.score,
            k6Result.score
        );

        return {
            scores: {
                quality:     sonarResult.score,
                security:    zapResult.score,
                performance: k6Result.score,
                global:      globalIndex
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

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
    // Ponderación: Seguridad 40%, Mantenibilidad 35%, Rendimiento 25%
    // ─────────────────────────────────────────────────────────────────────────
    calculateGlobalIndex(sonarScore, zapScore, k6Score) {
        const W_MANT = 0.35, W_SEG = 0.40, W_REND = 0.25;
        const global = sonarScore * W_MANT + zapScore * W_SEG + k6Score * W_REND;
        return Math.round(global);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AUDITORÍA — Mantenibilidad (SonarQube)
    // ─────────────────────────────────────────────────────────────────────────
    buildAuditMantenibilidad(sonarData, score) {
        if (!sonarData || Object.keys(sonarData).length === 0) {
            return { omitida: true, motivo: 'Herramienta no ejecutada o sin datos.' };
        }

        const ratingToScore = (r) => ({ 1: 100, 2: 80, 3: 60, 4: 40, 5: 20 }[Math.round(r)] ?? 20);
        const ratingLabel   = (r) => ({ 1: 'A',  2: 'B',  3: 'C',  4: 'D',  5: 'E'  }[Math.round(r)] ?? 'E');

        const relR  = sonarData.reliability_rating      || 5;
        const sqR   = sonarData.sqale_rating            || 5;
        const dupD  = sonarData.duplicated_lines_density || 0;
        const cov   = sonarData.coverage;

        const relScore  = ratingToScore(relR);
        const sqScore   = ratingToScore(sqR);
        const base      = relScore * 0.5 + sqScore * 0.5;

        let penDup = 0;
        if (dupD > 40) penDup = -10;
        else if (dupD > 20) penDup = -5;

        let penCov = 0;
        if (cov !== null && cov !== undefined) {
            if (cov === 0) penCov = -10;
            else if (cov < 20) penCov = -5;
        }

        const pasos = [
            {
                concepto: `Rating Fiabilidad: ${ratingLabel(relR)} → ${relScore}/100`,
                valor_bruto: `${ratingLabel(relR)} (rating interno: ${relR})`,
                peso: '50%',
                aporte: parseFloat((relScore * 0.5).toFixed(2))
            },
            {
                concepto: `Rating Mantenibilidad (SQALE): ${ratingLabel(sqR)} → ${sqScore}/100`,
                valor_bruto: `${ratingLabel(sqR)} (rating interno: ${sqR})`,
                peso: '50%',
                aporte: parseFloat((sqScore * 0.5).toFixed(2))
            },
            {
                concepto: `Base calculada (50%×${relScore} + 50%×${sqScore})`,
                valor_bruto: parseFloat(base.toFixed(2)),
                peso: '—',
                aporte: null
            }
        ];

        if (penDup !== 0) {
            pasos.push({
                concepto: `Penalidad por duplicación de código: ${dupD.toFixed(1)}% ${dupD > 40 ? '(>40%)' : '(>20%)'}`,
                valor_bruto: `${dupD.toFixed(1)}%`,
                peso: '—',
                aporte: penDup
            });
        }
        if (penCov !== 0) {
            pasos.push({
                concepto: `Penalidad por cobertura de tests baja: ${(cov ?? 0).toFixed(1)}%`,
                valor_bruto: `${(cov ?? 0).toFixed(1)}%`,
                peso: '—',
                aporte: penCov
            });
        }

        pasos.push({
            concepto: '✅ Score final Mantenibilidad (acotado 0–100)',
            valor_bruto: score,
            peso: '—',
            aporte: null,
            es_resultado: true
        });

        return {
            omitida: false,
            formula: 'Base = 50%×ScoreFiabilidad + 50%×ScoreMantenibilidad — penalidades por duplicación y cobertura',
            entradas: {
                reliability_rating:       relR,
                sqale_rating:             sqR,
                bugs:                     sonarData.bugs || 0,
                code_smells:              sonarData.code_smells || 0,
                duplicated_lines_density: dupD,
                coverage:                 cov ?? 'N/A'
            },
            pasos
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AUDITORÍA — Seguridad (OWASP ZAP)
    // ─────────────────────────────────────────────────────────────────────────
    buildAuditSeguridad(zapData, score, highCount, mediumCount, lowCount, infoCount) {
        if (!zapData || Object.keys(zapData).length === 0) {
            return { omitida: true, motivo: 'Herramienta no ejecutada o sin datos.' };
        }

        const pasos = [];

        if (highCount > 0) {
            pasos.push({
                concepto: 'Presencia de vulnerabilidades HIGH → score máximo limitado a 50',
                valor_bruto: `${highCount} alerta(s) HIGH`,
                peso: '—',
                aporte: null
            });
            pasos.push({
                concepto: `Score base: 50 − (${highCount}−1)×5`,
                valor_bruto: Math.max(5, 50 - (highCount - 1) * 5),
                peso: '—',
                aporte: null
            });
            if (mediumCount > 0) {
                pasos.push({
                    concepto: `Penalidad adicional por ${mediumCount} alerta(s) MEDIUM (×3 pts c/u)`,
                    valor_bruto: `${mediumCount} alertas`,
                    peso: '—',
                    aporte: -(mediumCount * 3)
                });
            }
            if (lowCount > 0) {
                pasos.push({
                    concepto: `Penalidad adicional por ${lowCount} alerta(s) LOW (×1 pt c/u)`,
                    valor_bruto: `${lowCount} alertas`,
                    peso: '—',
                    aporte: -(lowCount * 1)
                });
            }
        } else {
            pasos.push({
                concepto: 'Sin alertas HIGH → escala completa 0–100',
                valor_bruto: '0 alertas HIGH',
                peso: '—',
                aporte: null
            });
            pasos.push({
                concepto: 'Score base: 100',
                valor_bruto: 100,
                peso: '—',
                aporte: null
            });
            if (mediumCount > 0) {
                pasos.push({
                    concepto: `Penalidad por ${mediumCount} alerta(s) MEDIUM (×7 pts c/u)`,
                    valor_bruto: `${mediumCount} alertas`,
                    peso: '—',
                    aporte: -(mediumCount * 7)
                });
            }
            if (lowCount > 0) {
                pasos.push({
                    concepto: `Penalidad por ${lowCount} alerta(s) LOW (×2 pts c/u)`,
                    valor_bruto: `${lowCount} alertas`,
                    peso: '—',
                    aporte: -(lowCount * 2)
                });
            }
        }

        pasos.push({
            concepto: '✅ Score final Seguridad (acotado 0–100)',
            valor_bruto: score,
            peso: '—',
            aporte: null,
            es_resultado: true
        });

        return {
            omitida: false,
            formula: 'Si hay alertas HIGH: base=50−(n−1)×5, penalidades suaves por MEDIUM/LOW. Sin HIGH: base=100, penalidades por MEDIUM(×7) y LOW(×2).',
            entradas: {
                alertas_high:   highCount,
                alertas_medium: mediumCount,
                alertas_low:    lowCount,
                alertas_info:   infoCount
            },
            pasos
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AUDITORÍA — Rendimiento (k6)
    // ─────────────────────────────────────────────────────────────────────────
    buildAuditRendimiento(k6Data, score, latencyScore, errorScore, p95, errorPct) {
        if (!k6Data || !k6Data.metrics || Object.keys(k6Data.metrics).length === 0) {
            return { omitida: true, motivo: 'Herramienta no ejecutada o sin datos.' };
        }

        const pasos = [
            {
                concepto: `Score de Latencia (p95=${p95 !== null ? p95.toFixed(0)+'ms' : 'N/A'})`,
                valor_bruto: p95 !== null ? `${p95.toFixed(0)} ms` : 'N/A',
                peso: '60%',
                aporte: parseFloat((latencyScore * 0.6).toFixed(2))
            },
            {
                concepto: `Score de Tasa de Error (${errorPct}%)`,
                valor_bruto: `${errorPct}%`,
                peso: '40%',
                aporte: parseFloat((errorScore * 0.4).toFixed(2))
            },
            {
                concepto: `Score base combinado: 60%×${Math.round(latencyScore)} + 40%×${Math.round(errorScore)}`,
                valor_bruto: parseFloat((latencyScore * 0.6 + errorScore * 0.4).toFixed(2)),
                peso: '—',
                aporte: null
            },
            {
                concepto: '✅ Score final Rendimiento (acotado 0–100)',
                valor_bruto: score,
                peso: '—',
                aporte: null,
                es_resultado: true
            }
        ];

        // Detalle de la escala de latencia usada
        let escalaLatencia = '';
        if (p95 !== null) {
            if (p95 <= 300)       escalaLatencia = 'p95 ≤ 300ms → latencia=100 (óptimo)';
            else if (p95 <= 500)  escalaLatencia = 'p95 300–500ms → degradación suave 100→90';
            else if (p95 <= 1000) escalaLatencia = 'p95 500–1000ms → umbral superado, 90→70';
            else if (p95 <= 2000) escalaLatencia = 'p95 1000–2000ms → degradación seria, 70→50';
            else                  escalaLatencia = 'p95 >2000ms → degradación fuerte (mín 20)';
        }

        return {
            omitida: false,
            formula: 'ScoreRendimiento = 60%×ScoreLatencia + 40%×ScoreErrorRate',
            umbrales: {
                latencia: 'umbral objetivo: p95 ≤ 500ms',
                error_rate: 'umbral objetivo: tasa de error ≤ 1%'
            },
            escala_latencia_aplicada: escalaLatencia,
            entradas: {
                p95_ms:           p95 !== null ? parseFloat(p95.toFixed(2)) : null,
                tasa_error_pct:   errorPct
            },
            pasos
        };
    }

    /**
     * Función principal del motor de scoring.
     * Retorna un objeto enriquecido con scores, hallazgos, métricas y auditoría completa.
     */
    processReports(sonarData, zapData, k6Data) {
        const sonarResult = this.evaluateSonar(sonarData);
        const zapResult   = this.evaluateZap(zapData);
        const k6Result    = this.evaluateK6(k6Data);

        const W_MANT = 0.35, W_SEG = 0.40, W_REND = 0.25;
        const globalRaw = sonarResult.score * W_MANT + zapResult.score * W_SEG + k6Result.score * W_REND;
        const globalIndex = Math.round(globalRaw);

        // ── Extraer contadores de ZAP para la auditoría ──────────────────────
        let zapHigh = 0, zapMedium = 0, zapLow = 0, zapInfo = 0;
        if (zapData && zapData.site) {
            for (const site of zapData.site) {
                for (const alert of (site.alerts || [])) {
                    const risk = parseInt(alert.riskcode);
                    if (risk === 3) zapHigh++;
                    else if (risk === 2) zapMedium++;
                    else if (risk === 1) zapLow++;
                    else zapInfo++;
                }
            }
        }

        // ── Extraer métricas de k6 para la auditoría ─────────────────────────
        let k6P95 = null, k6ErrorPct = 0, k6LatScore = 100, k6ErrScore = 100;
        if (k6Data && k6Data.metrics) {
            const dur  = k6Data.metrics.http_req_duration;
            const fail = k6Data.metrics.http_req_failed;
            if (dur && dur.values) {
                k6P95 = dur.values['p(95)'] ?? null;
                if (k6P95 !== null) {
                    if (k6P95 <= 300)       k6LatScore = 100;
                    else if (k6P95 <= 500)  k6LatScore = 100 - ((k6P95 - 300) / 200) * 10;
                    else if (k6P95 <= 1000) k6LatScore = 90  - ((k6P95 - 500) / 500) * 20;
                    else if (k6P95 <= 2000) k6LatScore = 70  - ((k6P95 - 1000) / 1000) * 20;
                    else                    k6LatScore = Math.max(20, 50 - ((k6P95 - 2000) / 2000) * 30);
                }
            }
            if (fail && fail.values) {
                const rate = fail.values.rate || 0;
                k6ErrorPct = parseFloat((rate * 100).toFixed(2));
                if (rate <= 0.005)       k6ErrScore = 100;
                else if (rate <= 0.01)   k6ErrScore = 95;
                else if (rate <= 0.05)   k6ErrScore = 95 - ((rate - 0.01) / 0.04) * 20;
                else if (rate <= 0.20)   k6ErrScore = 75 - ((rate - 0.05) / 0.15) * 45;
                else                     k6ErrScore = Math.max(10, 30 - ((rate - 0.20) / 0.80) * 20);
            }
        }

        // ── Construir auditoría completa ──────────────────────────────────────
        const auditoria = {
            mantenibilidad: this.buildAuditMantenibilidad(sonarData, sonarResult.score),
            seguridad:      this.buildAuditSeguridad(zapData, zapResult.score, zapHigh, zapMedium, zapLow, zapInfo),
            rendimiento:    this.buildAuditRendimiento(k6Data, k6Result.score, k6LatScore, k6ErrScore, k6P95, k6ErrorPct),
            global: {
                formula: `IGC = ${W_MANT*100}%×Mantenibilidad + ${W_SEG*100}%×Seguridad + ${W_REND*100}%×Rendimiento`,
                pesos: {
                    mantenibilidad: `${W_MANT*100}%`,
                    seguridad:      `${W_SEG*100}%`,
                    rendimiento:    `${W_REND*100}%`
                },
                pasos: [
                    {
                        concepto: `Mantenibilidad: ${sonarResult.score} × ${W_MANT*100}%`,
                        valor_bruto: sonarResult.score,
                        peso: `${W_MANT*100}%`,
                        aporte: parseFloat((sonarResult.score * W_MANT).toFixed(2))
                    },
                    {
                        concepto: `Seguridad: ${zapResult.score} × ${W_SEG*100}%`,
                        valor_bruto: zapResult.score,
                        peso: `${W_SEG*100}%`,
                        aporte: parseFloat((zapResult.score * W_SEG).toFixed(2))
                    },
                    {
                        concepto: `Rendimiento: ${k6Result.score} × ${W_REND*100}%`,
                        valor_bruto: k6Result.score,
                        peso: `${W_REND*100}%`,
                        aporte: parseFloat((k6Result.score * W_REND).toFixed(2))
                    },
                    {
                        concepto: `✅ Índice Global de Calidad (redondeado)`,
                        valor_bruto: globalIndex,
                        peso: '—',
                        aporte: null,
                        es_resultado: true
                    }
                ],
                score_final: globalIndex
            }
        };

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
            ],
            auditoria
        };
    }
}

module.exports = new Evaluator();

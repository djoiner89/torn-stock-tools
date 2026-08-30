// ==UserScript==
// @name         D's Torn Stock Predictor - Beta
// @namespace    https://github.com/djoiner89/torn-stock-tools
// @version      0.1
// @description  Torn stock predictor with opportunity ranking, daily history, backtesting, and retry-safe market scanning
// @match        https://www.torn.com/page.php?sid=stocks*
// @updateURL    https://raw.githubusercontent.com/djoiner89/torn-stock-tools/main/ds-torn-stock-predictor.user.js
// @downloadURL  https://raw.githubusercontent.com/djoiner89/torn-stock-tools/main/ds-torn-stock-predictor.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // STOCKS
    // ============================================================

    const STOCKS = [
        { id: 1, acronym: 'TSB', name: 'Torn & Shanghai Banking' },
        { id: 2, acronym: 'TCI', name: 'Torn City Investments' },
        { id: 3, acronym: 'SYS', name: 'Syscore MFG' },
        { id: 4, acronym: 'LAG', name: 'Legal Authorities Group' },
        { id: 5, acronym: 'IOU', name: 'Insured On Us' },
        { id: 6, acronym: 'GRN', name: 'Grain' },
        { id: 7, acronym: 'THS', name: 'Torn City Health Service' },
        { id: 8, acronym: 'YAZ', name: 'Yazoo' },
        { id: 9, acronym: 'TCT', name: 'The Torn City Times' },
        { id: 10, acronym: 'CNC', name: 'Crude & Co' },
        { id: 11, acronym: 'MSG', name: 'Messaging Inc.' },
        { id: 12, acronym: 'TMI', name: 'TC Music Industries' },
        { id: 13, acronym: 'TCP', name: 'TC Media Productions' },
        { id: 14, acronym: 'IIL', name: 'I Industries Ltd.' },
        { id: 15, acronym: 'FHG', name: 'Feathery Hotels Group' },
        { id: 16, acronym: 'SYM', name: 'Symbiotic Ltd.' },
        { id: 17, acronym: 'LSC', name: 'Lucky Shot Casino' },
        { id: 18, acronym: 'PRN', name: 'Performance Ribaldry' },
        { id: 19, acronym: 'EWM', name: 'Eaglewood Mercenary' },
        { id: 20, acronym: 'TCM', name: 'Torn City Motors' },
        { id: 21, acronym: 'ELT', name: 'Empty Lunchbox Traders' },
        { id: 22, acronym: 'HRG', name: 'Home Retail Group' },
        { id: 23, acronym: 'TGP', name: 'Tell Group Plc.' },
        { id: 24, acronym: 'MUN', name: 'Munster Beverage Corp.' },
        { id: 25, acronym: 'WSU', name: 'West Side University' },
        { id: 26, acronym: 'IST', name: 'International School TC' },
        { id: 27, acronym: 'BAG', name: "Big Al's Gun Shop" },
        { id: 28, acronym: 'EVL', name: 'Evil Ducks Candy Corp' },
        { id: 29, acronym: 'MCS', name: 'Mc Smoogle Corp' },
        { id: 30, acronym: 'WLT', name: 'Wind Lines Travel' },
        { id: 31, acronym: 'TCC', name: 'Torn City Clothing' },
        { id: 32, acronym: 'ASS', name: 'Alcoholics Synonymous' },
        { id: 33, acronym: 'CBD', name: 'Herbal Releaf Co.' },
        { id: 34, acronym: 'LOS', name: 'Lo Squalo Waste' },
        { id: 35, acronym: 'PTS', name: 'PointLess' }
    ];

    // ============================================================
    // PERIODS
    // ============================================================

    const PERIODS = {
        hour:    { id: 1, label: '1 Hour', weight: 0.10 },
        day:     { id: 2, label: '1 Day', weight: 0.20 },
        week:    { id: 3, label: '1 Week',weight: 0.25 },
        month:   { id: 4, label: '1 Month',weight: 0.25 },
        year:    { id: 5, label: '1 Year',weight: 0.15 },
        alltime: { id: 6, label: 'All Time', weight: 0.05 }
    };

    const SCAN_PERIODS = {
        day: PERIODS.day,
        week: PERIODS.week,
        month: PERIODS.month,
        year: PERIODS.year
    };

    // ============================================================
    // SETTINGS
    // ============================================================

    const PANEL_ID = 'dstp-panel';

    const PANEL_POS_KEY =
        'dstp_panel_position';

    const PANEL_SIZE_KEY =
        'dstp_panel_size';

    const MARKET_SCAN_CACHE_KEY =
        'dstp_market_scan_cache_v52';

    // KEEP THIS THE SAME SO YOUR EXISTING HISTORY SURVIVES
    const HISTORY_KEY =
        'dstp_prediction_history_v2';

    const MARKET_SCAN_CACHE_MS =
        10 * 60 * 1000;

    // Slower than before to reduce request failures.
    const REQUEST_DELAY_MS =
        450;

    // Delay between stocks.
    const STOCK_DELAY_MS =
        400;

    // Number of tries for an individual chart request.
    const MAX_FETCH_ATTEMPTS =
        3;

    // Initial retry wait. Gets longer each attempt.
    const RETRY_BASE_DELAY_MS =
        900;

    // If some stocks still fail, wait and retry them again.
    const FAILED_STOCK_RECOVERY_WAIT =
        4000;

    const MAX_HISTORY_SCANS =
        100;

    const HOUR =
        60 * 60 * 1000;

    const DAY =
        24 * HOUR;

    const HISTORY_HORIZONS = {
        day1: DAY,
        day7: 7 * DAY,
        day30: 30 * DAY
    };

    let currentMarketResults = [];
    let currentScanDate = null;
    let marketSortMode = 'opportunity';

    // ============================================================
    // BASIC HELPERS
    // ============================================================

    function clamp(value, min, max) {
        return Math.max(
            min,
            Math.min(max, value)
        );
    }

    function sleep(ms) {
        return new Promise(
            resolve => setTimeout(resolve, ms)
        );
    }

    function average(values) {
        if (!values.length) return 0;

        return values.reduce(
            (a, b) => a + b,
            0
        ) / values.length;
    }

    function standardDeviation(values) {
        if (values.length < 2) return 0;

        const mean =
            average(values);

        const variance =
            average(
                values.map(
                    value =>
                        (value - mean) ** 2
                )
            );

        return Math.sqrt(variance);
    }

    function fmtPrice(value) {
        if (!Number.isFinite(value)) {
            return '—';
        }

        return '$' +
            value.toLocaleString(
                undefined,
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            );
    }

    function fmtPercent(value) {
        if (!Number.isFinite(value)) {
            return '—';
        }

        return (
            (value > 0 ? '+' : '') +
            value.toFixed(2) +
            '%'
        );
    }

    function percentageReturn(start, end) {
        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            start === 0
        ) {
            return null;
        }

        return (
            (end - start) /
            start
        ) * 100;
    }

    function loadJSON(key) {
        try {
            return JSON.parse(
                localStorage.getItem(key)
            );
        } catch {
            return null;
        }
    }

    // ============================================================
    // STOCK HELPERS
    // ============================================================

    function findStockInfo(
        stocks,
        stockId
    ) {
        return stocks.find(
            stock =>
                Number(stock.id) ===
                Number(stockId)
        ) || {
            id: stockId,
            acronym: `#${stockId}`,
            name: `Stock #${stockId}`
        };
    }

    function getCurrentStockId() {
        const params =
            new URLSearchParams(
                window.location.search
            );

        const stockId =
            Number(
                params.get('stockID')
            );

        if (
            Number.isFinite(stockId) &&
            stockId > 0
        ) {
            return stockId;
        }

        return null;
    }

    // ============================================================
    // RFCV
    // ============================================================

    function findRfcvToken() {
        try {
            const entries =
                performance.getEntriesByType(
                    'resource'
                );

            for (
                let i = entries.length - 1;
                i >= 0;
                i--
            ) {
                const url =
                    entries[i].name || '';

                const match =
                    url.match(
                        /[?&]rfcv=([^&]+)/i
                    );

                if (
                    match &&
                    match[1]
                ) {
                    return decodeURIComponent(
                        match[1]
                    );
                }
            }
        } catch {}

        try {
            const html =
                document.documentElement
                    .innerHTML;

            const matches = [
                ...html.matchAll(
                    /rfcv(?:=|%3D|["':\s]+)([a-zA-Z0-9_-]{6,})/gi
                )
            ];

            if (matches.length) {
                return matches[
                    matches.length - 1
                ][1];
            }
        } catch {}

        return null;
    }

    // ============================================================
    // RAW CHART REQUEST
    // ============================================================

    async function fetchChartDataOnce(
        stockId,
        chartPeriod,
        rfcv
    ) {
        const url =
            `/page.php?sid=StockMarket&step=getChartData&rfcv=${encodeURIComponent(rfcv)}`;

        const body =
            new URLSearchParams();

        body.set(
            'stockId',
            String(stockId)
        );

        body.set(
            'chartPeriod',
            String(chartPeriod)
        );

        const response =
            await fetch(
                url,
                {
                    method: 'POST',
                    credentials: 'include',

                    headers: {
                        'Content-Type':
                            'application/x-www-form-urlencoded; charset=UTF-8',

                        'X-Requested-With':
                            'XMLHttpRequest'
                    },

                    body:
                        body.toString()
                }
            );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const raw =
            await response.text();

        let parsed;

        try {
            parsed =
                JSON.parse(raw);
        } catch {
            throw new Error(
                'Unexpected Torn response'
            );
        }

        const points =
            extractPoints(parsed);

        if (
            points.length < 2
        ) {
            throw new Error(
                'No usable chart data returned'
            );
        }

        return points;
    }

    // ============================================================
    // RETRY-SAFE CHART REQUEST
    // ============================================================

    async function fetchChartData(
        stockId,
        chartPeriod,
        rfcv
    ) {
        let lastError = null;

        for (
            let attempt = 1;
            attempt <= MAX_FETCH_ATTEMPTS;
            attempt++
        ) {
            try {
                const points =
                    await fetchChartDataOnce(
                        stockId,
                        chartPeriod,
                        rfcv
                    );

                if (attempt > 1) {
                    console.log(
                        `Recovered Stock ${stockId}, period ${chartPeriod} on attempt ${attempt}.`
                    );
                }

                return points;

            } catch (error) {
                lastError = error;

                console.warn(
                    `Stock ${stockId}, period ${chartPeriod} failed attempt ${attempt}/${MAX_FETCH_ATTEMPTS}:`,
                    error
                );

                if (
                    attempt <
                    MAX_FETCH_ATTEMPTS
                ) {
                    // Increasing wait:
                    // attempt 1 -> about 0.9 sec
                    // attempt 2 -> about 1.8 sec
                    // plus a little random jitter
                    const jitter =
                        Math.floor(
                            Math.random() * 350
                        );

                    const retryDelay =
                        (
                            RETRY_BASE_DELAY_MS *
                            attempt
                        ) +
                        jitter;

                    await sleep(
                        retryDelay
                    );
                }
            }
        }

        throw new Error(
            `Chart request failed after ${MAX_FETCH_ATTEMPTS} attempts: ${lastError?.message || 'Unknown error'}`
        );
    }

    // ============================================================
    // EXTRACT POINTS
    // ============================================================

    function extractPoints(data) {
        const found = [];

        function walk(value) {
            if (!value) return;

            if (Array.isArray(value)) {
                for (
                    const child of value
                ) {
                    walk(child);
                }

                return;
            }

            if (
                typeof value ===
                'object'
            ) {
                if (
                    Number.isFinite(
                        Number(value.time)
                    ) &&
                    Number.isFinite(
                        Number(value.value)
                    )
                ) {
                    found.push({
                        time:
                            Number(value.time),

                        value:
                            Number(value.value)
                    });
                }

                for (
                    const child of
                    Object.values(value)
                ) {
                    if (
                        typeof child ===
                        'object'
                    ) {
                        walk(child);
                    }
                }
            }
        }

        walk(data);

        const unique =
            new Map();

        for (
            const point of found
        ) {
            unique.set(
                point.time,
                point
            );
        }

        return [
            ...unique.values()
        ].sort(
            (a, b) =>
                a.time - b.time
        );
    }

    // ============================================================
    // REGRESSION
    // ============================================================

    function regressionSlope(values) {
        const n =
            values.length;

        if (n < 2) {
            return 0;
        }

        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumXX = 0;

        for (
            let i = 0;
            i < n;
            i++
        ) {
            const x = i;
            const y = values[i];

            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumXX += x * x;
        }

        const denominator =
            (n * sumXX) -
            (sumX * sumX);

        if (
            denominator === 0
        ) {
            return 0;
        }

        return (
            (n * sumXY) -
            (sumX * sumY)
        ) / denominator;
    }

    // ============================================================
    // ANALYZE A PERIOD
    // ============================================================

    function analyzePeriod(points) {
        const prices =
            points.map(
                point =>
                    point.value
            );

        const count =
            prices.length;

        const start =
            prices[0];

        const current =
            prices[
                count - 1
            ];

        const high =
            Math.max(...prices);

        const low =
            Math.min(...prices);

        const changePct =
            (
                (
                    current -
                    start
                ) /
                start
            ) * 100;

        const slope =
            regressionSlope(prices);

        const avgPrice =
            average(prices);

        const normalizedSlope =
            avgPrice > 0
                ? (
                    slope /
                    avgPrice
                ) * 100
                : 0;

        const shortLength =
            Math.max(
                3,
                Math.floor(
                    count * 0.15
                )
            );

        const longLength =
            Math.max(
                shortLength + 1,
                Math.floor(
                    count * 0.40
                )
            );

        const shortMA =
            average(
                prices.slice(
                    -shortLength
                )
            );

        const longMA =
            average(
                prices.slice(
                    -longLength
                )
            );

        const maSpreadPct =
            longMA > 0
                ? (
                    (
                        shortMA -
                        longMA
                    ) /
                    longMA
                ) * 100
                : 0;

        const returns = [];

        for (
            let i = 1;
            i < count;
            i++
        ) {
            const previous =
                prices[i - 1];

            if (
                previous === 0
            ) {
                continue;
            }

            returns.push(
                (
                    (
                        prices[i] -
                        previous
                    ) /
                    previous
                ) * 100
            );
        }

        const volatility =
            standardDeviation(
                returns
            );

        const range =
            high - low;

        const rangePosition =
            range > 0
                ? (
                    current -
                    low
                ) / range
                : 0.5;

        const momentumLookback =
            Math.max(
                2,
                Math.floor(
                    count * 0.20
                )
            );

        const momentumIndex =
            Math.max(
                0,
                count -
                momentumLookback
            );

        const momentumStart =
            prices[
                momentumIndex
            ];

        const recentMomentumPct =
            momentumStart > 0
                ? (
                    (
                        current -
                        momentumStart
                    ) /
                    momentumStart
                ) * 100
                : 0;

        let score = 0;

        score += clamp(
            changePct * 7,
            -35,
            35
        );

        score += clamp(
            normalizedSlope *
                count *
                18,
            -25,
            25
        );

        score += clamp(
            maSpreadPct * 12,
            -20,
            20
        );

        score += clamp(
            recentMomentumPct * 7,
            -20,
            20
        );

        score =
            clamp(
                score,
                -100,
                100
            );

        return {
            points: count,
            start,
            current,
            high,
            low,
            changePct,
            slope,
            normalizedSlope,
            shortMA,
            longMA,
            maSpreadPct,
            volatility,
            rangePosition,
            recentMomentumPct,
            score
        };
    }

    // ============================================================
    // COMBINE TIMEFRAMES
    // ============================================================

    function combineAnalysis(
        analyses,
        periodSet = PERIODS
    ) {
        let weightedScore = 0;
        let totalWeight = 0;

        for (
            const [
                key,
                config
            ] of Object.entries(
                periodSet
            )
        ) {
            const analysis =
                analyses[key];

            if (!analysis) {
                continue;
            }

            weightedScore +=
                analysis.score *
                config.weight;

            totalWeight +=
                config.weight;
        }

        if (
            totalWeight > 0
        ) {
            weightedScore /=
                totalWeight;
        }

        const directions =
            Object.values(analyses)
                .map(
                    analysis =>
                        Math.sign(
                            analysis.score
                        )
                )
                .filter(
                    value =>
                        value !== 0
                );

        let bullish = 0;
        let bearish = 0;

        for (
            const direction of directions
        ) {
            if (
                direction > 0
            ) {
                bullish++;
            }

            if (
                direction < 0
            ) {
                bearish++;
            }
        }

        const agreement =
            directions.length
                ? Math.max(
                    bullish,
                    bearish
                ) /
                    directions.length
                : 0;

        const confidence =
            clamp(
                40 +
                Math.abs(
                    weightedScore
                ) *
                    0.45 +
                agreement *
                    20,
                0,
                95
            );

        let direction =
            'Neutral';

        if (
            weightedScore >= 55
        ) {
            direction =
                'Strong Bullish';

        } else if (
            weightedScore >= 20
        ) {
            direction =
                'Bullish';

        } else if (
            weightedScore <= -55
        ) {
            direction =
                'Strong Bearish';

        } else if (
            weightedScore <= -20
        ) {
            direction =
                'Bearish';
        }

        return {
            score:
                weightedScore,

            confidence,
            agreement,
            direction
        };
    }

    // ============================================================
    // OPPORTUNITY RAW SCORE
    // ============================================================

    function calculateOpportunityRaw(
        combined,
        analyses
    ) {
        const day =
            analyses.day;

        const week =
            analyses.week;

        const month =
            analyses.month;

        const year =
            analyses.year;

        if (!month) {
            return 0;
        }

        const trend =
            combined.score;

        const pos =
            month.rangePosition;

        let score = 45;

        score += clamp(
            trend * 0.55,
            -28,
            28
        );

        if (week) {
            score += clamp(
                week.changePct *
                    3.5,
                -10,
                10
            );
        }

        score += clamp(
            month.changePct *
                3.5,
            -12,
            12
        );

        if (year) {
            if (
                year.score >= 20
            ) {
                score += 5;
            }

            if (
                year.score <= -20
            ) {
                score -= 6;
            }
        }

        if (
            month.shortMA >
            month.longMA
        ) {
            score += 6;
        } else {
            score -= 8;
        }

        if (
            pos >= 0.25 &&
            pos <= 0.60
        ) {
            score += 14;

        } else if (
            pos > 0.60 &&
            pos <= 0.75
        ) {
            score += 8;

        } else if (
            pos > 0.75 &&
            pos <= 0.85
        ) {
            score += 2;

        } else if (
            pos > 0.85 &&
            pos <= 0.90
        ) {
            score -= 6;

        } else if (
            pos > 0.90 &&
            pos <= 0.95
        ) {
            score -= 16;

        } else if (
            pos > 0.95
        ) {
            score -= 25;
        }

        const healthyPullback =
            trend >= 25 &&
            month.changePct > 0 &&
            (
                !year ||
                year.changePct > 0
            ) &&
            day &&
            day.changePct < 0 &&
            day.changePct > -1.5 &&
            pos >= 0.20 &&
            pos <= 0.75;

        if (
            healthyPullback
        ) {
            score += 10;
        }

        if (
            week &&
            week.changePct < 0 &&
            month.changePct < 0
        ) {
            score -= 15;
        }

        if (
            day &&
            day.changePct > 1.25
        ) {
            score -= 8;
        }

        if (
            day &&
            day.changePct < -2
        ) {
            score -= 10;
        }

        if (
            month.volatility >
            1.25
        ) {
            score -= 10;

        } else if (
            month.volatility >
            0.75
        ) {
            score -= 6;

        } else if (
            month.volatility >
            0.40
        ) {
            score -= 3;
        }

        return clamp(
            score,
            0,
            100
        );
    }

    // ============================================================
    // FINAL OPPORTUNITY
    // ============================================================

    function calculateOpportunity(
        combined,
        analyses
    ) {
        const day =
            analyses.day;

        const week =
            analyses.week;

        const month =
            analyses.month;

        const year =
            analyses.year;

        if (!month) {
            return {
                score: 0,
                label:
                    'UNKNOWN',
                className:
                    'dstp-gray',
                reason:
                    'No monthly data'
            };
        }

        const trend =
            combined.score;

        const pos =
            month.rangePosition;

        let score =
            calculateOpportunityRaw(
                combined,
                analyses
            );

        // Weak trend cap.
        if (
            trend < 10
        ) {
            score =
                Math.min(
                    score,
                    55
                );

        } else if (
            trend < 20
        ) {
            score =
                Math.min(
                    score,
                    64
                );
        }

        // Near recent highs.
        if (
            pos > 0.90
        ) {
            score =
                Math.min(
                    score,
                    64
                );
        }

        if (
            pos > 0.95
        ) {
            score =
                Math.min(
                    score,
                    59
                );
        }

        // Negative month.
        if (
            month.changePct < 0
        ) {
            score =
                Math.min(
                    score,
                    64
                );
        }

        // Week + month negative.
        if (
            week &&
            week.changePct < 0 &&
            month.changePct < 0
        ) {
            score =
                Math.min(
                    score,
                    55
                );
        }

        // Clearly bearish.
        if (
            trend < -20
        ) {
            score =
                Math.min(
                    score,
                    34
                );
        }

        const buyTheDip =
            trend >= 25 &&
            month.changePct > 0 &&
            (
                !year ||
                year.changePct > 0
            ) &&
            day &&
            day.changePct < 0 &&
            day.changePct > -1.5 &&
            pos >= 0.20 &&
            pos <= 0.75;

        const excellentEligible =
            score >= 80 &&
            trend >= 30 &&
            pos <= 0.85 &&
            month.changePct >= 0;

        const goodEligible =
            score >= 65 &&
            trend >= 20 &&
            pos <= 0.90 &&
            month.changePct >= 0;

        let label;
        let className;

        if (
            excellentEligible
        ) {
            label =
                'EXCELLENT ENTRY';

            className =
                'dstp-green';

        } else if (
            buyTheDip &&
            score >= 65
        ) {
            label =
                'BUY THE DIP';

            className =
                'dstp-green';

        } else if (
            goodEligible
        ) {
            label =
                'GOOD ENTRY';

            className =
                'dstp-green';

        } else if (
            trend >= 20 &&
            pos > 0.90
        ) {
            label =
                'WAIT FOR DIP';

            className =
                'dstp-yellow';

        } else if (
            score >= 50
        ) {
            label =
                'WATCH';

            className =
                'dstp-yellow';

        } else if (
            score >= 35
        ) {
            label =
                'WAIT';

            className =
                'dstp-yellow';

        } else {
            label =
                'POOR ENTRY';

            className =
                'dstp-red';
        }

        let reason =
            'Mixed setup';

        if (
            pos > 0.95
        ) {
            reason =
                'Very close to 30-day high';

        } else if (
            pos > 0.90
        ) {
            reason =
                'Strong price but near 30-day high';

        } else if (
            trend < 10
        ) {
            reason =
                'Underlying trend is weak';

        } else if (
            trend < 20
        ) {
            reason =
                'Trend is below buy threshold';

        } else if (
            month.changePct < 0
        ) {
            reason =
                'Monthly trend is negative';

        } else if (
            buyTheDip
        ) {
            reason =
                'Short-term pullback inside stronger trend';

        } else if (
            excellentEligible
        ) {
            reason =
                'Strong trend and favorable entry';

        } else if (
            goodEligible
        ) {
            reason =
                'Positive trend and acceptable entry';
        }

        return {
            score,
            label,
            className,
            reason
        };
    }

    // ============================================================
    // ACTION
    // ============================================================

    function getAction(
        combined,
        analyses,
        opportunity
    ) {
        const month =
            analyses.month;

        const pos =
            month?.rangePosition ??
            0.5;

        if (
            opportunity.label ===
            'EXCELLENT ENTRY'
        ) {
            return {
                text:
                    'STRONG BUY SETUP',

                className:
                    'dstp-green'
            };
        }

        if (
            opportunity.label ===
            'BUY THE DIP'
        ) {
            return {
                text:
                    'BUY THE DIP / WATCH',

                className:
                    'dstp-green'
            };
        }

        if (
            opportunity.label ===
            'GOOD ENTRY'
        ) {
            return {
                text:
                    'GOOD ENTRY',

                className:
                    'dstp-green'
            };
        }

        if (
            combined.score >= 20 &&
            pos > 0.90
        ) {
            return {
                text:
                    'BULLISH — WAIT FOR DIP',

                className:
                    'dstp-yellow'
            };
        }

        if (
            combined.score >= 20
        ) {
            return {
                text:
                    'BULLISH / WATCH',

                className:
                    'dstp-yellow'
            };
        }

        if (
            combined.score <= -20
        ) {
            return {
                text:
                    'BEARISH / WAIT',

                className:
                    'dstp-red'
            };
        }

        if (
            opportunity.score >= 50
        ) {
            return {
                text:
                    'WATCH',

                className:
                    'dstp-yellow'
            };
        }

        return {
            text:
                'NEUTRAL',

            className:
                'dstp-gray'
        };
    }

    // ============================================================
    // COLOR HELPERS
    // ============================================================

    function scoreClass(score) {
        if (
            score >= 20
        ) {
            return 'dstp-green';
        }

        if (
            score <= -20
        ) {
            return 'dstp-red';
        }

        return 'dstp-yellow';
    }

    function opportunityClass(score) {
        if (
            score >= 65
        ) {
            return 'dstp-green';
        }

        if (
            score >= 40
        ) {
            return 'dstp-yellow';
        }

        return 'dstp-red';
    }

    function returnClass(value) {
        if (
            !Number.isFinite(value)
        ) {
            return 'dstp-gray';
        }

        if (
            value > 0
        ) {
            return 'dstp-green';
        }

        if (
            value < 0
        ) {
            return 'dstp-red';
        }

        return 'dstp-gray';
    }

    // ============================================================
    // HISTORY
    // ============================================================

    function loadPredictionHistory() {
        try {
            const value =
                JSON.parse(
                    localStorage.getItem(
                        HISTORY_KEY
                    )
                );

            return Array.isArray(value)
                ? value
                : [];

        } catch {
            return [];
        }
    }

    function savePredictionHistory(
        history
    ) {
        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(
                history.slice(
                    0,
                    MAX_HISTORY_SCANS
                )
            )
        );
    }

    // ============================================================
    // ONE OFFICIAL SNAPSHOT PER DAY
    // ============================================================

    function recordPredictionSnapshot(
        results,
        scanTime
    ) {
        if (
            !Array.isArray(results) ||
            !results.length
        ) {
            return false;
        }

        // IMPORTANT:
        // Do not create an official daily snapshot
        // unless ALL 35 stocks were successfully scanned.
        if (
            results.length !==
            STOCKS.length
        ) {
            console.warn(
                `Daily snapshot NOT saved because only ${results.length}/${STOCKS.length} stocks completed.`
            );

            return false;
        }

        const history =
            loadPredictionHistory();

        const scanDate =
            new Date(scanTime);

        const alreadySavedToday =
            history.some(
                snapshot => {
                    const savedDate =
                        new Date(
                            snapshot.timestamp
                        );

                    return (
                        savedDate.getFullYear() ===
                            scanDate.getFullYear() &&

                        savedDate.getMonth() ===
                            scanDate.getMonth() &&

                        savedDate.getDate() ===
                            scanDate.getDate()
                    );
                }
            );

        if (
            alreadySavedToday
        ) {
            console.log(
                "Today's official prediction already exists."
            );

            return false;
        }

        const ranked =
            [...results]
                .sort(
                    (a, b) =>
                        b.opportunity.score -
                        a.opportunity.score
                );

        const allStocks =
            ranked.map(
                (
                    result,
                    index
                ) => ({
                    rank:
                        index + 1,

                    stockId:
                        result.stock.id,

                    acronym:
                        result.stock.acronym,

                    name:
                        result.stock.name,

                    entryPrice:
                        result.current,

                    opportunity:
                        result.opportunity.score,

                    entry:
                        result.opportunity.label,

                    trend:
                        result.combined.score,

                    confidence:
                        result.combined.confidence,

                    dayChange:
                        result.analyses.day
                            ?.changePct ??
                        null,

                    weekChange:
                        result.analyses.week
                            ?.changePct ??
                        null,

                    monthChange:
                        result.analyses.month
                            ?.changePct ??
                        null,

                    range30:
                        result.analyses.month
                            ?.rangePosition ??
                        null,

                    currentPrice:
                        result.current,

                    currentReturn:
                        0,

                    result1d:
                        null,

                    result7d:
                        null,

                    result30d:
                        null
                })
            );

        history.unshift({
            timestamp:
                scanTime,

            allStocks
        });

        savePredictionHistory(
            history
        );

        return true;
    }

    // ============================================================
    // FIND NEAREST HISTORICAL PRICE
    // ============================================================

    function findClosestChartPrice(
        points,
        targetMs
    ) {
        if (
            !Array.isArray(points) ||
            !points.length
        ) {
            return null;
        }

        const targetSeconds =
            targetMs /
            1000;

        let closest =
            null;

        let closestDifference =
            Infinity;

        for (
            const point of points
        ) {
            const difference =
                Math.abs(
                    Number(point.time) -
                    targetSeconds
                );

            if (
                difference <
                closestDifference
            ) {
                closestDifference =
                    difference;

                closest =
                    point;
            }
        }

        return closest
            ? Number(
                closest.value
            )
            : null;
    }

    // ============================================================
    // UPDATE OLD PREDICTIONS
    // ============================================================

    function updateHistoricalPredictions(
        freshResults,
        now
    ) {
        const history =
            loadPredictionHistory();

        if (
            !history.length
        ) {
            return;
        }

        const resultMap =
            new Map();

        for (
            const result of freshResults
        ) {
            resultMap.set(
                Number(
                    result.stock.id
                ),
                result
            );
        }

        for (
            const snapshot of history
        ) {
            if (
                !Array.isArray(
                    snapshot.allStocks
                )
            ) {
                continue;
            }

            const age =
                now -
                snapshot.timestamp;

            for (
                const prediction of
                snapshot.allStocks
            ) {
                const fresh =
                    resultMap.get(
                        Number(
                            prediction.stockId
                        )
                    );

                // If this stock failed today's refresh,
                // leave its old history untouched.
                if (!fresh) {
                    continue;
                }

                prediction.currentPrice =
                    fresh.current;

                prediction.currentReturn =
                    percentageReturn(
                        prediction.entryPrice,
                        fresh.current
                    );

                // 24 HOURS
                if (
                    prediction.result1d === null &&
                    age >=
                        HISTORY_HORIZONS.day1
                ) {
                    const target =
                        snapshot.timestamp +
                        HISTORY_HORIZONS.day1;

                    const price =
                        findClosestChartPrice(
                            fresh._chartPoints
                                ?.week ||
                            fresh._chartPoints
                                ?.month,
                            target
                        );

                    if (
                        Number.isFinite(price)
                    ) {
                        prediction.result1d =
                            percentageReturn(
                                prediction.entryPrice,
                                price
                            );
                    }
                }

                // 7 DAYS
                if (
                    prediction.result7d === null &&
                    age >=
                        HISTORY_HORIZONS.day7
                ) {
                    const target =
                        snapshot.timestamp +
                        HISTORY_HORIZONS.day7;

                    const price =
                        findClosestChartPrice(
                            fresh._chartPoints
                                ?.month ||
                            fresh._chartPoints
                                ?.year,
                            target
                        );

                    if (
                        Number.isFinite(price)
                    ) {
                        prediction.result7d =
                            percentageReturn(
                                prediction.entryPrice,
                                price
                            );
                    }
                }

                // 30 DAYS
                if (
                    prediction.result30d === null &&
                    age >=
                        HISTORY_HORIZONS.day30
                ) {
                    const target =
                        snapshot.timestamp +
                        HISTORY_HORIZONS.day30;

                    const price =
                        findClosestChartPrice(
                            fresh._chartPoints
                                ?.year,
                            target
                        );

                    if (
                        Number.isFinite(price)
                    ) {
                        prediction.result30d =
                            percentageReturn(
                                prediction.entryPrice,
                                price
                            );
                    }
                }
            }
        }

        savePredictionHistory(
            history
        );
    }

    // ============================================================
    // BACKTEST SUMMARY
    // ============================================================

    function calculateHistoryStats(
        history
    ) {
        const samples = {
            excellent: [],
            good: [],
            watch: [],
            waitDip: []
        };

        for (
            const snapshot of history
        ) {
            if (
                !Array.isArray(
                    snapshot.allStocks
                )
            ) {
                continue;
            }

            for (
                const item of
                snapshot.allStocks
            ) {
                if (
                    !Number.isFinite(
                        item.result1d
                    )
                ) {
                    continue;
                }

                if (
                    item.entry ===
                    'EXCELLENT ENTRY'
                ) {
                    samples.excellent.push(
                        item.result1d
                    );

                } else if (
                    item.entry ===
                    'GOOD ENTRY'
                ) {
                    samples.good.push(
                        item.result1d
                    );

                } else if (
                    item.entry ===
                    'WAIT FOR DIP'
                ) {
                    samples.waitDip.push(
                        item.result1d
                    );

                } else {
                    samples.watch.push(
                        item.result1d
                    );
                }
            }
        }

        function stats(values) {
            if (
                !values.length
            ) {
                return {
                    count: 0,
                    avg: null,
                    wins: null
                };
            }

            return {
                count:
                    values.length,

                avg:
                    average(values),

                wins:
                    (
                        values.filter(
                            value =>
                                value > 0
                        ).length /
                        values.length
                    ) * 100
            };
        }

        return {
            excellent:
                stats(
                    samples.excellent
                ),

            good:
                stats(
                    samples.good
                ),

            watch:
                stats(
                    samples.watch
                ),

            waitDip:
                stats(
                    samples.waitDip
                )
        };
    }

    // ============================================================
    // HISTORY DISPLAY
    // ============================================================

    function renderHistory() {
        const output =
            document.getElementById(
                'dstp-output'
            );

        const history =
            loadPredictionHistory();

        if (
            !history.length
        ) {
            output.innerHTML = `
                <div class="dstp-card">
                    <h2>🕒 Prediction History</h2>
                    No predictions saved yet.
                    <br><br>
                    Run a <strong>Fresh Market Scan</strong>
                    to create the first official daily snapshot.
                </div>
            `;

            return;
        }

        const stats =
            calculateHistoryStats(
                history
            );

        let html = `
            <div class="dstp-history-header">
                <div>
                    <div class="dstp-section-title">
                        🕒 Prediction History
                    </div>

                    <div class="dstp-small">
                        ${history.length}
                        official daily scans • all 35 stocks stored internally
                    </div>
                </div>

                <button
                    id="dstp-clear-history"
                    class="dstp-button-secondary"
                >
                    Clear History
                </button>
            </div>
        `;

        if (
            stats.excellent.count ||
            stats.good.count ||
            stats.watch.count ||
            stats.waitDip.count
        ) {
            html += `
                <div
                    class="dstp-card"
                    style="margin-bottom:12px;"
                >
                    <strong>
                        📈 24-Hour Backtest Summary
                    </strong>

                    <div class="dstp-history-summary">
                        ${historyStatCard(
                            'Excellent Entry',
                            stats.excellent
                        )}

                        ${historyStatCard(
                            'Good Entry',
                            stats.good
                        )}

                        ${historyStatCard(
                            'Watch / Other',
                            stats.watch
                        )}

                        ${historyStatCard(
                            'Wait for Dip',
                            stats.waitDip
                        )}
                    </div>
                </div>
            `;
        }

        for (
            const snapshot of history
        ) {
            const allStocks =
                snapshot.allStocks || [];

            const topFive =
                allStocks.slice(
                    0,
                    5
                );

            html += `
                <div
                    class="dstp-card"
                    style="
                        margin-bottom:12px;
                        padding:0;
                        overflow:hidden;
                    "
                >
                    <div class="dstp-snapshot-title">
                        ${new Date(
                            snapshot.timestamp
                        ).toLocaleString()}

                        <span
                            class="dstp-small"
                            style="margin-left:8px;"
                        >
                            Top 5 shown • ${allStocks.length} stored
                        </span>
                    </div>

                    <table class="dstp-market-table">
                        <thead>
                            <tr>
                                <th>Rank / Stock</th>
                                <th>Entry Price</th>
                                <th>Opp.</th>
                                <th>Entry</th>
                                <th>Trend</th>
                                <th>Now</th>
                                <th>Since Pick</th>
                                <th>24H</th>
                                <th>7D</th>
                                <th>30D</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${
                                topFive
                                    .map(
                                        historyRow
                                    )
                                    .join('')
                            }
                        </tbody>
                    </table>
                </div>
            `;
        }

        html += `
            <div class="dstp-small">
                <strong>How this works:</strong>
                Fresh Market Scan can be run as often as you want.
                Old predictions are updated each time, but only one
                official 35-stock prediction snapshot is created per day.
            </div>
        `;

        output.innerHTML =
            html;

        document
            .getElementById(
                'dstp-clear-history'
            )
            .onclick =
                () => {
                    if (
                        confirm(
                            'Clear all prediction history?'
                        )
                    ) {
                        localStorage.removeItem(
                            HISTORY_KEY
                        );

                        renderHistory();
                    }
                };
    }

    function historyStatCard(
        name,
        stats
    ) {
        return `
            <div class="dstp-stat-box">
                <div class="dstp-small">
                    ${name}
                </div>

                <strong>
                    ${
                        stats.count
                            ? fmtPercent(
                                stats.avg
                            )
                            : 'Pending'
                    }
                </strong>

                <div class="dstp-small">
                    ${
                        stats.count
                            ? `${stats.wins.toFixed(0)}% positive • ${stats.count} samples`
                            : 'No matured 24H predictions'
                    }
                </div>
            </div>
        `;
    }

    function historyRow(item) {
        return `
            <tr>
                <td>
                    <strong>
                        #${item.rank}
                        ${item.acronym}
                    </strong>

                    <div class="dstp-stock-sub">
                        ${item.name}
                    </div>
                </td>

                <td>
                    ${fmtPrice(
                        item.entryPrice
                    )}
                </td>

                <td
                    class="${opportunityClass(
                        item.opportunity
                    )}"
                >
                    ${item.opportunity.toFixed(0)}
                </td>

                <td>
                    ${item.entry}
                </td>

                <td
                    class="${scoreClass(
                        item.trend
                    )}"
                >
                    ${item.trend.toFixed(1)}
                </td>

                <td>
                    ${fmtPrice(
                        item.currentPrice
                    )}
                </td>

                <td
                    class="${returnClass(
                        item.currentReturn
                    )}"
                >
                    ${fmtPercent(
                        item.currentReturn
                    )}
                </td>

                <td
                    class="${returnClass(
                        item.result1d
                    )}"
                >
                    ${
                        Number.isFinite(
                            item.result1d
                        )
                            ? fmtPercent(
                                item.result1d
                            )
                            : 'Pending'
                    }
                </td>

                <td
                    class="${returnClass(
                        item.result7d
                    )}"
                >
                    ${
                        Number.isFinite(
                            item.result7d
                        )
                            ? fmtPercent(
                                item.result7d
                            )
                            : 'Pending'
                    }
                </td>

                <td
                    class="${returnClass(
                        item.result30d
                    )}"
                >
                    ${
                        Number.isFinite(
                            item.result30d
                        )
                            ? fmtPercent(
                                item.result30d
                            )
                            : 'Pending'
                    }
                </td>
            </tr>
        `;
    }

    // ============================================================
    // ANALYZE ONE STOCK
    // ============================================================

    async function analyzeMarketStock(
        stock,
        rfcv
    ) {
        const analyses = {};
        const rawPoints = {};

        for (
            const [
                key,
                config
            ] of Object.entries(
                SCAN_PERIODS
            )
        ) {
            const points =
                await fetchChartData(
                    stock.id,
                    config.id,
                    rfcv
                );

            rawPoints[key] =
                points;

            analyses[key] =
                analyzePeriod(
                    points
                );

            await sleep(
                REQUEST_DELAY_MS
            );
        }

        const combined =
            combineAnalysis(
                analyses,
                SCAN_PERIODS
            );

        const opportunity =
            calculateOpportunity(
                combined,
                analyses
            );

        const action =
            getAction(
                combined,
                analyses,
                opportunity
            );

        const current =
            analyses.day?.current ??
            analyses.week?.current ??
            null;

        return {
            stock,
            analyses,
            combined,
            opportunity,
            action,
            current,

            _chartPoints:
                rawPoints
        };
    }

    // ============================================================
    // CACHE
    // ============================================================

    function makeCacheSafeResults(
        results
    ) {
        return results.map(
            result => ({
                stock:
                    result.stock,

                analyses:
                    result.analyses,

                combined:
                    result.combined,

                opportunity:
                    result.opportunity,

                action:
                    result.action,

                current:
                    result.current
            })
        );
    }

    function saveMarketCache(
        results
    ) {
        localStorage.setItem(
            MARKET_SCAN_CACHE_KEY,
            JSON.stringify({
                time:
                    Date.now(),

                results:
                    makeCacheSafeResults(
                        results
                    )
            })
        );
    }

    function loadMarketCache() {
        try {
            const raw =
                localStorage.getItem(
                    MARKET_SCAN_CACHE_KEY
                );

            if (!raw) {
                return null;
            }

            const cache =
                JSON.parse(raw);

            if (
                Date.now() -
                cache.time >
                MARKET_SCAN_CACHE_MS
            ) {
                return null;
            }

            return cache;

        } catch {
            return null;
        }
    }

    // ============================================================
    // MARKET RANKINGS
    // ============================================================

    function renderMarketResults(
        results,
        scanDate
    ) {
        currentMarketResults =
            results;

        currentScanDate =
            scanDate;

        const output =
            document.getElementById(
                'dstp-output'
            );

        const sorted =
            [...results];

        if (
            marketSortMode ===
            'opportunity'
        ) {
            sorted.sort(
                (a, b) =>
                    b.opportunity.score -
                    a.opportunity.score
            );
        } else {
            sorted.sort(
                (a, b) =>
                    b.combined.score -
                    a.combined.score
            );
        }

        let rows = '';

        sorted.forEach(
            (
                result,
                index
            ) => {
                const month =
                    result.analyses.month;

                const week =
                    result.analyses.week;

                const day =
                    result.analyses.day;

                let rank =
                    index + 1;

                if (
                    index === 0
                ) {
                    rank = '🥇';
                }

                if (
                    index === 1
                ) {
                    rank = '🥈';
                }

                if (
                    index === 2
                ) {
                    rank = '🥉';
                }

                rows += `
                    <tr>
                        <td>
                            <span class="dstp-rank">
                                ${rank}
                            </span>

                            <span class="dstp-stock-name">
                                ${result.stock.acronym}
                            </span>

                            <div class="dstp-stock-sub">
                                ${result.stock.name}
                            </div>
                        </td>

                        <td>
                            ${fmtPrice(
                                result.current
                            )}
                        </td>

                        <td
                            class="${opportunityClass(
                                result.opportunity.score
                            )}"
                        >
                            ${result.opportunity.score.toFixed(0)}
                        </td>

                        <td
                            class="${result.opportunity.className}"
                        >
                            ${result.opportunity.label}
                        </td>

                        <td
                            class="${scoreClass(
                                result.combined.score
                            )}"
                        >
                            ${result.combined.score.toFixed(1)}
                        </td>

                        <td>
                            ${result.combined.confidence.toFixed(0)}
                        </td>

                        <td>
                            ${fmtPercent(
                                day?.changePct
                            )}
                        </td>

                        <td>
                            ${fmtPercent(
                                week?.changePct
                            )}
                        </td>

                        <td>
                            ${fmtPercent(
                                month?.changePct
                            )}
                        </td>

                        <td>
                            ${
                                month
                                    ? Math.round(
                                        month.rangePosition *
                                        100
                                    ) + '%'
                                    : '—'
                            }
                        </td>

                        <td
                            class="${result.action.className}"
                        >
                            ${result.action.text}
                        </td>
                    </tr>
                `;
            }
        );

        output.innerHTML = `
            <div class="dstp-ranking-header">
                <div>
                    <div class="dstp-section-title">
                        📊 Torn Market Rankings
                    </div>

                    <div class="dstp-small">
                        ${
                            marketSortMode ===
                            'opportunity'
                                ? 'Ranked by estimated current entry quality.'
                                : 'Ranked by strongest historical technical trend.'
                        }
                    </div>
                </div>

                <div>
                    <button
                        id="dstp-sort-opportunity"
                        class="
                            dstp-button-secondary
                            ${
                                marketSortMode ===
                                'opportunity'
                                    ? 'dstp-sort-active'
                                    : ''
                            }
                        "
                    >
                        Best Opportunity
                    </button>

                    <button
                        id="dstp-sort-trend"
                        class="
                            dstp-button-secondary
                            ${
                                marketSortMode ===
                                'trend'
                                    ? 'dstp-sort-active'
                                    : ''
                            }
                        "
                    >
                        Strongest Trend
                    </button>
                </div>
            </div>

            <div
                class="dstp-small"
                style="margin-bottom:8px;"
            >
                Updated:
                ${new Date(
                    scanDate
                ).toLocaleTimeString()}

                • ${results.length}/${STOCKS.length}
                stocks available
            </div>

            <div class="dstp-table-box">
                <table class="dstp-market-table">
                    <thead>
                        <tr>
                            <th>Rank / Stock</th>
                            <th>Price</th>
                            <th>Opp.</th>
                            <th>Entry</th>
                            <th>Trend</th>
                            <th>Conf.</th>
                            <th>Day</th>
                            <th>Week</th>
                            <th>Month</th>
                            <th>30D Pos.</th>
                            <th>Action</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>

            ${estimateDisclaimer()}
        `;

        document
            .getElementById(
                'dstp-sort-opportunity'
            )
            .onclick =
                () => {
                    marketSortMode =
                        'opportunity';

                    renderMarketResults(
                        currentMarketResults,
                        currentScanDate
                    );
                };

        document
            .getElementById(
                'dstp-sort-trend'
            )
            .onclick =
                () => {
                    marketSortMode =
                        'trend';

                    renderMarketResults(
                        currentMarketResults,
                        currentScanDate
                    );
                };
    }

    function estimateDisclaimer() {
        return `
            <div class="dstp-disclaimer">
                <strong>
                    Experimental estimate only.
                </strong>

                Opportunity and Trend Scores use Torn's historical
                chart data. Fresh scans can be run repeatedly, but only
                one complete 35-stock prediction snapshot is stored per day.
            </div>
        `;
    }

    // ============================================================
    // CURRENT STOCK ANALYSIS
    // ============================================================

    async function runCurrentAnalysis() {
        const output =
            document.getElementById(
                'dstp-output'
            );

        const stockId =
            getCurrentStockId();

        if (!stockId) {
            output.innerHTML = `
                <div class="dstp-card">
                    Open a stock first.
                </div>
            `;

            return;
        }

        const rfcv =
            findRfcvToken();

        if (!rfcv) {
            output.innerHTML = `
                <div class="dstp-error">
                    Could not detect Torn session token.
                    Refresh the Torn stock page and try again.
                </div>
            `;

            return;
        }

        const stock =
            findStockInfo(
                STOCKS,
                stockId
            );

        const analyses = {};

        try {
            for (
                const [
                    key,
                    config
                ] of Object.entries(
                    PERIODS
                )
            ) {
                output.innerHTML = `
                    <div class="dstp-card">
                        Loading
                        <strong>
                            ${stock.acronym}
                        </strong>
                        ${config.label}...
                    </div>
                `;

                const points =
                    await fetchChartData(
                        stock.id,
                        config.id,
                        rfcv
                    );

                analyses[key] =
                    analyzePeriod(
                        points
                    );

                await sleep(
                    REQUEST_DELAY_MS
                );
            }

            const combined =
                combineAnalysis(
                    analyses
                );

            const opportunity =
                calculateOpportunity(
                    combined,
                    analyses
                );

            const action =
                getAction(
                    combined,
                    analyses,
                    opportunity
                );

            const month =
                analyses.month;

            output.innerHTML = `
                <div class="dstp-card">
                    <div class="dstp-section-title">
                        ${stock.acronym}
                        —
                        ${stock.name}
                    </div>

                    <div class="dstp-current-grid">

                        <div class="dstp-stat-box">
                            <div class="dstp-small">
                                Current Price
                            </div>

                            <strong>
                                ${fmtPrice(
                                    analyses.hour?.current
                                )}
                            </strong>
                        </div>

                        <div class="dstp-stat-box">
                            <div class="dstp-small">
                                Trend
                            </div>

                            <strong
                                class="${scoreClass(
                                    combined.score
                                )}"
                            >
                                ${combined.score.toFixed(1)}
                            </strong>
                        </div>

                        <div class="dstp-stat-box">
                            <div class="dstp-small">
                                Opportunity
                            </div>

                            <strong
                                class="${opportunity.className}"
                            >
                                ${opportunity.score.toFixed(0)}
                            </strong>
                        </div>

                        <div class="dstp-stat-box">
                            <div class="dstp-small">
                                Entry
                            </div>

                            <strong
                                class="${opportunity.className}"
                            >
                                ${opportunity.label}
                            </strong>
                        </div>

                        <div class="dstp-stat-box">
                            <div class="dstp-small">
                                Confidence
                            </div>

                            <strong>
                                ${combined.confidence.toFixed(0)}
                            </strong>
                        </div>

                        <div class="dstp-stat-box">
                            <div class="dstp-small">
                                30D Position
                            </div>

                            <strong>
                                ${
                                    month
                                        ? Math.round(
                                            month.rangePosition *
                                            100
                                        ) + '%'
                                        : '—'
                                }
                            </strong>
                        </div>

                    </div>

                    <div
                        style="margin-top:15px;"
                    >
                        <div class="dstp-small">
                            Current Action
                        </div>

                        <div
                            class="${action.className}"
                            style="font-size:22px;"
                        >
                            ${action.text}
                        </div>

                        <div
                            class="dstp-small"
                            style="margin-top:4px;"
                        >
                            ${opportunity.reason}
                        </div>
                    </div>
                </div>

                ${estimateDisclaimer()}
            `;

        } catch (error) {
            output.innerHTML = `
                <div class="dstp-error">
                    Analysis failed after automatic retries.

                    <br><br>

                    ${error.message}
                </div>
            `;
        }
    }

    // ============================================================
    // PROGRESS DISPLAY
    // ============================================================

    function renderScanProgress({
        stock,
        completed,
        total,
        stage = 'Initial scan',
        failures = 0
    }) {
        const output =
            document.getElementById(
                'dstp-output'
            );

        const percent =
            Math.round(
                (
                    completed /
                    total
                ) *
                100
            );

        output.innerHTML = `
            <div class="dstp-card">

                <div class="dstp-section-title">
                    ⏳ ${stage}
                </div>

                <div
                    style="margin-top:8px;"
                >
                    ${
                        stock
                            ? `${stock.acronym} — ${stock.name}`
                            : 'Preparing...'
                    }
                </div>

                <div
                    class="dstp-small"
                    style="margin-top:5px;"
                >
                    ${completed}/${total}
                    • ${percent}%

                    ${
                        failures
                            ? ` • ${failures} awaiting recovery`
                            : ''
                    }
                </div>

                <div class="dstp-progress">
                    <div
                        style="
                            width:${percent}%;
                        "
                    ></div>
                </div>

            </div>
        `;
    }

    // ============================================================
    // FULL MARKET SCAN
    // ============================================================

    async function runAllAnalysis(
        force = false
    ) {
        const output =
            document.getElementById(
                'dstp-output'
            );

        const info =
            document.getElementById(
                'dstp-stock-info'
            );

        // Analyze All Stocks can use cache.
        if (!force) {
            const cached =
                loadMarketCache();

            if (
                cached &&
                Array.isArray(
                    cached.results
                )
            ) {
                currentMarketResults =
                    cached.results;

                currentScanDate =
                    cached.time;

                renderMarketResults(
                    cached.results,
                    cached.time
                );

                info.innerHTML = `
                    Cached market scan •

                    <strong class="dstp-green">
                        ${cached.results.length}
                        stocks analyzed
                    </strong>
                `;

                return;
            }
        }

        const rfcv =
            findRfcvToken();

        if (!rfcv) {
            output.innerHTML = `
                <div class="dstp-error">
                    Could not detect Torn session token.
                    Refresh the Torn stock page and try again.
                </div>
            `;

            return;
        }

        const resultMap =
            new Map();

        const failedStocks = [];

        // ========================================================
        // PASS 1
        // ========================================================

        for (
            let i = 0;
            i < STOCKS.length;
            i++
        ) {
            const stock =
                STOCKS[i];

            renderScanProgress({
                stock,
                completed: i,
                total:
                    STOCKS.length,
                stage:
                    'Fresh Market Scan',
                failures:
                    failedStocks.length
            });

            try {
                const result =
                    await analyzeMarketStock(
                        stock,
                        rfcv
                    );

                resultMap.set(
                    stock.id,
                    result
                );

            } catch (error) {
                console.warn(
                    `Initial scan failed for ${stock.acronym}:`,
                    error
                );

                failedStocks.push(
                    stock
                );
            }

            await sleep(
                STOCK_DELAY_MS
            );
        }

        // ========================================================
        // RECOVERY PASS
        // ========================================================

        const stillFailed = [];

        if (
            failedStocks.length
        ) {
            info.innerHTML = `
                Initial scan complete •

                <strong class="dstp-yellow">
                    Recovering ${failedStocks.length}
                    failed stocks...
                </strong>
            `;

            await sleep(
                FAILED_STOCK_RECOVERY_WAIT
            );

            for (
                let i = 0;
                i < failedStocks.length;
                i++
            ) {
                const stock =
                    failedStocks[i];

                renderScanProgress({
                    stock,
                    completed:
                        i,
                    total:
                        failedStocks.length,
                    stage:
                        'Recovery Pass',
                    failures:
                        failedStocks.length -
                        i
                });

                try {
                    const result =
                        await analyzeMarketStock(
                            stock,
                            rfcv
                        );

                    resultMap.set(
                        stock.id,
                        result
                    );

                    console.log(
                        `Recovered ${stock.acronym} during recovery pass.`
                    );

                } catch (error) {
                    console.error(
                        `Recovery failed for ${stock.acronym}:`,
                        error
                    );

                    stillFailed.push(
                        stock
                    );
                }

                await sleep(
                    STOCK_DELAY_MS +
                    250
                );
            }
        }

        // Restore standard Torn stock order before ranking.
        const results =
            STOCKS
                .map(
                    stock =>
                        resultMap.get(
                            stock.id
                        )
                )
                .filter(Boolean);

        const scanTime =
            Date.now();

        // ========================================================
        // UPDATE OLD HISTORY WITH WHATEVER SUCCEEDED
        // ========================================================

        updateHistoricalPredictions(
            results,
            scanTime
        );

        // ========================================================
        // OFFICIAL DAILY SNAPSHOT
        //
        // Only saves if all 35 succeeded.
        // ========================================================

        const newSnapshotSaved =
            recordPredictionSnapshot(
                results,
                scanTime
            );

        // Cache successful current results.
        saveMarketCache(
            results
        );

        currentMarketResults =
            makeCacheSafeResults(
                results
            );

        currentScanDate =
            scanTime;

        renderMarketResults(
            currentMarketResults,
            scanTime
        );

        // ========================================================
        // STATUS
        // ========================================================

        if (
            results.length ===
            STOCKS.length
        ) {
            info.innerHTML = `
                Market scan complete •

                <strong class="dstp-green">
                    35/35 stocks analyzed
                </strong>

                •

                ${
                    newSnapshotSaved
                        ? 'Official daily prediction saved'
                        : "Today's official prediction already saved — prices/history updated only"
                }

                ${
                    failedStocks.length
                        ? ` • ${failedStocks.length} recovered automatically`
                        : ''
                }
            `;

        } else {
            info.innerHTML = `
                Market scan complete •

                <strong class="dstp-yellow">
                    ${results.length}/35 stocks analyzed
                </strong>

                •

                <strong class="dstp-red">
                    ${stillFailed.length} still failed
                </strong>

                •

                ${
                    newSnapshotSaved
                        ? 'Official prediction saved'
                        : 'No incomplete daily prediction was saved'
                }
            `;
        }
    }

    // ============================================================
    // CSS
    // ============================================================

    function injectStyles() {
        const existing =
            document.getElementById(
                'dstp-styles'
            );

        if (existing) {
            existing.remove();
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'dstp-styles';

        style.textContent = `
            #${PANEL_ID} {
                position:fixed;

                top:30px;
                right:20px;

                width:1050px;
                height:820px;

                min-width:800px;
                min-height:450px;

                max-width:97vw;
                max-height:94vh;

                padding:
                    14px
                    14px
                    30px
                    14px;

                background:
                    #181818 !important;

                color:
                    #f5f5f5 !important;

                border:
                    1px solid #666;

                border-radius:
                    10px;

                box-shadow:
                    0 5px 20px
                    rgba(0,0,0,.75);

                z-index:
                    999999;

                overflow:
                    auto;

                font-family:
                    Arial,
                    sans-serif;

                font-size:
                    13px;
            }

            #${PANEL_ID} * {
                box-sizing:
                    border-box;
            }

            #dstp-header {
                display:flex;

                align-items:center;

                justify-content:
                    space-between;

                cursor:
                    move;

                user-select:
                    none;

                margin-bottom:
                    12px;
            }

            #dstp-title {
                font-size:
                    22px;

                font-weight:
                    bold;

                color:
                    #fff !important;
            }

            #dstp-close {
                background:
                    #333 !important;

                color:
                    #fff !important;

                border:
                    1px solid #777;

                border-radius:
                    5px;

                padding:
                    8px 12px;

                cursor:
                    pointer;
            }

            .dstp-card {
                background:
                    #222 !important;

                border:
                    1px solid #444;

                border-radius:
                    7px;

                padding:
                    12px;
            }

            .dstp-error {
                background:
                    #301d1d !important;

                color:
                    #ff9292 !important;

                border:
                    1px solid #734;

                border-radius:
                    6px;

                padding:
                    12px;
            }

            .dstp-button {
                background:
                    #356b3b !important;

                color:
                    #fff !important;

                border:
                    1px solid #777;

                border-radius:
                    5px;

                padding:
                    10px 18px;

                cursor:
                    pointer;
            }

            .dstp-button-secondary {
                background:
                    #333 !important;

                color:
                    #fff !important;

                border:
                    1px solid #777;

                border-radius:
                    5px;

                padding:
                    10px 18px;

                cursor:
                    pointer;
            }

            .dstp-sort-active {
                background:
                    #356b3b !important;
            }

            .dstp-green {
                color:
                    #79f29a !important;

                font-weight:
                    bold;
            }

            .dstp-yellow {
                color:
                    #f2dc72 !important;

                font-weight:
                    bold;
            }

            .dstp-red {
                color:
                    #ff9292 !important;

                font-weight:
                    bold;
            }

            .dstp-blue {
                color:
                    #8cd8ff !important;

                font-weight:
                    bold;
            }

            .dstp-gray {
                color:
                    #bbb !important;
            }

            .dstp-small {
                color:
                    #aaa !important;

                font-size:
                    11px;
            }

            .dstp-section-title {
                font-size:
                    20px;

                font-weight:
                    bold;

                color:
                    #fff !important;
            }

            .dstp-ranking-header,
            .dstp-history-header {
                display:flex;

                justify-content:
                    space-between;

                align-items:
                    center;

                gap:
                    10px;

                margin-bottom:
                    8px;
            }

            .dstp-table-box {
                border:
                    1px solid #444;

                border-radius:
                    7px;

                overflow:
                    hidden;
            }

            .dstp-market-table {
                width:
                    100%;

                border-collapse:
                    collapse;

                font-size:
                    11px;
            }

            .dstp-market-table th {
                padding:
                    8px;

                background:
                    #303030 !important;

                color:
                    #fff !important;

                text-align:
                    right;

                white-space:
                    nowrap;
            }

            .dstp-market-table th:first-child {
                text-align:
                    left;
            }

            .dstp-market-table td {
                padding:
                    7px;

                background:
                    #1d1d1d !important;

                color:
                    #eee !important;

                border-bottom:
                    1px solid #414141;

                text-align:
                    right;

                white-space:
                    nowrap;
            }

            .dstp-market-table td:first-child {
                text-align:
                    left;
            }

            .dstp-stock-name {
                color:
                    #fff !important;

                font-weight:
                    bold;

                margin-left:
                    5px;
            }

            .dstp-stock-sub {
                color:
                    #8cd8ff !important;

                font-size:
                    10px;

                margin-left:
                    25px;
            }

            .dstp-rank {
                font-size:
                    16px;

                font-weight:
                    bold;
            }

            .dstp-current-grid {
                display:
                    grid;

                grid-template-columns:
                    repeat(6,1fr);

                gap:
                    8px;

                margin-top:
                    12px;
            }

            .dstp-stat-box {
                padding:
                    9px;

                background:
                    #202020 !important;

                border:
                    1px solid #444;

                border-radius:
                    6px;
            }

            .dstp-history-summary {
                display:
                    grid;

                grid-template-columns:
                    repeat(4,1fr);

                gap:
                    8px;

                margin-top:
                    10px;
            }

            .dstp-snapshot-title {
                padding:
                    9px 10px;

                background:
                    #292929 !important;

                color:
                    #fff !important;

                font-weight:
                    bold;
            }

            .dstp-disclaimer {
                margin-top:
                    10px;

                padding:
                    10px;

                background:
                    #222 !important;

                color:
                    #aaa !important;

                border-radius:
                    6px;

                font-size:
                    11px;
            }

            .dstp-progress {
                height:
                    10px;

                margin-top:
                    10px;

                background:
                    #333 !important;

                border-radius:
                    5px;

                overflow:
                    hidden;
            }

            .dstp-progress div {
                height:
                    100%;

                background:
                    #4f9256 !important;
            }

            #dstp-resize {
                position:
                    absolute;

                right:
                    2px;

                bottom:
                    2px;

                width:
                    27px;

                height:
                    27px;

                line-height:
                    25px;

                text-align:
                    center;

                cursor:
                    nwse-resize;

                background:
                    #292929 !important;

                color:
                    #aaa !important;

                border-top:
                    1px solid #666;

                border-left:
                    1px solid #666;

                user-select:
                    none;
            }
        `;

        document.head.appendChild(
            style
        );
    }

    // ============================================================
    // PANEL
    // ============================================================

    function createPanel() {
        const existing =
            document.getElementById(
                PANEL_ID
            );

        if (existing) {
            existing.remove();
        }

        const panel =
            document.createElement(
                'div'
            );

        panel.id =
            PANEL_ID;

        const savedPos =
            loadJSON(
                PANEL_POS_KEY
            );

        const savedSize =
            loadJSON(
                PANEL_SIZE_KEY
            );

        if (savedPos) {
            panel.style.left =
                savedPos.left;

            panel.style.top =
                savedPos.top;

            panel.style.right =
                'auto';
        }

        if (savedSize) {
            panel.style.width =
                savedSize.width;

            panel.style.height =
                savedSize.height;
        }

        panel.innerHTML = `
            <div id="dstp-header">

                <div id="dstp-title">
                    📈 D's Torn Stock Predictor - Beta - 0.1
                </div>

                <button id="dstp-close">
                    ✕
                </button>

            </div>

            <div
                class="dstp-card"
                style="margin-bottom:12px;"
            >
                <strong>
                    Stock Analysis
                </strong>

                <div
                    id="dstp-stock-info"
                    class="dstp-small"
                    style="
                        margin-top:3px;
                        margin-bottom:10px;
                    "
                >
                    Ready
                </div>

                <div
                    style="
                        display:flex;
                        flex-wrap:wrap;
                        gap:8px;
                    "
                >
                    <button
                        id="dstp-run-current"
                        class="dstp-button"
                    >
                        Analyze Current Stock
                    </button>

                    <button
                        id="dstp-run-all"
                        class="dstp-button"
                    >
                        Analyze All Stocks
                    </button>

                    <button
                        id="dstp-force-scan"
                        class="dstp-button-secondary"
                    >
                        Fresh Market Scan
                    </button>

                    <button
                        id="dstp-history"
                        class="dstp-button-secondary"
                    >
                        Prediction History
                    </button>
                </div>
            </div>

            <div id="dstp-output">
                <div class="dstp-card">
                    Ready.
                </div>
            </div>

            <div id="dstp-resize">
                ◢
            </div>
        `;

        document.body.appendChild(
            panel
        );

        panel
            .querySelector(
                '#dstp-close'
            )
            .onclick =
                () =>
                    panel.remove();

        enableDragging(
            panel
        );

        enableResize(
            panel
        );

        return panel;
    }

    // ============================================================
    // DRAG
    // ============================================================

    function enableDragging(
        panel
    ) {
        const handle =
            panel.querySelector(
                '#dstp-header'
            );

        let dragging = false;
        let mouseX = 0;
        let mouseY = 0;
        let left = 0;
        let top = 0;

        handle.addEventListener(
            'mousedown',
            event => {
                if (
                    event.target.closest(
                        'button'
                    )
                ) {
                    return;
                }

                dragging =
                    true;

                const rect =
                    panel.getBoundingClientRect();

                mouseX =
                    event.clientX;

                mouseY =
                    event.clientY;

                left =
                    rect.left;

                top =
                    rect.top;

                panel.style.right =
                    'auto';

                event.preventDefault();
            }
        );

        document.addEventListener(
            'mousemove',
            event => {
                if (!dragging) {
                    return;
                }

                panel.style.left =
                    Math.max(
                        0,
                        left +
                        event.clientX -
                        mouseX
                    ) +
                    'px';

                panel.style.top =
                    Math.max(
                        0,
                        top +
                        event.clientY -
                        mouseY
                    ) +
                    'px';
            }
        );

        document.addEventListener(
            'mouseup',
            () => {
                if (!dragging) {
                    return;
                }

                dragging =
                    false;

                const rect =
                    panel.getBoundingClientRect();

                localStorage.setItem(
                    PANEL_POS_KEY,
                    JSON.stringify({
                        left:
                            rect.left +
                            'px',

                        top:
                            rect.top +
                            'px'
                    })
                );
            }
        );
    }

    // ============================================================
    // RESIZE
    // ============================================================

    function enableResize(
        panel
    ) {
        const handle =
            panel.querySelector(
                '#dstp-resize'
            );

        let resizing = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        handle.addEventListener(
            'mousedown',
            event => {
                resizing =
                    true;

                startX =
                    event.clientX;

                startY =
                    event.clientY;

                startWidth =
                    panel.offsetWidth;

                startHeight =
                    panel.offsetHeight;

                event.preventDefault();
                event.stopPropagation();
            }
        );

        document.addEventListener(
            'mousemove',
            event => {
                if (!resizing) {
                    return;
                }

                panel.style.width =
                    Math.max(
                        800,
                        startWidth +
                        event.clientX -
                        startX
                    ) +
                    'px';

                panel.style.height =
                    Math.max(
                        450,
                        startHeight +
                        event.clientY -
                        startY
                    ) +
                    'px';
            }
        );

        document.addEventListener(
            'mouseup',
            () => {
                if (!resizing) {
                    return;
                }

                resizing =
                    false;

                localStorage.setItem(
                    PANEL_SIZE_KEY,
                    JSON.stringify({
                        width:
                            panel.offsetWidth +
                            'px',

                        height:
                            panel.offsetHeight +
                            'px'
                    })
                );
            }
        );
    }

    // ============================================================
    // INITIALIZE
    // ============================================================

    function init() {
        injectStyles();

        const panel =
            createPanel();

        panel
            .querySelector(
                '#dstp-run-current'
            )
            .onclick =
                runCurrentAnalysis;

        panel
            .querySelector(
                '#dstp-run-all'
            )
            .onclick =
                () =>
                    runAllAnalysis(
                        false
                    );

        panel
            .querySelector(
                '#dstp-force-scan'
            )
            .onclick =
                () =>
                    runAllAnalysis(
                        true
                    );

        panel
            .querySelector(
                '#dstp-history'
            )
            .onclick =
                renderHistory;
    }

    init();

})();


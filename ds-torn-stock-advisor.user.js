// ==UserScript==
// @name         D's Torn Stock Advisor - Beta
// @namespace    https://github.com/djoiner89/torn-stock-tools
// @version      0.2
// @description  Torn stock advisor for portfolio analysis, buy/sell guidance, and stock market decision support
// @match        https://www.torn.com/page.php?sid=stocks*
// @updateURL    https://raw.githubusercontent.com/djoiner89/torn-stock-tools/main/ds-torn-stock-advisor.user.js
// @downloadURL  https://raw.githubusercontent.com/djoiner89/torn-stock-tools/main/ds-torn-stock-advisor.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // STORAGE
    // ============================================================

    const API_KEY_STORAGE = 'torn_stock_advisor_api_key';
    const MARKET_CACHE_KEY = 'torn_stock_advisor_market_cache';

    const AVAILABLE_CASH_STORAGE =
        'torn_stock_advisor_available_cash';

    const RESERVE_CASH_STORAGE =
        'torn_stock_advisor_reserve_cash';

    const PANEL_POSITION_STORAGE =
        'torn_stock_advisor_panel_position';

    const PANEL_SIZE_STORAGE =
        'torn_stock_advisor_panel_size';

    const BROWSER_OWNED_FILTER_STORAGE =
        'torn_stock_advisor_browser_owned_filter';

    const BROWSER_PAYBACK_FILTER_STORAGE =
        'torn_stock_advisor_browser_payback_filter';

    const OPTIMIZER_OWNED_FILTER_STORAGE =
        'torn_stock_advisor_optimizer_owned_filter';

    const OPTIMIZER_PAYBACK_FILTER_STORAGE =
        'torn_stock_advisor_optimizer_payback_filter';

    const OPTIMIZER_MIN_ROI_STORAGE =
        'torn_stock_advisor_optimizer_min_roi';


    // ============================================================
    // SETTINGS
    // ============================================================

    const MARKET_CACHE_TIME =
        5 * 60 * 1000;

    const OPTIMIZER_STEP =
        1_000_000;

    const MAX_FUTURE_INCREMENTS =
        10;

    const MIN_PANEL_WIDTH =
        760;

    const MIN_PANEL_HEIGHT =
        420;


    // ============================================================
    // BENEFIT CONFIG
    // ============================================================

    const BENEFITS = {

        TCT: {
            type: 'cash',
            name: '$1,000,000',
            value: 1_000_000
        },

        GRN: {
            type: 'cash',
            name: '$4,000,000',
            value: 4_000_000
        },

        IOU: {
            type: 'cash',
            name: '$12,000,000',
            value: 12_000_000
        },

        TMI: {
            type: 'cash',
            name: '$25,000,000',
            value: 25_000_000
        },

        TSB: {
            type: 'cash',
            name: '$50,000,000',
            value: 50_000_000
        },

        CNC: {
            type: 'cash',
            name: '$80,000,000',
            value: 80_000_000
        },

        ASS: {
            type: 'item',
            name: 'Six Pack of Alcohol',
            itemName: 'Six-Pack of Alcohol'
        },

        BAG: {
            type: 'item',
            name: 'Ammunition Pack',
            itemName: 'Ammunition Pack'
        },

        EWM: {
            type: 'item',
            name: 'Box of Grenades',
            itemName: 'Box of Grenades'
        },

        FHG: {
            type: 'item',
            name: 'Feathery Hotel Coupon',
            itemName: 'Feathery Hotel Coupon'
        },

        LAG: {
            type: 'item',
            name: 'Lawyer Business Card',
            itemName: 'Lawyer Business Card'
        },

        LSC: {
            type: 'item',
            name: 'Lottery Voucher',
            itemName: 'Lottery Voucher'
        },

        MUN: {
            type: 'item',
            name: 'Six Pack of Energy Drink',
            itemName: 'Six-Pack of Energy Drink'
        },

        PRN: {
            type: 'item',
            name: 'Erotic DVD',
            itemName: 'Erotic DVD'
        },

        SYM: {
            type: 'item',
            name: 'Drug Pack',
            itemName: 'Drug Pack'
        },

        TCC: {
            type: 'item',
            name: 'Clothing Cache',
            itemName: 'Clothing Cache'
        },

        THS: {
            type: 'item',
            name: 'Box of Medical Supplies',
            itemName: 'Box of Medical Supplies'
        },

        EVL: {
            type: 'unpriced',
            name: '1,000 Happy'
        },

        CBD: {
            type: 'unpriced',
            name: '50 Nerve'
        },

        MCS: {
            type: 'unpriced',
            name: '100 Energy'
        }
    };


    // ============================================================
    // CSS
    // ============================================================

    function injectStyles() {

        const old =
            document.getElementById(
                'tsa-styles'
            );

        if (old) {
            old.remove();
        }


        const style =
            document.createElement(
                'style'
            );

        style.id =
            'tsa-styles';


        style.textContent = `

            #tsa-panel {
                background:#181818 !important;
                color:#f5f5f5 !important;
                overflow:auto !important;
                min-width:${MIN_PANEL_WIDTH}px !important;
                min-height:${MIN_PANEL_HEIGHT}px !important;
            }

            #tsa-panel * {
                box-sizing:border-box;
            }

            #tsa-panel table {
                color:#f5f5f5 !important;
                background:#181818 !important;
            }

            #tsa-panel thead,
            #tsa-panel thead tr,
            #tsa-panel thead th {
                background:#303030 !important;
                color:#ffffff !important;
            }

            #tsa-panel tbody tr {
                background:#1d1d1d !important;
            }

            #tsa-panel tbody td {
                background:#1d1d1d !important;
                color:#f5f5f5 !important;
            }

            #tsa-panel input,
            #tsa-panel select {
                background:#252525 !important;
                color:#ffffff !important;
                border:1px solid #666 !important;
            }

            #tsa-panel button {
                color:#ffffff !important;
            }

            #tsa-panel .tsa-stock {
                color:#ffffff !important;
                font-weight:bold !important;
                font-size:12px !important;
            }

            #tsa-panel .tsa-name {
                color:#d8d8d8 !important;
                font-size:10px !important;
            }

            #tsa-panel .tsa-benefit {
                color:#9fd7ff !important;
                font-size:10px !important;
            }

            #tsa-panel .tsa-market {
                color:#69ddff !important;
                font-size:10px !important;
            }

            #tsa-panel .tsa-price {
                color:#bcbcbc !important;
                font-size:10px !important;
            }

            #tsa-panel .tsa-normal {
                color:#f5f5f5 !important;
            }

            #tsa-panel .tsa-cost {
                color:#79f29a !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-green {
                color:#79f29a !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-blue {
                color:#8cd8ff !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-yellow {
                color:#f2dc72 !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-na {
                color:#929292 !important;
            }

            #tsa-panel .tsa-roi-high {
                color:#79f29a !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-roi-mid {
                color:#f2dc72 !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-roi-low {
                color:#ff9292 !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-priority-excellent {
                color:#79f29a !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-priority-good {
                color:#a8e783 !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-priority-fair {
                color:#f2dc72 !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-priority-poor {
                color:#ff9292 !important;
                font-weight:bold !important;
            }

            #tsa-panel .tsa-summary-box {
                background:#242424 !important;
                border:1px solid #444 !important;
                border-radius:7px !important;
                padding:10px !important;
            }

            #tsa-panel .tsa-small-note {
                color:#999 !important;
                font-size:10px !important;
                line-height:1.45 !important;
            }

            #tsa-panel .tsa-section-title {
                color:#ffffff !important;
                font-weight:bold !important;
                font-size:13px !important;
            }

            #tsa-panel .tsa-filter-bar {
                display:flex;
                gap:8px;
                flex-wrap:wrap;
                align-items:center;
                margin-bottom:10px;
                padding:8px;
                background:#222 !important;
                border:1px solid #444;
                border-radius:6px;
            }

            #tsa-drag-handle {
                cursor:move !important;
                user-select:none !important;
            }

            #tsa-resize-handle {
                position:absolute !important;
                right:3px !important;
                bottom:2px !important;
                width:24px !important;
                height:24px !important;
                cursor:nwse-resize !important;
                color:#aaa !important;
                font-size:20px !important;
                line-height:22px !important;
                text-align:center !important;
                user-select:none !important;
                z-index:100001 !important;
                background:#242424 !important;
                border-top:1px solid #555 !important;
                border-left:1px solid #555 !important;
                border-radius:5px 0 7px 0 !important;
            }

            #tsa-resize-handle:hover {
                color:#ffffff !important;
                background:#333 !important;
            }

        `;


        document.head.appendChild(
            style
        );
    }


    // ============================================================
    // API KEY
    // ============================================================

    function getApiKey() {

        return localStorage.getItem(
            API_KEY_STORAGE
        );
    }


    function saveApiKey(key) {

        localStorage.setItem(
            API_KEY_STORAGE,
            key
        );
    }


    function askForApiKey() {

        const key =
            prompt(
                'Enter your Torn API key.\n\n' +
                'TORN API PRIVACY / USE\n' +
                '• Purpose: Read your stock holdings, Torn stock data, item data, and Item Market prices for portfolio and benefit analysis.\n' +
                '• Data storage: API key, settings, and market cache are stored only in this browser.\n' +
                '• Data sharing: Nobody. Nothing is sent to the developer or any third party.\n' +
                '• Key storage/sharing: Stored locally in your browser and never shared.\n' +
                '• Required access: User stocks plus the Torn/Market selections used by this tool.\n\n' +
                'By entering a key, you acknowledge this local-only use.'
            );


        if (key) {

            saveApiKey(
                key.trim()
            );

            return key.trim();
        }


        return null;
    }


    // ============================================================
    // FORMATTERS
    // ============================================================

    function money(value) {

        if (
            !Number.isFinite(value)
        ) {
            return 'N/A';
        }


        if (
            value >=
            1_000_000_000_000
        ) {

            return '$' +
                (
                    value /
                    1_000_000_000_000
                ).toFixed(2) +
                'T';
        }


        if (
            value >=
            1_000_000_000
        ) {

            return '$' +
                (
                    value /
                    1_000_000_000
                ).toFixed(2) +
                'B';
        }


        if (
            value >=
            1_000_000
        ) {

            return '$' +
                (
                    value /
                    1_000_000
                ).toFixed(2) +
                'M';
        }


        if (
            value >=
            1_000
        ) {

            return '$' +
                (
                    value /
                    1_000
                ).toFixed(2) +
                'K';
        }


        return '$' +
            Math.round(value)
                .toLocaleString();
    }


    function shares(value) {

        return Math
            .round(value)
            .toLocaleString();
    }


    function percent(value) {

        if (
            !Number.isFinite(value)
        ) {
            return 'N/A';
        }


        return value.toFixed(2) +
            '%';
    }


    function formatTimestamp(
        date = new Date()
    ) {

        return date.toLocaleTimeString(
            [],
            {
                hour:
                    '2-digit',

                minute:
                    '2-digit'
            }
        );
    }


    // ============================================================
    // MONEY INPUT
    // ============================================================

    function parseMoneyInput(
        value
    ) {

        if (!value) {
            return NaN;
        }


        const cleaned =
            String(value)
                .trim()
                .toLowerCase()
                .replace(
                    /[$,\s]/g,
                    ''
                );


        const match =
            cleaned.match(
                /^(\d+(?:\.\d+)?)([kmbt])?$/
            );


        if (!match) {
            return NaN;
        }


        const number =
            Number(
                match[1]
            );


        const suffix =
            match[2] || '';


        const multipliers = {

            '':
                1,

            k:
                1_000,

            m:
                1_000_000,

            b:
                1_000_000_000,

            t:
                1_000_000_000_000
        };


        return number *
            multipliers[suffix];
    }


    // ============================================================
    // API
    // ============================================================

    async function apiRequest(
        url
    ) {

        const response =
            await fetch(url);


        if (
            !response.ok
        ) {

            throw new Error(
                `API request failed (${response.status})`
            );
        }


        const json =
            await response.json();


        if (
            json.error
        ) {

            throw new Error(
                json.error.error ||
                'Torn API error'
            );
        }


        return json;
    }


    // ============================================================
    // MARKET CACHE
    // ============================================================

    function getMarketCache() {

        try {

            const raw =
                localStorage.getItem(
                    MARKET_CACHE_KEY
                );


            if (!raw) {
                return {};
            }


            return JSON.parse(raw);

        } catch {

            return {};
        }
    }


    function saveMarketCache(
        cache
    ) {

        localStorage.setItem(
            MARKET_CACHE_KEY,
            JSON.stringify(cache)
        );
    }


    // ============================================================
    // ITEM LOOKUP
    // ============================================================

    function normalizeName(
        name
    ) {

        return String(name)
            .toLowerCase()
            .replace(
                /[^a-z0-9]/g,
                ''
            );
    }


    async function getTornItems(
        apiKey
    ) {

        const data =
            await apiRequest(
                `https://api.torn.com/v2/torn/items?key=${apiKey}`
            );


        return data.items ||
            [];
    }


    function buildItemMap(
        items
    ) {

        const map =
            new Map();


        for (
            const item of
            items
        ) {

            if (
                !item.name
            ) {
                continue;
            }


            map.set(
                normalizeName(
                    item.name
                ),
                item
            );
        }


        return map;
    }


    // ============================================================
    // MARKET PRICE
    // ============================================================

    function extractMarketPrices(
        data
    ) {

        const prices =
            [];


        function scan(value) {

            if (!value) {
                return;
            }


            if (
                Array.isArray(value)
            ) {

                for (
                    const entry of
                    value
                ) {

                    scan(entry);
                }


                return;
            }


            if (
                typeof value ===
                'object'
            ) {

                if (
                    Number.isFinite(
                        Number(
                            value.price
                        )
                    ) &&
                    Number(
                        value.price
                    ) > 0
                ) {

                    prices.push(
                        Number(
                            value.price
                        )
                    );
                }


                for (
                    const child of
                    Object.values(
                        value
                    )
                ) {

                    if (
                        typeof child ===
                        'object'
                    ) {

                        scan(child);
                    }
                }
            }
        }


        scan(data);


        return prices;
    }


    function representativeMarketPrice(
        data
    ) {

        const prices =
            extractMarketPrices(
                data
            )
                .sort(
                    (a, b) =>
                        a - b
                );


        if (
            !prices.length
        ) {
            return null;
        }


        const sample =
            prices.slice(
                0,
                Math.min(
                    5,
                    prices.length
                )
            );


        const middle =
            Math.floor(
                sample.length /
                2
            );


        if (
            sample.length %
            2 === 1
        ) {

            return sample[
                middle
            ];
        }


        return (
            sample[
                middle - 1
            ] +
            sample[
                middle
            ]
        ) / 2;
    }


    async function getLiveItemPrice(
        itemId,
        apiKey
    ) {

        const cache =
            getMarketCache();


        const key =
            String(
                itemId
            );


        const cached =
            cache[key];


        if (
            cached &&
            Date.now() -
            cached.time <
            MARKET_CACHE_TIME
        ) {

            return {

                price:
                    cached.price,

                cached:
                    true,

                timestamp:
                    cached.time
            };
        }


        const data =
            await apiRequest(
                `https://api.torn.com/v2/market/${itemId}/itemmarket?key=${apiKey}`
            );


        const price =
            representativeMarketPrice(
                data
            );


        const now =
            Date.now();


        if (
            Number.isFinite(
                price
            )
        ) {

            cache[key] = {

                price,

                time:
                    now
            };


            saveMarketCache(
                cache
            );
        }


        return {

            price,

            cached:
                false,

            timestamp:
                now
        };
    }


    // ============================================================
    // BENEFIT VALUES
    // ============================================================

    async function loadBenefitValues(
        apiKey,
        statusCallback
    ) {

        const values =
            {};


        const items =
            await getTornItems(
                apiKey
            );


        const itemMap =
            buildItemMap(
                items
            );


        const marketBenefits =
            Object.entries(
                BENEFITS
            )
                .filter(
                    ([, config]) =>
                        config.type ===
                        'item'
                );


        let completed =
            0;


        let newestTimestamp =
            Date.now();


        for (
            const [
                acronym,
                config
            ] of marketBenefits
        ) {

            completed++;


            statusCallback(
                `Loading market values ${completed}/${marketBenefits.length}: ${config.name}`
            );


            const item =
                itemMap.get(
                    normalizeName(
                        config.itemName
                    )
                );


            if (!item) {

                values[acronym] = {

                    value:
                        null,

                    source:
                        'Item not found',

                    timestamp:
                        null
                };


                continue;
            }


            try {

                const result =
                    await getLiveItemPrice(
                        item.id,
                        apiKey
                    );


                values[acronym] = {

                    value:
                        result.price,

                    source:
                        result.cached
                            ? 'Market • cached'
                            : 'Live market',

                    itemId:
                        item.id,

                    timestamp:
                        result.timestamp
                };


                if (
                    result.timestamp >
                    newestTimestamp
                ) {

                    newestTimestamp =
                        result.timestamp;
                }


            } catch (error) {

                console.error(
                    config.itemName,
                    error
                );


                values[acronym] = {

                    value:
                        null,

                    source:
                        'Market unavailable',

                    timestamp:
                        null
                };
            }
        }


        for (
            const [
                acronym,
                config
            ] of Object.entries(
                BENEFITS
            )
        ) {

            if (
                config.type ===
                'cash'
            ) {

                values[acronym] = {

                    value:
                        config.value,

                    source:
                        'Exact cash',

                    timestamp:
                        newestTimestamp
                };
            }


            if (
                config.type ===
                'unpriced'
            ) {

                values[acronym] = {

                    value:
                        null,

                    source:
                        'No direct market value',

                    timestamp:
                        null
                };
            }
        }


        return {

            values,

            updatedAt:
                newestTimestamp
        };
    }


    // ============================================================
    // INCREMENT CALCULATOR
    // ============================================================

    function calculateIncrement(
        baseRequirement,
        ownedShares
    ) {

        let increment =
            0;


        let totalRequired =
            0;


        let nextBlockSize =
            baseRequirement;


        while (
            ownedShares >=
            totalRequired +
            nextBlockSize
        ) {

            totalRequired +=
                nextBlockSize;


            increment++;


            nextBlockSize *=
                2;
        }


        const targetShares =
            totalRequired +
            nextBlockSize;


        const sharesNeeded =
            Math.max(
                0,
                targetShares -
                ownedShares
            );


        return {

            currentIncrement:
                increment,

            nextIncrement:
                increment +
                1,

            currentThreshold:
                totalRequired,

            nextBlockSize,

            targetShares,

            sharesNeeded
        };
    }


    // ============================================================
    // ROI
    // ============================================================

    function calculateROI(
        payoutValue,
        frequencyDays,
        cost
    ) {

        if (
            !Number.isFinite(
                payoutValue
            ) ||
            !frequencyDays ||
            !cost
        ) {

            return {

                monthlyValue:
                    null,

                annualValue:
                    null,

                roi:
                    null,

                paybackMonths:
                    null
            };
        }


        const payoutsPerYear =
            365 /
            frequencyDays;


        const annualValue =
            payoutValue *
            payoutsPerYear;


        const monthlyValue =
            annualValue /
            12;


        const roi =
            (
                annualValue /
                cost
            ) *
            100;


        const paybackMonths =
            cost /
            monthlyValue;


        return {

            monthlyValue,

            annualValue,

            roi,

            paybackMonths
        };
    }


    // ============================================================
    // PRIORITY
    // ============================================================

    function getPriority(
        roi
    ) {

        if (
            !Number.isFinite(
                roi
            )
        ) {

            return {
                text:
                    'N/A',

                className:
                    'tsa-na'
            };
        }


        if (
            roi >=
            30
        ) {

            return {
                text:
                    'Excellent',

                className:
                    'tsa-priority-excellent'
            };
        }


        if (
            roi >=
            20
        ) {

            return {
                text:
                    'Good',

                className:
                    'tsa-priority-good'
            };
        }


        if (
            roi >=
            10
        ) {

            return {
                text:
                    'Fair',

                className:
                    'tsa-priority-fair'
            };
        }


        return {
            text:
                'Poor',

            className:
                'tsa-priority-poor'
        };
    }


    function getRoiClass(
        roi
    ) {

        if (
            !Number.isFinite(
                roi
            )
        ) {

            return 'tsa-na';
        }


        if (
            roi >=
            25
        ) {

            return 'tsa-roi-high';
        }


        if (
            roi >=
            12
        ) {

            return 'tsa-roi-mid';
        }


        return 'tsa-roi-low';
    }


    // ============================================================
    // OWNED STOCKS
    // ============================================================

    function getOwnedMap(
        userStocks
    ) {

        const map =
            new Map();


        for (
            const stock of
            userStocks
        ) {

            map.set(
                Number(
                    stock.id
                ),
                Number(
                    stock.shares ||
                    0
                )
            );
        }


        return map;
    }


    // ============================================================
    // BUILD STOCK ROWS
    // ============================================================

    function buildStockRows(
        allStocks,
        userStocks,
        benefitValues
    ) {

        const ownedMap =
            getOwnedMap(
                userStocks
            );


        const rows =
            [];


        for (
            const stock of
            allStocks
        ) {

            const bonus =
                stock.bonus;


            if (!bonus) {
                continue;
            }


            if (
                bonus.passive ===
                true
            ) {

                continue;
            }


            const baseRequirement =
                Number(
                    bonus.requirement ||
                    0
                );


            const stockPrice =
                Number(
                    stock.market?.price ||
                    0
                );


            if (
                !baseRequirement ||
                !stockPrice
            ) {

                continue;
            }


            const owned =
                ownedMap.get(
                    Number(
                        stock.id
                    )
                ) ||
                0;


            const increment =
                calculateIncrement(
                    baseRequirement,
                    owned
                );


            const nextCost =
                increment.sharesNeeded *
                stockPrice;


            const config =
                BENEFITS[
                    stock.acronym
                ];


            const live =
                benefitValues[
                    stock.acronym
                ];


            const payoutValue =
                live?.value ??
                null;


            const source =
                live?.source ||
                'Not configured';


            const benefitName =
                config?.name ||
                'Benefit';


            const frequencyDays =
                Number(
                    bonus.frequency ||
                    0
                );


            const roi =
                calculateROI(
                    payoutValue,
                    frequencyDays,
                    nextCost
                );


            rows.push({

                id:
                    stock.id,

                acronym:
                    stock.acronym ||
                    '???',

                name:
                    stock.name ||
                    'Unknown',

                stockPrice,

                owned,

                baseRequirement,

                frequencyDays,

                benefitName,

                payoutValue,

                valueSource:
                    source,

                nextCost,

                ...increment,

                ...roi
            });
        }


        return rows;
    }


    // ============================================================
    // FUTURE OPTIONS
    // ============================================================

    function buildFutureOptions(
        stock,
        budget,
        maxPayback,
        minROI
    ) {

        const options = [

            {
                count:
                    0,

                cost:
                    0,

                annualValue:
                    0,

                monthlyValue:
                    0,

                increments:
                    []
            }
        ];


        if (
            !Number.isFinite(
                stock.payoutValue
            ) ||
            !stock.frequencyDays
        ) {

            return options;
        }


        const valuePerIncrement =
            stock.payoutValue *
            (
                365 /
                stock.frequencyDays
            );


        let currentTier =
            stock.currentIncrement;


        let cumulativeCost =
            0;


        let cumulativeAnnual =
            0;


        let sharesAlreadyOwned =
            stock.owned;


        let totalThreshold =
            stock.currentThreshold;


        let nextBlockSize =
            stock.nextBlockSize;


        for (
            let i = 1;
            i <=
            MAX_FUTURE_INCREMENTS;
            i++
        ) {

            const nextTarget =
                totalThreshold +
                nextBlockSize;


            const sharesNeeded =
                Math.max(
                    0,
                    nextTarget -
                    sharesAlreadyOwned
                );


            const incrementCost =
                sharesNeeded *
                stock.stockPrice;


            const monthlyValue =
                valuePerIncrement /
                12;


            const marginalROI =
                incrementCost >
                0

                    ? (
                        valuePerIncrement /
                        incrementCost
                    ) *
                    100

                    : 0;


            const paybackMonths =
                monthlyValue >
                0

                    ? incrementCost /
                        monthlyValue

                    : null;


            if (
                maxPayback >
                0 &&
                (
                    !Number.isFinite(
                        paybackMonths
                    ) ||
                    paybackMonths >
                    maxPayback
                )
            ) {

                break;
            }


            if (
                minROI >
                0 &&
                marginalROI <
                minROI
            ) {

                break;
            }


            cumulativeCost +=
                incrementCost;


            cumulativeAnnual +=
                valuePerIncrement;


            if (
                cumulativeCost >
                budget
            ) {

                break;
            }


            const previousIncrements =
                options[
                    options.length -
                    1
                ].increments;


            const costPerMillionMonthly =
                monthlyValue >
                0

                    ? incrementCost /
                        (
                            monthlyValue /
                            1_000_000
                        )

                    : null;


            const newIncrement = {

                fromTier:
                    currentTier,

                toTier:
                    currentTier +
                    1,

                shares:
                    sharesNeeded,

                cost:
                    incrementCost,

                annualValue:
                    valuePerIncrement,

                monthlyValue,

                marginalROI,

                paybackMonths,

                costPerMillionMonthly
            };


            options.push({

                count:
                    i,

                cost:
                    cumulativeCost,

                annualValue:
                    cumulativeAnnual,

                monthlyValue:
                    cumulativeAnnual /
                    12,

                increments: [
                    ...previousIncrements,
                    newIncrement
                ]
            });


            sharesAlreadyOwned =
                nextTarget;


            totalThreshold =
                nextTarget;


            nextBlockSize *=
                2;


            currentTier++;
        }


        return options;
    }


    // ============================================================
    // OPTIMIZER
    // ============================================================

    function optimizeBudget(
        rows,
        budget,
        ownedOnly,
        maxPayback,
        minROI
    ) {

        let eligibleStocks =
            rows.filter(
                stock =>
                    Number.isFinite(
                        stock.payoutValue
                    ) &&
                    stock.frequencyDays
            );


        if (
            ownedOnly
        ) {

            eligibleStocks =
                eligibleStocks.filter(
                    stock =>
                        stock.owned >
                        0
                );
        }


        const budgetUnits =
            Math.floor(
                budget /
                OPTIMIZER_STEP
            );


        let states =
            new Map();


        states.set(
            0,
            {

                annualValue:
                    0,

                choices:
                    []
            }
        );


        for (
            const stock of
            eligibleStocks
        ) {

            const options =
                buildFutureOptions(
                    stock,
                    budget,
                    maxPayback,
                    minROI
                );


            const newStates =
                new Map();


            for (
                const [
                    usedUnits,
                    state
                ] of states
            ) {

                for (
                    const option of
                    options
                ) {

                    const optionUnits =
                        Math.ceil(
                            option.cost /
                            OPTIMIZER_STEP
                        );


                    const newUsed =
                        usedUnits +
                        optionUnits;


                    if (
                        newUsed >
                        budgetUnits
                    ) {

                        continue;
                    }


                    const newAnnual =
                        state.annualValue +
                        option.annualValue;


                    const existing =
                        newStates.get(
                            newUsed
                        );


                    if (
                        !existing ||
                        newAnnual >
                        existing.annualValue
                    ) {

                        newStates.set(
                            newUsed,
                            {

                                annualValue:
                                    newAnnual,

                                choices: [
                                    ...state.choices,

                                    {
                                        stock,
                                        option
                                    }
                                ]
                            }
                        );
                    }
                }
            }


            const sortedStates =
                [
                    ...newStates.entries()
                ]
                    .sort(
                        (a, b) =>
                            a[0] -
                            b[0]
                    );


            states =
                new Map();


            let bestValueSoFar =
                -1;


            for (
                const [
                    units,
                    state
                ] of sortedStates
            ) {

                if (
                    state.annualValue >
                    bestValueSoFar
                ) {

                    states.set(
                        units,
                        state
                    );


                    bestValueSoFar =
                        state.annualValue;
                }
            }
        }


        let best =
            null;


        for (
            const [
                ,
                state
            ] of states
        ) {

            if (
                !best ||
                state.annualValue >
                best.annualValue
            ) {

                best =
                    state;
            }
        }


        if (!best) {
            return null;
        }


        const selected =
            best.choices
                .filter(
                    choice =>
                        choice.option.count >
                        0
                );


        const exactCost =
            selected.reduce(
                (
                    total,
                    choice
                ) =>
                    total +
                    choice.option.cost,
                0
            );


        const annualValue =
            selected.reduce(
                (
                    total,
                    choice
                ) =>
                    total +
                    choice.option.annualValue,
                0
            );


        const monthlyValue =
            annualValue /
            12;


        const roi =
            exactCost >
            0

                ? (
                    annualValue /
                    exactCost
                ) *
                100

                : 0;


        const paybackMonths =
            monthlyValue >
            0

                ? exactCost /
                    monthlyValue

                : null;


        return {

            budget,

            exactCost,

            unusedBudget:
                budget -
                exactCost,

            annualValue,

            monthlyValue,

            roi,

            paybackMonths,

            choices:
                selected,

            minROI,

            maxPayback
        };
    }


    // ============================================================
    // PANEL POSITION / SIZE
    // ============================================================

    function loadPanelPosition() {

        try {

            return JSON.parse(
                localStorage.getItem(
                    PANEL_POSITION_STORAGE
                )
            ) ||
            null;

        } catch {

            return null;
        }
    }


    function savePanelPosition(
        left,
        top
    ) {

        localStorage.setItem(
            PANEL_POSITION_STORAGE,
            JSON.stringify({
                left,
                top
            })
        );
    }


    function loadPanelSize() {

        try {

            return JSON.parse(
                localStorage.getItem(
                    PANEL_SIZE_STORAGE
                )
            ) ||
            null;

        } catch {

            return null;
        }
    }


    function savePanelSize(
        width,
        height
    ) {

        localStorage.setItem(
            PANEL_SIZE_STORAGE,
            JSON.stringify({
                width,
                height
            })
        );
    }


    // ============================================================
    // PANEL
    // ============================================================

    function createPanel() {

        const old =
            document.getElementById(
                'tsa-panel'
            );


        if (old) {
            old.remove();
        }


        const panel =
            document.createElement(
                'div'
            );


        panel.id =
            'tsa-panel';


        const storedPosition =
            loadPanelPosition();


        const storedSize =
            loadPanelSize();


        Object.assign(
            panel.style,
            {

                position:
                    'fixed',

                left:
                    storedPosition
                        ?.left ??
                    'auto',

                top:
                    storedPosition
                        ?.top ??
                    '60px',

                right:
                    storedPosition
                        ? 'auto'
                        : '15px',

                width:
                    storedSize
                        ?.width ??
                    '980px',

                height:
                    storedSize
                        ?.height ??
                    '720px',

                maxWidth:
                    '96vw',

                maxHeight:
                    '92vh',

                border:
                    '1px solid #666',

                borderRadius:
                    '10px',

                padding:
                    '14px 14px 30px 14px',

                zIndex:
                    '99999',

                fontFamily:
                    'Arial, sans-serif',

                fontSize:
                    '13px',

                boxShadow:
                    '0 4px 16px rgba(0,0,0,.7)'
            }
        );


        panel.innerHTML = `

            <div
                id="tsa-drag-handle"
                style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:10px;
                "
            >

                <h2
                    style="
                        margin:0;
                        color:#fff;
                        font-size:20px;
                    "
                >
                    📊 Torn Stock Advisor
                </h2>


                <button
                    id="tsa-close"
                    style="
                        background:#3a3a3a;
                        border:1px solid #777;
                        border-radius:5px;
                        padding:4px 9px;
                        cursor:pointer;
                    "
                >
                    ✕
                </button>

            </div>


            <div
                class="tsa-summary-box"
                style="
                    margin-bottom:12px;
                "
            >

                <div
                    class="tsa-section-title"
                    style="
                        margin-bottom:8px;
                    "
                >
                    💰 Investment Budget Optimizer
                </div>


                <div
                    style="
                        display:flex;
                        gap:7px;
                        align-items:center;
                        flex-wrap:wrap;
                    "
                >

                    <label
                        style="
                            color:#ddd !important;
                        "
                    >
                        Available Cash:
                    </label>


                    <span
                        style="
                            color:#ddd !important;
                        "
                    >
                        $
                    </span>


                    <input
                        id="tsa-available-cash"
                        type="text"
                        placeholder="8b"
                        style="
                            width:120px;
                            padding:7px 9px;
                            border-radius:5px;
                        "
                    >


                    <label
                        style="
                            color:#ddd !important;
                        "
                    >
                        Cash Reserve:
                    </label>


                    <span
                        style="
                            color:#ddd !important;
                        "
                    >
                        $
                    </span>


                    <input
                        id="tsa-reserve-cash"
                        type="text"
                        placeholder="1b"
                        style="
                            width:110px;
                            padding:7px 9px;
                            border-radius:5px;
                        "
                    >


                    <label
                        style="
                            color:#ddd !important;
                        "
                    >
                        Consider:
                    </label>


                    <select
                        id="tsa-opt-owned"
                        style="
                            padding:6px 8px;
                            border-radius:5px;
                        "
                    >

                        <option value="all">
                            All Stocks
                        </option>

                        <option value="owned">
                            Owned Only
                        </option>

                    </select>


                    <label
                        style="
                            color:#ddd !important;
                        "
                    >
                        Max Payback:
                    </label>


                    <select
                        id="tsa-opt-payback"
                        style="
                            padding:6px 8px;
                            border-radius:5px;
                        "
                    >

                        <option value="0">
                            No Limit
                        </option>

                        <option value="12">
                            12 months
                        </option>

                        <option value="24">
                            24 months
                        </option>

                        <option value="36">
                            36 months
                        </option>

                        <option value="48">
                            48 months
                        </option>

                        <option value="60">
                            60 months
                        </option>

                        <option value="84">
                            84 months
                        </option>

                        <option value="120">
                            120 months
                        </option>

                    </select>


                    <label
                        style="
                            color:#ddd !important;
                        "
                    >
                        Min ROI:
                    </label>


                    <input
                        id="tsa-min-roi"
                        type="number"
                        min="0"
                        max="1000"
                        step="0.5"
                        placeholder="0"
                        style="
                            width:70px;
                            padding:7px;
                            border-radius:5px;
                        "
                    >


                    <span
                        style="
                            color:#ddd !important;
                        "
                    >
                        %
                    </span>


                    <button
                        id="tsa-optimize"
                        style="
                            background:#356b3b;
                            border:1px solid #777;
                            border-radius:5px;
                            padding:8px 14px;
                            cursor:pointer;
                            white-space:nowrap;
                        "
                    >
                        Find Best Combination
                    </button>

                </div>


                <div
                    class="tsa-small-note"
                    style="
                        margin-top:7px;
                    "
                >
                    Example:
                    Available 8b • Reserve 1b =
                    $7b investment budget.
                    Min ROI 20 means only recommend
                    increments at 20%+ est. annual ROI.
                </div>


                <div
                    id="tsa-budget-preview"
                    style="
                        margin-top:8px;
                        color:#ddd !important;
                        font-size:11px;
                    "
                >
                </div>


                <div
                    id="tsa-optimizer-results"
                    style="
                        margin-top:10px;
                    "
                >
                </div>

            </div>


            <div
                class="tsa-filter-bar"
            >

                <span
                    class="tsa-section-title"
                >
                    Stock Browser
                </span>


                <label
                    style="
                        color:#ddd !important;
                    "
                >
                    Show:
                </label>


                <select
                    id="tsa-browser-owned"
                    style="
                        padding:5px 8px;
                        border-radius:5px;
                    "
                >

                    <option value="all">
                        All Stocks
                    </option>

                    <option value="owned">
                        Owned Only
                    </option>

                </select>


                <label
                    style="
                        color:#ddd !important;
                    "
                >
                    Max Payback:
                </label>


                <select
                    id="tsa-browser-payback"
                    style="
                        padding:5px 8px;
                        border-radius:5px;
                    "
                >

                    <option value="0">
                        No Limit
                    </option>

                    <option value="12">
                        12 months
                    </option>

                    <option value="24">
                        24 months
                    </option>

                    <option value="36">
                        36 months
                    </option>

                    <option value="48">
                        48 months
                    </option>

                    <option value="60">
                        60 months
                    </option>

                    <option value="84">
                        84 months
                    </option>

                    <option value="120">
                        120 months
                    </option>

                </select>


                <button
                    id="tsa-reset-browser"
                    style="
                        background:#3a3a3a;
                        border:1px solid #777;
                        border-radius:5px;
                        padding:6px 10px;
                        cursor:pointer;
                    "
                >
                    Reset Filters
                </button>


                <div
                    class="tsa-small-note"
                    style="
                        margin-left:auto;
                    "
                >
                    Drag title bar • Resize with ◢
                </div>

            </div>


            <div
                style="
                    display:flex;
                    gap:8px;
                    margin-bottom:12px;
                "
            >

                <button
                    id="tsa-roi"
                    style="
                        flex:1;
                        padding:7px;
                        cursor:pointer;
                        background:#356b3b;
                        border:1px solid #777;
                        border-radius:5px;
                    "
                >
                    Best Market ROI
                </button>


                <button
                    id="tsa-cost"
                    style="
                        flex:1;
                        padding:7px;
                        cursor:pointer;
                        background:#333;
                        border:1px solid #777;
                        border-radius:5px;
                    "
                >
                    Cheapest Next Tier
                </button>


                <button
                    id="tsa-refresh"
                    style="
                        padding:7px 12px;
                        cursor:pointer;
                        background:#333;
                        border:1px solid #777;
                        border-radius:5px;
                    "
                >
                    ↻ Prices
                </button>

            </div>


            <div
                id="tsa-status"
            >
                Loading...
            </div>


            <div
                id="tsa-resize-handle"
                title="Drag to resize"
            >
                ◢
            </div>
        `;


        document.body.appendChild(
            panel
        );


        panel
            .querySelector(
                '#tsa-close'
            )
            .addEventListener(
                'click',
                () =>
                    panel.remove()
            );


        enableDragging(
            panel
        );


        enableCustomResize(
            panel
        );


        return panel;
    }


    // ============================================================
    // DRAGGING
    // ============================================================

    function enableDragging(
        panel
    ) {

        const handle =
            panel.querySelector(
                '#tsa-drag-handle'
            );


        let dragging =
            false;


        let startMouseX =
            0;


        let startMouseY =
            0;


        let startLeft =
            0;


        let startTop =
            0;


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


                startMouseX =
                    event.clientX;


                startMouseY =
                    event.clientY;


                startLeft =
                    rect.left;


                startTop =
                    rect.top;


                panel.style.right =
                    'auto';


                event.preventDefault();
            }
        );


        document.addEventListener(
            'mousemove',
            event => {

                if (
                    !dragging
                ) {

                    return;
                }


                let newLeft =
                    startLeft +
                    (
                        event.clientX -
                        startMouseX
                    );


                let newTop =
                    startTop +
                    (
                        event.clientY -
                        startMouseY
                    );


                newLeft =
                    Math.max(
                        0,
                        Math.min(
                            newLeft,
                            window.innerWidth -
                            100
                        )
                    );


                newTop =
                    Math.max(
                        0,
                        Math.min(
                            newTop,
                            window.innerHeight -
                            50
                        )
                    );


                panel.style.left =
                    newLeft +
                    'px';


                panel.style.top =
                    newTop +
                    'px';
            }
        );


        document.addEventListener(
            'mouseup',
            () => {

                if (
                    !dragging
                ) {

                    return;
                }


                dragging =
                    false;


                const rect =
                    panel.getBoundingClientRect();


                savePanelPosition(
                    rect.left +
                    'px',

                    rect.top +
                    'px'
                );
            }
        );
    }


    // ============================================================
    // CUSTOM RESIZE
    // ============================================================

    function enableCustomResize(
        panel
    ) {

        const handle =
            panel.querySelector(
                '#tsa-resize-handle'
            );


        let resizing =
            false;


        let startMouseX =
            0;


        let startMouseY =
            0;


        let startWidth =
            0;


        let startHeight =
            0;


        handle.addEventListener(
            'mousedown',
            event => {

                resizing =
                    true;


                startMouseX =
                    event.clientX;


                startMouseY =
                    event.clientY;


                startWidth =
                    panel.offsetWidth;


                startHeight =
                    panel.offsetHeight;


                document.body.style.userSelect =
                    'none';


                event.preventDefault();

                event.stopPropagation();
            }
        );


        document.addEventListener(
            'mousemove',
            event => {

                if (
                    !resizing
                ) {

                    return;
                }


                const deltaX =
                    event.clientX -
                    startMouseX;


                const deltaY =
                    event.clientY -
                    startMouseY;


                let newWidth =
                    startWidth +
                    deltaX;


                let newHeight =
                    startHeight +
                    deltaY;


                const rect =
                    panel.getBoundingClientRect();


                const maxWidth =
                    Math.max(
                        MIN_PANEL_WIDTH,
                        window.innerWidth -
                        rect.left -
                        10
                    );


                const maxHeight =
                    Math.max(
                        MIN_PANEL_HEIGHT,
                        window.innerHeight -
                        rect.top -
                        10
                    );


                newWidth =
                    Math.max(
                        MIN_PANEL_WIDTH,
                        Math.min(
                            newWidth,
                            maxWidth
                        )
                    );


                newHeight =
                    Math.max(
                        MIN_PANEL_HEIGHT,
                        Math.min(
                            newHeight,
                            maxHeight
                        )
                    );


                panel.style.width =
                    newWidth +
                    'px';


                panel.style.height =
                    newHeight +
                    'px';
            }
        );


        document.addEventListener(
            'mouseup',
            () => {

                if (
                    !resizing
                ) {

                    return;
                }


                resizing =
                    false;


                document.body.style.userSelect =
                    '';


                savePanelSize(
                    panel.offsetWidth +
                    'px',

                    panel.offsetHeight +
                    'px'
                );
            }
        );
    }


    // ============================================================
    // BROWSER FILTER
    // ============================================================

    function applyDisplayFilters(
        rows,
        ownedOnly,
        maxPayback
    ) {

        return rows.filter(
            stock => {

                if (
                    ownedOnly &&
                    stock.owned <=
                    0
                ) {

                    return false;
                }


                if (
                    maxPayback >
                    0
                ) {

                    if (
                        !Number.isFinite(
                            stock.paybackMonths
                        )
                    ) {

                        return false;
                    }


                    if (
                        stock.paybackMonths >
                        maxPayback
                    ) {

                        return false;
                    }
                }


                return true;
            }
        );
    }


    // ============================================================
    // STOCK TABLE
    // ============================================================

    function renderTable(
        rows,
        status,
        sortMode,
        updatedAt,
        ownedOnly,
        maxPayback
    ) {

        const filtered =
            applyDisplayFilters(
                rows,
                ownedOnly,
                maxPayback
            );


        const sorted =
            [...filtered];


        if (
            sortMode ===
            'roi'
        ) {

            sorted.sort(
                (a, b) => {

                    const aROI =
                        Number.isFinite(
                            a.roi
                        )
                            ? a.roi
                            : -1;


                    const bROI =
                        Number.isFinite(
                            b.roi
                        )
                            ? b.roi
                            : -1;


                    return bROI -
                        aROI;
                }
            );

        } else {

            sorted.sort(
                (a, b) =>
                    a.nextCost -
                    b.nextCost
            );
        }


        let html = `

            <div
                style="
                    margin-bottom:6px;
                    color:#ccc !important;
                "
            >

                ${
                    sortMode === 'roi'
                        ? 'Ranked using exact cash payouts or current Torn Item Market values.'
                        : 'Ranked by the cash needed to reach your next benefit increment.'
                }

            </div>


            <div
                class="tsa-small-note"
                style="
                    margin-bottom:10px;
                "
            >

                Browser filters:
                <strong style="color:#ddd !important;">
                    ${
                        ownedOnly
                            ? 'Owned only'
                            : 'All stocks'
                    }
                </strong>

                ${
                    maxPayback >
                    0
                        ? ` • Max payback: ${maxPayback} months`
                        : ' • No payback limit'
                }

                <br>

                Estimates change as Torn stock prices
                and Item Market prices move.

                Market values updated:
                <strong style="color:#ddd !important;">
                    ${formatTimestamp(
                        new Date(
                            updatedAt
                        )
                    )}
                </strong>

            </div>


            <table
                style="
                    width:100%;
                    border-collapse:collapse;
                    font-size:11px;
                "
            >

                <thead>

                    <tr>

                        <th style="text-align:left;padding:7px;">
                            Stock
                        </th>

                        <th style="text-align:center;padding:7px;">
                            Tier
                        </th>

                        <th style="text-align:right;padding:7px;">
                            Need
                        </th>

                        <th style="text-align:right;padding:7px;">
                            Cost
                        </th>

                        <th style="text-align:right;padding:7px;">
                            Reward
                        </th>

                        <th style="text-align:right;padding:7px;">
                            Est. / Month
                        </th>

                        <th style="text-align:right;padding:7px;">
                            Est. ROI
                        </th>

                        <th style="text-align:right;padding:7px;">
                            Est. Payback
                        </th>

                    </tr>

                </thead>


                <tbody>
        `;


        let ranked =
            0;


        for (
            const stock of
            sorted
        ) {

            let medal =
                '';


            if (
                sortMode ===
                    'roi' &&
                Number.isFinite(
                    stock.roi
                )
            ) {

                ranked++;


                if (
                    ranked ===
                    1
                ) {

                    medal =
                        '🥇 ';
                }


                if (
                    ranked ===
                    2
                ) {

                    medal =
                        '🥈 ';
                }


                if (
                    ranked ===
                    3
                ) {

                    medal =
                        '🥉 ';
                }
            }


            html += `

                <tr
                    style="
                        border-bottom:
                        1px solid #444;
                    "
                >

                    <td style="padding:8px 6px;">

                        <div class="tsa-stock">
                            ${medal}${stock.acronym}
                        </div>

                        <div class="tsa-name">
                            ${stock.name}
                        </div>

                        <div class="tsa-benefit">
                            ${stock.benefitName}
                        </div>

                        <div class="tsa-price">
                            ${money(
                                stock.stockPrice
                            )}
                            / share
                        </div>

                        <div class="tsa-market">
                            ${stock.valueSource}
                        </div>

                        ${
                            stock.owned >
                            0
                                ? `
                                    <div class="tsa-small-note">
                                        Owned:
                                        ${shares(
                                            stock.owned
                                        )}
                                    </div>
                                `
                                : ''
                        }

                    </td>


                    <td
                        class="tsa-normal"
                        style="
                            text-align:center;
                            padding:8px 5px;
                        "
                    >
                        ${stock.currentIncrement}
                        →
                        ${stock.nextIncrement}
                    </td>


                    <td
                        class="tsa-normal"
                        style="
                            text-align:right;
                            padding:8px 5px;
                        "
                    >
                        ${shares(
                            stock.sharesNeeded
                        )}
                    </td>


                    <td
                        class="tsa-cost"
                        style="
                            text-align:right;
                            padding:8px 5px;
                        "
                    >
                        ${money(
                            stock.nextCost
                        )}
                    </td>


                    <td
                        class="tsa-normal"
                        style="
                            text-align:right;
                            padding:8px 5px;
                        "
                    >
                        ${
                            Number.isFinite(
                                stock.payoutValue
                            )
                                ? money(
                                    stock.payoutValue
                                )
                                : 'N/A'
                        }
                    </td>


                    <td
                        class="tsa-normal"
                        style="
                            text-align:right;
                            padding:8px 5px;
                        "
                    >
                        ${
                            Number.isFinite(
                                stock.monthlyValue
                            )
                                ? money(
                                    stock.monthlyValue
                                )
                                : 'N/A'
                        }
                    </td>


                    <td
                        class="${getRoiClass(
                            stock.roi
                        )}"
                        style="
                            text-align:right;
                            padding:8px 5px;
                        "
                    >
                        ${
                            Number.isFinite(
                                stock.roi
                            )
                                ? percent(
                                    stock.roi
                                )
                                : 'N/A'
                        }
                    </td>


                    <td
                        class="tsa-normal"
                        style="
                            text-align:right;
                            padding:8px 5px;
                        "
                    >
                        ${
                            Number.isFinite(
                                stock.paybackMonths
                            )
                                ? stock
                                    .paybackMonths
                                    .toFixed(1) +
                                    ' mo'
                                : 'N/A'
                        }
                    </td>

                </tr>
            `;
        }


        if (
            !sorted.length
        ) {

            html += `

                <tr>

                    <td
                        colspan="8"
                        style="
                            text-align:center;
                            padding:20px;
                            color:#aaa !important;
                        "
                    >
                        No stocks match the Stock Browser filters.
                    </td>

                </tr>
            `;
        }


        html += `

                </tbody>

            </table>


            <div
                class="tsa-small-note"
                style="
                    margin-top:12px;
                    padding:9px;
                    background:#242424;
                    border-radius:5px;
                "
            >

                <strong style="color:#ddd !important;">
                    Estimates only.
                </strong>

                Stock prices and Item Market prices can
                rise or fall, so actual returns may differ.

                Cash benefits use exact payout amounts,
                but ROI still changes with stock purchase price.

                Tradable benefits use current market values.

                Benefits without an objective market value
                remain N/A.

            </div>
        `;


        status.innerHTML =
            html;
    }


    // ============================================================
    // OPTIMIZER RESULT
    // ============================================================

    function renderOptimizerResult(
        result,
        container,
        updatedAt,
        availableCash,
        reserveCash,
        ownedOnly,
        maxPayback,
        minROI
    ) {

        if (
            !result ||
            !result.choices.length
        ) {

            container.innerHTML = `

                <div
                    style="
                        color:#ff9292 !important;
                    "
                >
                    No qualifying stock increment fits
                    inside the available investment budget.
                </div>
            `;


            return;
        }


        const purchaseRows =
            [];


        for (
            const choice of
            result.choices
        ) {

            for (
                const increment of
                choice.option.increments
            ) {

                purchaseRows.push({

                    stock:
                        choice.stock,

                    increment
                });
            }
        }


        purchaseRows.sort(
            (a, b) =>
                b.increment.marginalROI -
                a.increment.marginalROI
        );


        let rowsHtml =
            '';


        for (
            const row of
            purchaseRows
        ) {

            const stock =
                row.stock;


            const increment =
                row.increment;


            const priority =
                getPriority(
                    increment.marginalROI
                );


            const costPerMillion =
                Number.isFinite(
                    increment
                        .costPerMillionMonthly
                )

                    ? money(
                        increment
                            .costPerMillionMonthly
                    )

                    : 'N/A';


            rowsHtml += `

                <tr
                    style="
                        border-bottom:
                        1px solid #444;
                    "
                >

                    <td style="padding:7px;">

                        <div class="tsa-stock">
                            ${stock.acronym}
                        </div>

                        <div class="tsa-name">
                            ${stock.name}
                        </div>

                        <div class="tsa-benefit">
                            ${stock.benefitName}
                        </div>

                    </td>


                    <td
                        class="tsa-normal"
                        style="
                            text-align:center;
                            padding:7px;
                        "
                    >
                        ${increment.fromTier}
                        →
                        ${increment.toTier}
                    </td>


                    <td
                        class="tsa-normal"
                        style="
                            text-align:right;
                            padding:7px;
                        "
                    >
                        ${shares(
                            increment.shares
                        )}
                    </td>


                    <td
                        class="tsa-cost"
                        style="
                            text-align:right;
                            padding:7px;
                        "
                    >
                        ${money(
                            increment.cost
                        )}
                    </td>


                    <td
                        class="tsa-normal"
                        style="
                            text-align:right;
                            padding:7px;
                        "
                    >
                        ${money(
                            increment.monthlyValue
                        )}
                    </td>


                    <td
                        class="${getRoiClass(
                            increment.marginalROI
                        )}"
                        style="
                            text-align:right;
                            padding:7px;
                        "
                    >
                        ${percent(
                            increment.marginalROI
                        )}
                    </td>


                    <td
                        class="${priority.className}"
                        style="
                            text-align:center;
                            padding:7px;
                        "
                    >
                        ${priority.text}
                    </td>


                    <td
                        class="tsa-normal"
                        style="
                            text-align:right;
                            padding:7px;
                        "
                    >
                        ${
                            Number.isFinite(
                                increment.paybackMonths
                            )
                                ? increment
                                    .paybackMonths
                                    .toFixed(1) +
                                    ' mo'
                                : 'N/A'
                        }
                    </td>


                    <td
                        class="tsa-normal"
                        style="
                            text-align:right;
                            padding:7px;
                        "
                    >
                        ${costPerMillion}
                    </td>

                </tr>
            `;
        }


        const totalCashRemaining =
            reserveCash +
            result.unusedBudget;


        const leftoverReason =
            result.unusedBudget >
            1_000_000

                ? (
                    minROI >
                    0

                        ? `An additional ${money(result.unusedBudget)} remains outside the planned reserve because no further progressive increment meets the ${minROI}% minimum estimated ROI and other selected filters.`

                        : `An additional ${money(result.unusedBudget)} remains outside the planned reserve because no further qualifying increment fits the remaining investment budget.`
                )

                : 'Nearly the entire investment budget is allocated.';


        container.innerHTML = `

            <div
                style="
                    border-top:
                    1px solid #555;
                    padding-top:10px;
                "
            >

                <div
                    style="
                        display:grid;
                        grid-template-columns:
                            repeat(8, 1fr);
                        gap:6px;
                        margin-bottom:10px;
                    "
                >

                    <div class="tsa-summary-box">

                        <div class="tsa-small-note">
                            Available Cash
                        </div>

                        <div class="tsa-blue">
                            ${money(
                                availableCash
                            )}
                        </div>

                    </div>


                    <div class="tsa-summary-box">

                        <div class="tsa-small-note">
                            Cash Reserve
                        </div>

                        <div class="tsa-normal">
                            ${money(
                                reserveCash
                            )}
                        </div>

                    </div>


                    <div class="tsa-summary-box">

                        <div class="tsa-small-note">
                            Investment Budget
                        </div>

                        <div class="tsa-blue">
                            ${money(
                                result.budget
                            )}
                        </div>

                    </div>


                    <div class="tsa-summary-box">

                        <div class="tsa-small-note">
                            Invest
                        </div>

                        <div class="tsa-green">
                            ${money(
                                result.exactCost
                            )}
                        </div>

                    </div>


                    <div class="tsa-summary-box">

                        <div class="tsa-small-note">
                            Unused Budget
                        </div>

                        <div class="tsa-normal">
                            ${money(
                                result.unusedBudget
                            )}
                        </div>

                    </div>


                    <div class="tsa-summary-box">

                        <div class="tsa-small-note">
                            Cash Left Total
                        </div>

                        <div class="tsa-normal">
                            ${money(
                                totalCashRemaining
                            )}
                        </div>

                    </div>


                    <div class="tsa-summary-box">

                        <div class="tsa-small-note">
                            Est. Added / Month
                        </div>

                        <div class="tsa-blue">
                            ${money(
                                result.monthlyValue
                            )}
                        </div>

                    </div>


                    <div class="tsa-summary-box">

                        <div class="tsa-small-note">
                            Est. Added / Year
                        </div>

                        <div class="tsa-blue">
                            ${money(
                                result.annualValue
                            )}
                        </div>

                    </div>

                </div>


                <div
                    style="
                        display:grid;
                        grid-template-columns:
                            repeat(2, 180px);
                        gap:6px;
                        margin-bottom:10px;
                    "
                >

                    <div class="tsa-summary-box">

                        <div class="tsa-small-note">
                            Est. Annual ROI
                        </div>

                        <div class="tsa-yellow">
                            ${percent(
                                result.roi
                            )}
                        </div>

                    </div>


                    <div class="tsa-summary-box">

                        <div class="tsa-small-note">
                            Est. Payback
                        </div>

                        <div class="tsa-normal">
                            ${
                                Number.isFinite(
                                    result.paybackMonths
                                )
                                    ? result
                                        .paybackMonths
                                        .toFixed(1) +
                                        ' mo'
                                    : 'N/A'
                            }
                        </div>

                    </div>

                </div>


                <div
                    class="tsa-small-note"
                    style="
                        margin-bottom:8px;
                        padding:8px;
                        background:#202020;
                        border-radius:5px;
                    "
                >

                    <strong style="color:#ddd !important;">
                        Cash plan:
                    </strong>

                    You chose to reserve
                    <strong style="color:#ddd !important;">
                        ${money(reserveCash)}
                    </strong>.

                    ${leftoverReason}

                </div>


                <div
                    class="tsa-small-note"
                    style="
                        margin-bottom:10px;
                    "
                >

                    Optimizer:
                    <strong style="color:#ddd !important;">
                        ${
                            ownedOnly
                                ? 'Owned stocks only'
                                : 'All stocks'
                        }
                    </strong>

                    ${
                        maxPayback >
                        0
                            ? ` • Max payback: ${maxPayback} months`
                            : ' • No payback limit'
                    }

                    ${
                        minROI >
                        0
                            ? ` • Minimum ROI: ${minROI}%`
                            : ' • No minimum ROI'
                    }

                    <br>

                    <strong style="color:#ddd !important;">
                        Estimates only.
                    </strong>

                    Results use current stock and Item Market prices.

                    Actual returns change as prices move.

                    Market values updated:
                    <strong style="color:#ddd !important;">
                        ${formatTimestamp(
                            new Date(
                                updatedAt
                            )
                        )}
                    </strong>

                </div>


                <div
                    style="
                        color:#fff !important;
                        font-weight:bold;
                        margin-bottom:6px;
                    "
                >
                    Recommended purchases
                </div>


                <table
                    style="
                        width:100%;
                        border-collapse:collapse;
                        font-size:11px;
                    "
                >

                    <thead>

                        <tr>

                            <th style="text-align:left;padding:7px;">
                                Stock
                            </th>

                            <th style="text-align:center;padding:7px;">
                                Tier
                            </th>

                            <th style="text-align:right;padding:7px;">
                                Buy Shares
                            </th>

                            <th style="text-align:right;padding:7px;">
                                Cost
                            </th>

                            <th style="text-align:right;padding:7px;">
                                Est. +/Month
                            </th>

                            <th style="text-align:right;padding:7px;">
                                Est. ROI
                            </th>

                            <th style="text-align:center;padding:7px;">
                                Priority
                            </th>

                            <th style="text-align:right;padding:7px;">
                                Est. Payback
                            </th>

                            <th style="text-align:right;padding:7px;">
                                Est. Cost per +$1M/mo
                            </th>

                        </tr>

                    </thead>


                    <tbody>
                        ${rowsHtml}
                    </tbody>

                </table>

            </div>
        `;
    }


    // ============================================================
    // MAIN
    // ============================================================

    async function main() {

        injectStyles();


        const panel =
            createPanel();


        const status =
            panel.querySelector(
                '#tsa-status'
            );


        const optimizerResults =
            panel.querySelector(
                '#tsa-optimizer-results'
            );


        const budgetPreview =
            panel.querySelector(
                '#tsa-budget-preview'
            );


        const availableCashInput =
            panel.querySelector(
                '#tsa-available-cash'
            );


        const reserveCashInput =
            panel.querySelector(
                '#tsa-reserve-cash'
            );


        const minROIInput =
            panel.querySelector(
                '#tsa-min-roi'
            );


        const optimizeButton =
            panel.querySelector(
                '#tsa-optimize'
            );


        const optOwned =
            panel.querySelector(
                '#tsa-opt-owned'
            );


        const optPayback =
            panel.querySelector(
                '#tsa-opt-payback'
            );


        const browserOwned =
            panel.querySelector(
                '#tsa-browser-owned'
            );


        const browserPayback =
            panel.querySelector(
                '#tsa-browser-payback'
            );


        const resetBrowser =
            panel.querySelector(
                '#tsa-reset-browser'
            );


        const roiButton =
            panel.querySelector(
                '#tsa-roi'
            );


        const costButton =
            panel.querySelector(
                '#tsa-cost'
            );


        const refreshButton =
            panel.querySelector(
                '#tsa-refresh'
            );


        let sortMode =
            'roi';


        let rows =
            [];


        let marketUpdatedAt =
            Date.now();


        // ========================================================
        // RESTORE SETTINGS
        // ========================================================

        const savedAvailable =
            localStorage.getItem(
                AVAILABLE_CASH_STORAGE
            );


        if (
            savedAvailable
        ) {

            availableCashInput.value =
                savedAvailable;
        }


        const savedReserve =
            localStorage.getItem(
                RESERVE_CASH_STORAGE
            );


        if (
            savedReserve
        ) {

            reserveCashInput.value =
                savedReserve;
        }


        const savedMinROI =
            localStorage.getItem(
                OPTIMIZER_MIN_ROI_STORAGE
            );


        if (
            savedMinROI !==
            null
        ) {

            minROIInput.value =
                savedMinROI;
        }


        const savedBrowserOwned =
            localStorage.getItem(
                BROWSER_OWNED_FILTER_STORAGE
            );


        if (
            savedBrowserOwned ===
            'owned'
        ) {

            browserOwned.value =
                'owned';
        }


        const savedBrowserPayback =
            localStorage.getItem(
                BROWSER_PAYBACK_FILTER_STORAGE
            );


        if (
            savedBrowserPayback
        ) {

            browserPayback.value =
                savedBrowserPayback;
        }


        const savedOptimizerOwned =
            localStorage.getItem(
                OPTIMIZER_OWNED_FILTER_STORAGE
            );


        if (
            savedOptimizerOwned ===
            'owned'
        ) {

            optOwned.value =
                'owned';
        }


        const savedOptimizerPayback =
            localStorage.getItem(
                OPTIMIZER_PAYBACK_FILTER_STORAGE
            );


        if (
            savedOptimizerPayback
        ) {

            optPayback.value =
                savedOptimizerPayback;
        }


        // ========================================================
        // API KEY
        // ========================================================

        let apiKey =
            getApiKey();


        if (!apiKey) {

            apiKey =
                askForApiKey();
        }


        if (!apiKey) {

            status.innerHTML =
                '<span style="color:#ff8d8d !important;">❌ API key required.</span>';

            return;
        }


        // ========================================================
        // CURRENT SETTINGS
        // ========================================================

        function browserOwnedOnly() {

            return (
                browserOwned.value ===
                'owned'
            );
        }


        function browserMaxPayback() {

            const value =
                Number(
                    browserPayback.value
                );


            return Number.isFinite(
                value
            )
                ? value
                : 0;
        }


        function optimizerOwnedOnly() {

            return (
                optOwned.value ===
                'owned'
            );
        }


        function optimizerMaxPayback() {

            const value =
                Number(
                    optPayback.value
                );


            return Number.isFinite(
                value
            )
                ? value
                : 0;
        }


        function optimizerMinROI() {

            const value =
                Number(
                    minROIInput.value
                );


            return Number.isFinite(
                value
            ) &&
            value >
            0

                ? value

                : 0;
        }


        // ========================================================
        // BUDGET PREVIEW
        // ========================================================

        function updateBudgetPreview() {

            const available =
                parseMoneyInput(
                    availableCashInput.value
                );


            const reserve =
                reserveCashInput.value.trim()
                    ? parseMoneyInput(
                        reserveCashInput.value
                    )
                    : 0;


            if (
                !Number.isFinite(
                    available
                )
            ) {

                budgetPreview.innerHTML =
                    '';

                return;
            }


            if (
                !Number.isFinite(
                    reserve
                ) ||
                reserve <
                0
            ) {

                budgetPreview.innerHTML = `

                    <span
                        style="
                            color:#ff9292 !important;
                        "
                    >
                        Invalid reserve amount.
                    </span>
                `;

                return;
            }


            const budget =
                available -
                reserve;


            if (
                budget <=
                0
            ) {

                budgetPreview.innerHTML = `

                    <span
                        style="
                            color:#ff9292 !important;
                        "
                    >
                        Reserve must be less than available cash.
                    </span>
                `;

                return;
            }


            budgetPreview.innerHTML = `

                Available:
                <strong style="color:#8cd8ff !important;">
                    ${money(available)}
                </strong>

                •

                Reserve:
                <strong style="color:#ddd !important;">
                    ${money(reserve)}
                </strong>

                •

                Investment Budget:
                <strong style="color:#79f29a !important;">
                    ${money(budget)}
                </strong>
            `;
        }


        // ========================================================
        // REDRAW
        // ========================================================

        function redraw() {

            renderTable(
                rows,
                status,
                sortMode,
                marketUpdatedAt,
                browserOwnedOnly(),
                browserMaxPayback()
            );


            if (
                sortMode ===
                'roi'
            ) {

                roiButton.style.background =
                    '#356b3b';


                costButton.style.background =
                    '#333';

            } else {

                roiButton.style.background =
                    '#333';


                costButton.style.background =
                    '#356b3b';
            }
        }


        // ========================================================
        // LOAD DATA
        // ========================================================

        async function loadEverything(
            forceMarketRefresh =
                false
        ) {

            try {

                if (
                    forceMarketRefresh
                ) {

                    localStorage.removeItem(
                        MARKET_CACHE_KEY
                    );
                }


                optimizerResults.innerHTML =
                    '';


                status.innerHTML = `

                    <div
                        style="
                            color:#f5f5f5 !important;
                            padding:10px;
                        "
                    >
                        ⏳ Loading Torn stock information...
                    </div>
                `;


                const [
                    allStocks,
                    userStocks
                ] =
                    await Promise.all([

                        apiRequest(
                            `https://api.torn.com/v2/torn/stocks?key=${apiKey}`
                        ),

                        apiRequest(
                            `https://api.torn.com/v2/user/stocks?key=${apiKey}`
                        )
                    ]);


                const benefitResult =
                    await loadBenefitValues(

                        apiKey,

                        message => {

                            status.innerHTML = `

                                <div
                                    style="
                                        color:#f5f5f5 !important;
                                        padding:10px;
                                    "
                                >
                                    ⏳ ${message}
                                </div>
                            `;
                        }
                    );


                marketUpdatedAt =
                    benefitResult.updatedAt;


                rows =
                    buildStockRows(

                        allStocks.stocks,

                        userStocks.stocks,

                        benefitResult.values
                    );


                redraw();


            } catch (error) {

                console.error(
                    error
                );


                status.innerHTML = `

                    <div
                        style="
                            color:#ff8d8d !important;
                            font-weight:bold;
                        "
                    >
                        ❌ Stock Advisor Error
                    </div>


                    <div
                        style="
                            color:#fff !important;
                            margin-top:8px;
                        "
                    >
                        ${error.message}
                    </div>
                `;
            }
        }


        // ========================================================
        // OPTIMIZER
        // ========================================================

        optimizeButton
            .addEventListener(
                'click',
                () => {

                    const rawAvailable =
                        availableCashInput.value;


                    const rawReserve =
                        reserveCashInput.value;


                    const availableCash =
                        parseMoneyInput(
                            rawAvailable
                        );


                    const reserveCash =
                        rawReserve.trim()

                            ? parseMoneyInput(
                                rawReserve
                            )

                            : 0;


                    if (
                        !Number.isFinite(
                            availableCash
                        ) ||
                        availableCash <=
                        0
                    ) {

                        optimizerResults.innerHTML = `

                            <div
                                style="
                                    color:#ff9292 !important;
                                "
                            >
                                Enter valid available cash.
                                Example: 8b
                            </div>
                        `;


                        return;
                    }


                    if (
                        !Number.isFinite(
                            reserveCash
                        ) ||
                        reserveCash <
                        0
                    ) {

                        optimizerResults.innerHTML = `

                            <div
                                style="
                                    color:#ff9292 !important;
                                "
                            >
                                Enter a valid reserve amount.
                            </div>
                        `;


                        return;
                    }


                    if (
                        reserveCash >=
                        availableCash
                    ) {

                        optimizerResults.innerHTML = `

                            <div
                                style="
                                    color:#ff9292 !important;
                                "
                            >
                                Cash reserve must be less than available cash.
                            </div>
                        `;


                        return;
                    }


                    const investmentBudget =
                        availableCash -
                        reserveCash;


                    const minROI =
                        optimizerMinROI();


                    localStorage.setItem(
                        AVAILABLE_CASH_STORAGE,
                        rawAvailable.trim()
                    );


                    localStorage.setItem(
                        RESERVE_CASH_STORAGE,
                        rawReserve.trim()
                    );


                    localStorage.setItem(
                        OPTIMIZER_MIN_ROI_STORAGE,
                        String(
                            minROI
                        )
                    );


                    optimizerResults.innerHTML = `

                        <div
                            style="
                                color:#ddd !important;
                            "
                        >
                            ⏳ Calculating best combination...
                        </div>
                    `;


                    setTimeout(
                        () => {

                            const result =
                                optimizeBudget(

                                    rows,

                                    investmentBudget,

                                    optimizerOwnedOnly(),

                                    optimizerMaxPayback(),

                                    minROI
                                );


                            renderOptimizerResult(

                                result,

                                optimizerResults,

                                marketUpdatedAt,

                                availableCash,

                                reserveCash,

                                optimizerOwnedOnly(),

                                optimizerMaxPayback(),

                                minROI
                            );

                        },
                        20
                    );
                }
            );


        // ========================================================
        // INPUT PREVIEW
        // ========================================================

        availableCashInput
            .addEventListener(
                'input',
                updateBudgetPreview
            );


        reserveCashInput
            .addEventListener(
                'input',
                updateBudgetPreview
            );


        // ========================================================
        // OPTIMIZER SETTINGS
        // ========================================================

        optOwned
            .addEventListener(
                'change',
                () => {

                    localStorage.setItem(
                        OPTIMIZER_OWNED_FILTER_STORAGE,
                        optOwned.value
                    );


                    optimizerResults.innerHTML =
                        '';
                }
            );


        optPayback
            .addEventListener(
                'change',
                () => {

                    localStorage.setItem(
                        OPTIMIZER_PAYBACK_FILTER_STORAGE,
                        optPayback.value
                    );


                    optimizerResults.innerHTML =
                        '';
                }
            );


        minROIInput
            .addEventListener(
                'change',
                () => {

                    localStorage.setItem(
                        OPTIMIZER_MIN_ROI_STORAGE,
                        String(
                            optimizerMinROI()
                        )
                    );


                    optimizerResults.innerHTML =
                        '';
                }
            );


        // ========================================================
        // BROWSER FILTERS
        // ========================================================

        browserOwned
            .addEventListener(
                'change',
                () => {

                    localStorage.setItem(
                        BROWSER_OWNED_FILTER_STORAGE,
                        browserOwned.value
                    );


                    redraw();
                }
            );


        browserPayback
            .addEventListener(
                'change',
                () => {

                    localStorage.setItem(
                        BROWSER_PAYBACK_FILTER_STORAGE,
                        browserPayback.value
                    );


                    redraw();
                }
            );


        resetBrowser
            .addEventListener(
                'click',
                () => {

                    browserOwned.value =
                        'all';


                    browserPayback.value =
                        '0';


                    localStorage.setItem(
                        BROWSER_OWNED_FILTER_STORAGE,
                        'all'
                    );


                    localStorage.setItem(
                        BROWSER_PAYBACK_FILTER_STORAGE,
                        '0'
                    );


                    redraw();
                }
            );


        // ========================================================
        // TABS
        // ========================================================

        roiButton
            .addEventListener(
                'click',
                () => {

                    sortMode =
                        'roi';


                    redraw();
                }
            );


        costButton
            .addEventListener(
                'click',
                () => {

                    sortMode =
                        'cost';


                    redraw();
                }
            );


        // ========================================================
        // REFRESH
        // ========================================================

        refreshButton
            .addEventListener(
                'click',
                () => {

                    loadEverything(
                        true
                    );
                }
            );


        // ========================================================
        // ENTER KEY
        // ========================================================

        availableCashInput
            .addEventListener(
                'keydown',
                event => {

                    if (
                        event.key ===
                        'Enter'
                    ) {

                        optimizeButton.click();
                    }
                }
            );


        reserveCashInput
            .addEventListener(
                'keydown',
                event => {

                    if (
                        event.key ===
                        'Enter'
                    ) {

                        optimizeButton.click();
                    }
                }
            );


        minROIInput
            .addEventListener(
                'keydown',
                event => {

                    if (
                        event.key ===
                        'Enter'
                    ) {

                        optimizeButton.click();
                    }
                }
            );


        updateBudgetPreview();


        await loadEverything();
    }


    main();

})();

// ==UserScript==
// @name         D's Torn Item Flipper - Beta
// @namespace    https://github.com/djoiner89/torn-stock-tools
// @version      1.1.2
// @description  Scans Torn Item Market listings for realistic flip opportunities, market depth, ROI, and estimated profit.
// @match        https://www.torn.com/*
// @updateURL    https://raw.githubusercontent.com/djoiner89/torn-stock-tools/main/ds-torn-item-flipper.user.js
// @downloadURL  https://raw.githubusercontent.com/djoiner89/torn-stock-tools/main/ds-torn-item-flipper.user.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ============================================================
    // STORAGE / SETTINGS
    // ============================================================

    const PANEL_ID = 'dtif-panel';

    const API_KEY_STORAGE =
        'dtif_api_key';

    const WATCHLIST_STORAGE =
        'dtif_watchlist';

    const MIN_ROI_STORAGE =
        'dtif_min_roi';

    const MIN_PROFIT_STORAGE =
        'dtif_min_profit';

    const RESULTS_STORAGE =
        'dtif_last_results_v1';

    const BUDGET_STORAGE =
        'dtif_budget';

    const PANEL_POS_STORAGE =
        'dtif_panel_position';

    const PANEL_SIZE_STORAGE =
        'dtif_panel_size';

    const CACHE_STORAGE =
        'dtif_market_cache';

    const CACHE_MS =
        2 * 60 * 1000;

    const REQUEST_DELAY_MS =
        700;

    const ITEM_MARKET_MAX_ATTEMPTS =
        3;

    const ITEM_MARKET_RETRY_DELAY_MS =
        1200;

    // We use item names instead of hard-coded IDs.
    // The script resolves the current Torn item IDs automatically.
    const DEFAULT_WATCHLIST = [
        'Xanax',
        'Feathery Hotel Coupon',
        'Donator Pack',
        'Erotic DVD',
        'Six-Pack of Alcohol',
        'Six-Pack of Energy Drink',
        'Drug Pack',
        'Lottery Voucher',
        'Box of Medical Supplies',
        'Box of Grenades',
        'Bottle of Beer',
        'Bottle of Champagne',
        'Bottle of Tequila',
        'Morphine',
        'First Aid Kit',
        'Small First Aid Kit',
        'Box of Chocolate Bars',
        'Box of Bon Bons',
        'Box of Sweet Hearts',
        'Box of Extra Strong Mints',
        'Can of Taurine Elite',
        'Can of Munster',
        'Can of Red Cow',
        'Can of Goose Juice',
        'Can of Crocozade',
        'Chamois Plushie',
        'Jaguar Plushie',
        'Wolverine Plushie',
        'Nessie Plushie',
        'Red Fox Plushie',
        'Monkey Plushie',
        'Panda Plushie',
        'Camel Plushie',
        'Lion Plushie',
        'Dahlia',
        'Crocus',
        'Orchid',
        'Heather',
        'Ceibo Flower',
        'Edelweiss',
        'Cherry Blossom',
        'Peony'
    ];

    let currentResults = [];
    let currentSort = 'score';

    // ============================================================
    // BASIC HELPERS
    // ============================================================

    function sleep(ms) {
        return new Promise(
            resolve => setTimeout(resolve, ms)
        );
    }

    function clamp(value, min, max) {
        return Math.max(
            min,
            Math.min(max, value)
        );
    }

    function normalizeName(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    function money(value) {
        if (!Number.isFinite(value)) {
            return 'N/A';
        }

        if (value >= 1_000_000_000) {
            return '$' +
                (value / 1_000_000_000)
                    .toFixed(2) +
                'B';
        }

        if (value >= 1_000_000) {
            return '$' +
                (value / 1_000_000)
                    .toFixed(2) +
                'M';
        }

        if (value >= 1_000) {
            return '$' +
                (value / 1_000)
                    .toFixed(2) +
                'K';
        }

        return '$' +
            Math.round(value)
                .toLocaleString();
    }

    function exactMoney(value) {
        if (!Number.isFinite(value)) {
            return 'N/A';
        }

        return '$' +
            Math.round(value)
                .toLocaleString();
    }

    function percent(value) {
        if (!Number.isFinite(value)) {
            return 'N/A';
        }

        return value.toFixed(2) + '%';
    }

    function parseMoneyInput(value) {
        if (!value) {
            return NaN;
        }

        const cleaned =
            String(value)
                .trim()
                .toLowerCase()
                .replace(/[$,\s]/g, '');

        const match =
            cleaned.match(
                /^(\d+(?:\.\d+)?)([kmbt])?$/
            );

        if (!match) {
            return NaN;
        }

        const number =
            Number(match[1]);

        const suffix =
            match[2] || '';

        const multipliers = {
            '': 1,
            k: 1_000,
            m: 1_000_000,
            b: 1_000_000_000,
            t: 1_000_000_000_000
        };

        return number *
            multipliers[suffix];
    }

    function median(values) {
        if (!values.length) {
            return null;
        }

        const sorted =
            [...values]
                .sort((a, b) => a - b);

        const middle =
            Math.floor(
                sorted.length / 2
            );

        if (
            sorted.length % 2
        ) {
            return sorted[middle];
        }

        return (
            sorted[middle - 1] +
            sorted[middle]
        ) / 2;
    }

    function loadJSON(key, fallback = null) {
        try {
            const raw =
                localStorage.getItem(key);

            if (!raw) {
                return fallback;
            }

            return JSON.parse(raw);

        } catch {
            return fallback;
        }
    }

    function saveJSON(key, value) {
        localStorage.setItem(
            key,
            JSON.stringify(value)
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
                '• Purpose: Read Torn item and Item Market data to find flip opportunities.\n' +
                '• Data storage: API key, settings, cache, and scan results are stored only in this browser.\n' +
                '• Data sharing: Nobody. Nothing is sent to the developer or any third party.\n' +
                '• Key storage/sharing: Stored locally in your browser and never shared.\n' +
                '• Required access: Only Torn item data and Market Item Market data used by this tool.\n\n' +
                'By entering a key, you acknowledge this local-only use.'
            );

        if (!key) {
            return null;
        }

        const trimmed =
            key.trim();

        saveApiKey(trimmed);

        return trimmed;
    }

    // ============================================================
    // API
    // ============================================================

    async function apiRequest(
        url,
        apiKey = null
    ) {
        const options = {};

        if (apiKey) {
            options.headers = {
                'Accept': 'application/json',
                'Authorization':
                    `ApiKey ${apiKey}`
            };
        }

        const response =
            await fetch(
                url,
                options
            );

        let data = null;

        try {
            data =
                await response.json();
        } catch {
            // Keep HTTP error below readable.
        }

        if (!response.ok) {
            const detail =
                data?.error?.error ||
                data?.error?.message ||
                data?.message ||
                '';

            throw new Error(
                `Torn API request failed (${response.status})` +
                (detail ? `: ${detail}` : '')
            );
        }

        if (data?.error) {
            throw new Error(
                data.error.error ||
                data.error.message ||
                'Torn API error'
            );
        }

        return data;
    }

    // ============================================================
    // CACHE
    // ============================================================

    function loadCache() {
        const cache =
            loadJSON(
                CACHE_STORAGE,
                {}
            );

        return cache &&
            typeof cache === 'object'
            ? cache
            : {};
    }

    function saveCache(cache) {
        saveJSON(
            CACHE_STORAGE,
            cache
        );
    }


    // ============================================================
    // ITEM LIST
    // ============================================================

    async function getTornItems(apiKey) {
        const data =
            await apiRequest(
                `https://api.torn.com/v2/torn/items?key=${apiKey}`
            );

        return Array.isArray(data.items)
            ? data.items
            : [];
    }

    function buildItemMap(items) {
        const map =
            new Map();

        for (const item of items) {
            if (!item?.name) {
                continue;
            }

            map.set(
                normalizeName(item.name),
                item
            );
        }

        return map;
    }

    // ============================================================
    // LISTING EXTRACTION
    //
    // Torn's v2 Item Market has stackable and non-stackable listing
    // schemas. This scanner intentionally walks the returned object
    // recursively so small response-shape changes don't kill the beta.
    // ============================================================

    function extractListings(data) {
        const found = [];

        function walk(value) {
            if (!value) {
                return;
            }

            if (Array.isArray(value)) {
                for (const child of value) {
                    walk(child);
                }

                return;
            }

            if (typeof value !== 'object') {
                return;
            }

            const priceCandidates = [
                value.price,
                value.cost,
                value.amount_price,
                value.total_price
            ];

            const price =
                priceCandidates
                    .map(Number)
                    .find(
                        number =>
                            Number.isFinite(number) &&
                            number > 0
                    );

            if (Number.isFinite(price)) {
                const quantityCandidates = [
                    value.amount,
                    value.quantity,
                    value.qty,
                    value.available
                ];

                const quantity =
                    quantityCandidates
                        .map(Number)
                        .find(
                            number =>
                                Number.isFinite(number) &&
                                number > 0
                        ) || 1;

                const seller =
                    value.user?.name ||
                    value.seller?.name ||
                    value.user_name ||
                    value.seller_name ||
                    '';

                const sellerId =
                    Number(
                        value.user?.id ||
                        value.seller?.id ||
                        value.user_id ||
                        value.seller_id ||
                        0
                    ) || null;

                found.push({
                    price,
                    quantity:
                        Math.max(
                            1,
                            Math.floor(quantity)
                        ),
                    seller,
                    sellerId
                });
            }

            for (
                const child of
                Object.values(value)
            ) {
                if (
                    child &&
                    typeof child ===
                        'object'
                ) {
                    walk(child);
                }
            }
        }

        walk(data);

        // Deduplicate identical recursive discoveries.
        const unique =
            new Map();

        for (const listing of found) {
            const key = [
                listing.price,
                listing.quantity,
                listing.sellerId || '',
                listing.seller || ''
            ].join('|');

            if (!unique.has(key)) {
                unique.set(
                    key,
                    listing
                );
            }
        }

        return [
            ...unique.values()
        ].sort(
            (a, b) =>
                a.price - b.price
        );
    }

    // ============================================================
    // ITEM MARKET
    // ============================================================

    async function getItemMarket(
        itemId,
        apiKey,
        force = false
    ) {
        const cache =
            loadCache();

        const key =
            String(itemId);

        const cached =
            cache[key];

        if (
            !force &&
            cached &&
            Date.now() -
                cached.time <
                CACHE_MS
        ) {
            return {
                listings:
                    cached.listings || [],
                cached:
                    true,
                timestamp:
                    cached.time
            };
        }

        // Current Torn API v2 Item Market endpoint.
        // Use Authorization header instead of exposing the key in the URL.
        const data =
            await apiRequest(
                `https://api.torn.com/v2/market/${itemId}/itemmarket?offset=0`,
                apiKey
            );

        // Current v2 response is normally:
        // { itemmarket: { item: {...}, listings: [...] } }
        // Keep the older generic extractor as a fallback.
        const rawListings =
            Array.isArray(
                data?.itemmarket?.listings
            )
                ? data.itemmarket.listings
                : [];

        let listings = [];

        if (rawListings.length) {
            listings =
                rawListings
                    .map(entry => {
                        const price =
                            Number(
                                entry?.price ??
                                entry?.cost ??
                                0
                            );

                        const quantity =
                            Number(
                                entry?.amount ??
                                entry?.quantity ??
                                entry?.qty ??
                                1
                            );

                        if (
                            !Number.isFinite(price) ||
                            price <= 0
                        ) {
                            return null;
                        }

                        return {
                            price,
                            quantity:
                                Number.isFinite(quantity) &&
                                quantity > 0
                                    ? quantity
                                    : 1
                        };
                    })
                    .filter(Boolean)
                    .sort(
                        (a, b) =>
                            a.price - b.price
                    );
        }

        if (!listings.length) {
            listings =
                extractListings(data);
        }

        cache[key] = {
            time:
                Date.now(),
            listings
        };

        saveCache(cache);

        return {
            listings,
            cached:
                false,
            timestamp:
                Date.now()
        };
    }

    async function getItemMarketWithRetry(
        itemId,
        apiKey,
        force = false
    ) {
        let lastError = null;

        for (
            let attempt = 1;
            attempt <= ITEM_MARKET_MAX_ATTEMPTS;
            attempt++
        ) {
            try {
                return await getItemMarket(
                    itemId,
                    apiKey,
                    force
                );

            } catch (error) {
                lastError = error;

                console.warn(
                    `Item Market ${itemId} failed attempt ${attempt}/${ITEM_MARKET_MAX_ATTEMPTS}:`,
                    error
                );

                if (
                    attempt <
                    ITEM_MARKET_MAX_ATTEMPTS
                ) {
                    await sleep(
                        ITEM_MARKET_RETRY_DELAY_MS *
                        attempt
                    );
                }
            }
        }

        throw lastError ||
            new Error(
                'Item Market request failed'
            );
    }


    // ============================================================
    // BAZAAR DIRECTORY / PRICE EXTRACTION
    //
    // Torn currently exposes bazaar directory endpoints, but the exact
    // data available can differ from Item Market listings. This beta
    // attempts to extract price/quantity pairs when they are present.
    // If Torn does not provide usable listing prices, Bazaar will show N/A.
    // ============================================================

    function extractBazaarListings(data) {
        const found = [];

        function walk(value) {
            if (!value) return;

            if (Array.isArray(value)) {
                for (const child of value) {
                    walk(child);
                }
                return;
            }

            if (typeof value !== 'object') {
                return;
            }

            const price =
                [
                    value.price,
                    value.cost,
                    value.item_price,
                    value.listing_price
                ]
                    .map(Number)
                    .find(
                        number =>
                            Number.isFinite(number) &&
                            number > 0
                    );

            if (Number.isFinite(price)) {
                const quantity =
                    [
                        value.amount,
                        value.quantity,
                        value.qty,
                        value.available
                    ]
                        .map(Number)
                        .find(
                            number =>
                                Number.isFinite(number) &&
                                number > 0
                        ) || 1;

                const seller =
                    value.user?.name ||
                    value.owner?.name ||
                    value.seller?.name ||
                    value.name ||
                    '';

                const sellerId =
                    Number(
                        value.user?.id ||
                        value.owner?.id ||
                        value.seller?.id ||
                        value.user_id ||
                        value.owner_id ||
                        value.seller_id ||
                        0
                    ) || null;

                found.push({
                    price,
                    quantity:
                        Math.max(
                            1,
                            Math.floor(quantity)
                        ),
                    seller,
                    sellerId
                });
            }

            for (
                const child of
                Object.values(value)
            ) {
                if (
                    child &&
                    typeof child === 'object'
                ) {
                    walk(child);
                }
            }
        }

        walk(data);

        const unique =
            new Map();

        for (const listing of found) {
            const key = [
                listing.price,
                listing.quantity,
                listing.sellerId || '',
                listing.seller || ''
            ].join('|');

            if (!unique.has(key)) {
                unique.set(key, listing);
            }
        }

        return [
            ...unique.values()
        ].sort(
            (a, b) =>
                a.price - b.price
        );
    }

    async function getBazaarMarket(
        itemId,
        apiKey,
        force = false
    ) {
        const cache =
            loadBazaarCache();

        const key =
            String(itemId);

        const cached =
            cache[key];

        if (
            !force &&
            cached &&
            Date.now() -
                cached.time <
                CACHE_MS
        ) {
            return {
                listings:
                    cached.listings || [],
                cached:
                    true,
                timestamp:
                    cached.time
            };
        }

        try {
            const data =
                await apiRequest(
                    `https://api.torn.com/v2/market/${itemId}/bazaar?key=${apiKey}`
                );

            const listings =
                extractBazaarListings(data);

            cache[key] = {
                time:
                    Date.now(),
                listings
            };

            saveBazaarCache(cache);

            return {
                listings,
                cached:
                    false,
                timestamp:
                    Date.now()
            };

        } catch (error) {
            console.warn(
                `Bazaar data unavailable for item ${itemId}:`,
                error
            );

            return {
                listings: [],
                cached: false,
                timestamp: Date.now(),
                error:
                    error.message
            };
        }
    }

    // ============================================================
    // MARKET DEPTH / REALISTIC RESALE
    // ============================================================

    function expandPriceSample(
        listings,
        maxUnits = 80
    ) {
        const sample = [];

        for (const listing of listings) {
            const copies =
                Math.min(
                    listing.quantity,
                    maxUnits -
                        sample.length
                );

            for (
                let i = 0;
                i < copies;
                i++
            ) {
                sample.push(
                    listing.price
                );
            }

            if (
                sample.length >=
                maxUnits
            ) {
                break;
            }
        }

        return sample;
    }

    function calculateResalePrice(
        listings
    ) {
        if (
            !Array.isArray(listings) ||
            listings.length < 2
        ) {
            return null;
        }

        const sample =
            expandPriceSample(
                listings,
                60
            );

        if (
            sample.length < 3
        ) {
            return null;
        }

        // Ignore the very cheapest few units when estimating the
        // price cluster we'd expect the item to move back toward.
        const skip =
            Math.max(
                1,
                Math.min(
                    5,
                    Math.floor(
                        sample.length *
                        0.10
                    )
                )
            );

        const cluster =
            sample.slice(
                skip,
                Math.min(
                    sample.length,
                    skip + 25
                )
            );

        if (!cluster.length) {
            return null;
        }

        return median(cluster);
    }

    function analyzeFlip(
        item,
        listings,
        budget,
        bazaarListings = []
    ) {
        if (
            !listings.length
        ) {
            return null;
        }

        const lowest =
            listings[0].price;

        const resale =
            calculateResalePrice(
                listings
            );

        if (
            !Number.isFinite(resale) ||
            resale <= lowest
        ) {
            return {
                item,
                listings,
                lowest,
                resale:
                    resale || lowest,
                buyUnits: 0,
                capital: 0,
                revenue: 0,
                profit: 0,
                roi: 0,
                spreadPct: 0,
                score: 0,
                confidence: 'LOW',
                rating: 'SKIP',
                cutoffPrice: lowest,
                depthUnits: 0,
                cheapListingCount: 0,
                resaleSupportCount: 0,
                resaleSupportUnits: 0,
                hasResaleSupport: false,
                meaningfulProfit: 0,
                strongProfit: 0,
                itemMarketResale:
                    resale || lowest,
                bazaarListings,
                bazaarLowest:
                    bazaarListings.length
                        ? bazaarListings[0].price
                        : null,
                bazaarResale:
                    calculateResalePrice(
                        bazaarListings
                    ),
                bestExit:
                    'Item Market'
            };
        }

        // Leave a small cushion below the estimated resale cluster.
        // Bazaar sales have no item-market listing fee, but prices can move,
        // so this buffer is for slippage rather than a formal fee.
        const targetSell =
            resale * 0.995;

        const rawSpread =
            targetSell -
            lowest;

        const spreadPct =
            (
                rawSpread /
                lowest
            ) * 100;

        // Only consider buys that leave at least ~1.5% gross room
        // beneath our estimated target.
        const maxBuyPrice =
            targetSell /
            1.015;

        let buyUnits = 0;
        let capital = 0;
        let revenue = 0;

        const affordableBudget =
            Number.isFinite(budget) &&
            budget > 0
                ? budget
                : Infinity;

        for (const listing of listings) {
            if (
                listing.price >
                maxBuyPrice
            ) {
                break;
            }

            const affordableUnits =
                affordableBudget ===
                    Infinity
                    ? listing.quantity
                    : Math.floor(
                        (
                            affordableBudget -
                            capital
                        ) /
                        listing.price
                    );

            if (
                affordableUnits <= 0
            ) {
                break;
            }

            const quantity =
                Math.min(
                    listing.quantity,
                    affordableUnits
                );

            buyUnits +=
                quantity;

            capital +=
                quantity *
                listing.price;

            revenue +=
                quantity *
                targetSell;

            if (
                capital >=
                affordableBudget
            ) {
                break;
            }
        }

        const profit =
            revenue -
            capital;

        const roi =
            capital > 0
                ? (
                    profit /
                    capital
                ) *
                    100
                : 0;

        const cheapListingCount =
            listings.filter(
                listing =>
                    listing.price <=
                    maxBuyPrice
            ).length;

        const depthUnits =
            listings.reduce(
                (total, listing) =>
                    total +
                    (
                        listing.price <=
                        maxBuyPrice
                            ? listing.quantity
                            : 0
                    ),
                0
            );

        let confidenceScore = 0;

        confidenceScore +=
            Math.min(
                listings.length,
                20
            ) * 2;

        confidenceScore +=
            Math.min(
                expandPriceSample(
                    listings,
                    60
                ).length,
                60
            ) * 0.5;

        if (
            resale >
            lowest * 1.03
        ) {
            confidenceScore += 10;
        }

        if (
            cheapListingCount >= 2
        ) {
            confidenceScore += 5;
        }

        // Large cheap depth can mean the "deal" is actually
        // the new normal price, so penalize it somewhat.
        if (
            depthUnits >= 100
        ) {
            confidenceScore -= 12;

        } else if (
            depthUnits >= 40
        ) {
            confidenceScore -= 6;
        }

        const confidence =
            confidenceScore >= 55
                ? 'HIGH'
                : confidenceScore >= 32
                    ? 'MEDIUM'
                    : 'LOW';

        // Require real listing support around the projected resale price.
        // This reduces false positives caused by a thin or odd order book.
        const resaleSupportLow =
            targetSell * 0.975;
        const resaleSupportHigh =
            targetSell * 1.025;

        const resaleSupportListings =
            listings.filter(
                listing =>
                    listing.price >= resaleSupportLow &&
                    listing.price <= resaleSupportHigh
            );

        const resaleSupportCount =
            resaleSupportListings.length;

        const resaleSupportUnits =
            resaleSupportListings.reduce(
                (total, listing) =>
                    total + Number(listing.quantity || 0),
                0
            );

        const hasResaleSupport =
            resaleSupportCount >= 2 &&
            resaleSupportUnits >= 3;

        let score = 0;

        score +=
            clamp(
                roi * 5,
                0,
                45
            );

        score +=
            clamp(
                Math.log10(
                    Math.max(
                        profit,
                        1
                    )
                ) * 8 -
                30,
                0,
                25
            );

        score +=
            confidence === 'HIGH'
                ? 20
                : confidence ===
                    'MEDIUM'
                    ? 10
                    : 0;

        score +=
            buyUnits > 0
                ? 10
                : 0;

        // Supported exits get a modest boost; thin exits are penalized.
        score +=
            hasResaleSupport
                ? 8
                : -15;

        score =
            clamp(
                score,
                0,
                100
            );

        const bazaarLowest =
            bazaarListings.length
                ? bazaarListings[0].price
                : null;

        const bazaarResaleRaw =
            calculateResalePrice(
                bazaarListings
            );

        const bazaarResale =
            Number.isFinite(
                bazaarResaleRaw
            )
                ? bazaarResaleRaw * 0.995
                : null;

        let bestExit =
            'Item Market';

        let bestResale =
            targetSell;

        if (
            Number.isFinite(
                bazaarResale
            ) &&
            bazaarResale >
                bestResale
        ) {
            bestExit =
                'Bazaar';

            bestResale =
                bazaarResale;
        }

        // Recalculate projected revenue/profit using the better visible exit.
        const bestRevenue =
            buyUnits *
            bestResale;

        const bestProfit =
            bestRevenue -
            capital;

        const bestROI =
            capital > 0
                ? (
                    bestProfit /
                    capital
                ) *
                    100
                : 0;

        let rating =
            'SKIP';

        // Adaptive rating: judge profit in relation to the capital at
        // risk instead of requiring the same dollar profit on every item.
        // A small, liquid trade can therefore rate well without being
        // compared unfairly with a multi-million-dollar flip.
        const meaningfulProfit =
            Math.max(
                250,
                capital * 0.01
            );

        const strongProfit =
            Math.max(
                1000,
                capital * 0.03
            );

        if (
            score >= 80 &&
            bestROI >= 10 &&
            bestProfit >= strongProfit &&
            hasResaleSupport
        ) {
            rating =
                'GREAT FLIP';

        } else if (
            score >= 60 &&
            bestROI >= 5 &&
            bestProfit >= meaningfulProfit &&
            hasResaleSupport
        ) {
            rating =
                'GOOD FLIP';

        } else if (
            score >= 40 &&
            bestROI >= 2 &&
            bestProfit >= 100
        ) {
            rating =
                'MARGINAL';
        }

        return {
            item,
            listings,
            bazaarListings,
            lowest,
            itemMarketResale:
                targetSell,
            bazaarLowest,
            bazaarResale,
            resale:
                bestResale,
            bestExit,
            buyUnits,
            capital,
            revenue:
                bestRevenue,
            profit:
                bestProfit,
            roi:
                bestROI,
            spreadPct:
                lowest > 0
                    ? (
                        (
                            bestResale -
                            lowest
                        ) /
                        lowest
                    ) * 100
                    : 0,
            score,
            confidence,
            rating,
            cutoffPrice:
                maxBuyPrice,
            depthUnits,
            cheapListingCount,
            resaleSupportCount,
            resaleSupportUnits,
            hasResaleSupport,
            meaningfulProfit,
            strongProfit
        };
    }

    // ============================================================
    // STYLES
    // ============================================================

    function injectStyles() {
        const old =
            document.getElementById(
                'dtif-styles'
            );

        if (old) {
            old.remove();
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'dtif-styles';

        style.textContent = `
            #${PANEL_ID} {
                position:fixed;
                top:80px;
                right:12px;
                width:520px;
                height:760px;
                min-width:400px;
                min-height:420px;
                max-width:95vw;
                max-height:92vh;
                padding:12px 12px 28px 12px;
                background:#181818 !important;
                color:#f5f5f5 !important;
                border:1px solid #666;
                border-radius:9px;
                box-shadow:0 5px 20px rgba(0,0,0,.75);
                z-index:999999;
                overflow:auto;
                font-family:Arial,sans-serif;
                font-size:12px;
            }

            #${PANEL_ID} * {
                box-sizing:border-box;
            }

            #dtif-header {
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:8px;
                cursor:move;
                user-select:none;
                margin-bottom:10px;
            }

            #dtif-title {
                color:#fff !important;
                font-size:18px;
                font-weight:bold;
            }

            #${PANEL_ID} button,
            #${PANEL_ID} input,
            #${PANEL_ID} textarea,
            #${PANEL_ID} select {
                background:#292929 !important;
                color:#fff !important;
                border:1px solid #666;
                border-radius:5px;
                font-size:11px;
            }

            #${PANEL_ID} button {
                cursor:pointer;
                padding:7px 10px;
            }

            #${PANEL_ID} .dtif-primary {
                background:#356b3b !important;
            }

            #${PANEL_ID} .dtif-market-link {
                transition:
                    transform 0.12s ease,
                    border-color 0.12s ease,
                    box-shadow 0.12s ease;
            }

            #${PANEL_ID} .dtif-market-link:hover {
                transform: translateY(-1px);
                border-color: #5b9bd5 !important;
                box-shadow:
                    0 0 0 1px rgba(91,155,213,0.22);
            }

            #${PANEL_ID} .dtif-card {
                background:#222 !important;
                border:1px solid #444;
                border-radius:7px;
                padding:10px;
                margin-bottom:10px;
            }

            #${PANEL_ID} .dtif-small {
                color:#aaa !important;
                font-size:10px;
                line-height:1.35;
            }

            #${PANEL_ID} .dtif-green {
                color:#79f29a !important;
                font-weight:bold;
            }

            #${PANEL_ID} .dtif-yellow {
                color:#f2dc72 !important;
                font-weight:bold;
            }

            #${PANEL_ID} .dtif-red {
                color:#ff9292 !important;
                font-weight:bold;
            }

            #${PANEL_ID} .dtif-blue {
                color:#8cd8ff !important;
                font-weight:bold;
            }

            #${PANEL_ID} table {
                width:100%;
                border-collapse:collapse;
                font-size:10px;
            }

            #${PANEL_ID} th {
                background:#303030 !important;
                color:#fff !important;
                padding:6px 5px;
                text-align:right;
                white-space:nowrap;
            }

            #${PANEL_ID} th:first-child {
                text-align:left;
            }

            #${PANEL_ID} td {
                background:#1d1d1d !important;
                color:#eee !important;
                border-bottom:1px solid #414141;
                padding:6px 5px;
                text-align:right;
                vertical-align:top;
            }

            #${PANEL_ID} td:first-child {
                text-align:left;
            }

            #dtif-table-wrap {
                overflow-x:auto;
                border:1px solid #444;
                border-radius:6px;
            }

            #dtif-resize {
                position:absolute;
                right:2px;
                bottom:2px;
                width:27px;
                height:27px;
                line-height:25px;
                text-align:center;
                cursor:nwse-resize;
                background:#292929 !important;
                color:#aaa !important;
                border-top:1px solid #666;
                border-left:1px solid #666;
                user-select:none;
            }
        `;

        document.head.appendChild(
            style
        );
    }

    // ============================================================
    // PANEL POSITION / SIZE
    // ============================================================

    function getSavedPosition() {
        return loadJSON(
            PANEL_POS_STORAGE,
            null
        );
    }

    function getSavedSize() {
        return loadJSON(
            PANEL_SIZE_STORAGE,
            null
        );
    }

    // ============================================================
    // PANEL
    // ============================================================

    function createPanel() {
        const old =
            document.getElementById(
                PANEL_ID
            );

        if (old) {
            old.remove();
        }

        const panel =
            document.createElement(
                'div'
            );

        panel.id =
            PANEL_ID;

        const savedPos =
            getSavedPosition();

        const savedSize =
            getSavedSize();

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
            <div id="dtif-header">
                <div id="dtif-title">
                    🛒 D's Torn Item Flipper - 1.1.2
                </div>

                <button id="dtif-close">
                    ✕
                </button>
            </div>

            <div class="dtif-card">
                <div style="
                    display:grid;
                    grid-template-columns:1fr 1fr;
                    gap:7px;
                    margin-bottom:7px;
                ">
                    <label>
                        Budget
                        <input
                            id="dtif-budget"
                            type="text"
                            value="500m"
                            style="width:100%;padding:6px;"
                        >
                    </label>

                    <label>
                        Min ROI %
                        <input
                            id="dtif-min-roi"
                            type="number"
                            min="0"
                            step="0.5"
                            value="5"
                            style="width:100%;padding:6px;"
                        >
                    </label>

                    <label style="grid-column:1 / -1;">
                        Min Total Profit
                        <input
                            id="dtif-min-profit"
                            type="text"
                            value="100k"
                            style="width:100%;padding:6px;"
                        >
                    </label>
                </div>

                <div style="
                    display:flex;
                    gap:7px;
                    flex-wrap:wrap;
                ">
                    <button
                        id="dtif-scan"
                        class="dtif-primary"
                    >
                        Scan Market List
                    </button>

                    <button id="dtif-refresh">
                        Fresh Scan
                    </button>

                    <button id="dtif-settings">
                        Watchlist
                    </button>

                    <button id="dtif-change-key">
                        API Key
                    </button>

                    <label style="
                        display:flex;
                        align-items:center;
                        gap:5px;
                        font-size:12px;
                        color:#bbb;
                    ">
                        <input
                            id="dtif-show-rejected"
                            type="checkbox"
                        >
                        Show rejected
                    </label>
                </div>

                <div
                    class="dtif-small"
                    style="margin-top:7px;"
                >
                    Beta estimate only. Scans Torn's Item Market for watchlist
                    opportunities. It does not auto-buy anything.
                </div>
            </div>

            <div id="dtif-status" class="dtif-card">
                Ready.
            </div>

            <div id="dtif-results"></div>

            <div id="dtif-resize">
                ◢
            </div>
        `;

        document.body.appendChild(
            panel
        );

        panel
            .querySelector(
                '#dtif-close'
            )
            .onclick =
                () =>
                    panel.remove();

        enableDragging(panel);
        enableResize(panel);

        return panel;
    }

    // ============================================================
    // DRAGGING
    // ============================================================

    function enableDragging(panel) {
        const handle =
            panel.querySelector(
                '#dtif-header'
            );

        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

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

                dragging = true;

                const rect =
                    panel.getBoundingClientRect();

                startX =
                    event.clientX;

                startY =
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
                if (!dragging) {
                    return;
                }

                const newLeft =
                    clamp(
                        startLeft +
                            event.clientX -
                            startX,
                        0,
                        window.innerWidth -
                            80
                    );

                const newTop =
                    clamp(
                        startTop +
                            event.clientY -
                            startY,
                        0,
                        window.innerHeight -
                            50
                    );

                panel.style.left =
                    newLeft + 'px';

                panel.style.top =
                    newTop + 'px';
            }
        );

        document.addEventListener(
            'mouseup',
            () => {
                if (!dragging) {
                    return;
                }

                dragging = false;

                const rect =
                    panel.getBoundingClientRect();

                saveJSON(
                    PANEL_POS_STORAGE,
                    {
                        left:
                            rect.left +
                            'px',

                        top:
                            rect.top +
                            'px'
                    }
                );
            }
        );
    }

    // ============================================================
    // RESIZE
    // ============================================================

    function enableResize(panel) {
        const handle =
            panel.querySelector(
                '#dtif-resize'
            );

        let resizing = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        handle.addEventListener(
            'mousedown',
            event => {
                resizing = true;

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

                const width =
                    clamp(
                        startWidth +
                            event.clientX -
                            startX,
                        400,
                        Math.max(
                            420,
                            window.innerWidth -
                                10
                        )
                    );

                const height =
                    clamp(
                        startHeight +
                            event.clientY -
                            startY,
                        420,
                        Math.max(
                            440,
                            window.innerHeight -
                                10
                        )
                    );

                panel.style.width =
                    width + 'px';

                panel.style.height =
                    height + 'px';
            }
        );

        document.addEventListener(
            'mouseup',
            () => {
                if (!resizing) {
                    return;
                }

                resizing = false;

                saveJSON(
                    PANEL_SIZE_STORAGE,
                    {
                        width:
                            panel.offsetWidth +
                            'px',

                        height:
                            panel.offsetHeight +
                            'px'
                    }
                );
            }
        );
    }

    // ============================================================
    // WATCHLIST
    // ============================================================

    function getWatchlist() {
        const saved =
            loadJSON(
                WATCHLIST_STORAGE,
                null
            );

        if (
            Array.isArray(saved) &&
            saved.length
        ) {
            return saved;
        }

        return [
            ...DEFAULT_WATCHLIST
        ];
    }

    function editWatchlist() {
        const current =
            getWatchlist();

        const input =
            prompt(
                'Item watchlist — one item per line:\n\n' +
                'Use Torn item names.',
                current.join('\n')
            );

        if (input === null) {
            return;
        }

        const items =
            input
                .split(/\r?\n/)
                .map(
                    value =>
                        value.trim()
                )
                .filter(Boolean);

        saveJSON(
            WATCHLIST_STORAGE,
            items
        );

        alert(
            `Saved ${items.length} watchlist items.`
        );
    }

    // ============================================================
    // FILTER / SORT
    // ============================================================

    function passesFilters(
        result,
        minROI,
        minProfit
    ) {
        if (!result) {
            return false;
        }

        if (
            minROI > 0 &&
            result.roi <
                minROI
        ) {
            return false;
        }

        if (
            minProfit > 0 &&
            result.profit <
                minProfit
        ) {
            return false;
        }

        return true;
    }

    function sortResults(results) {
        const sorted =
            [...results];

        if (
            currentSort ===
            'profit'
        ) {
            sorted.sort(
                (a, b) =>
                    b.profit -
                    a.profit
            );

        } else if (
            currentSort ===
            'roi'
        ) {
            sorted.sort(
                (a, b) =>
                    b.roi -
                    a.roi
            );

        } else {
            sorted.sort(
                (a, b) =>
                    b.score -
                    a.score
            );
        }

        return sorted;
    }

    // ============================================================
    // RESULT COLORS
    // ============================================================

    function ratingClass(rating) {
        if (
            rating ===
            'GREAT FLIP'
        ) {
            return 'dtif-green';
        }

        if (
            rating ===
            'GOOD FLIP'
        ) {
            return 'dtif-green';
        }

        if (
            rating ===
            'MARGINAL'
        ) {
            return 'dtif-yellow';
        }

        return 'dtif-red';
    }

    function confidenceClass(
        confidence
    ) {
        if (
            confidence ===
            'HIGH'
        ) {
            return 'dtif-green';
        }

        if (
            confidence ===
            'MEDIUM'
        ) {
            return 'dtif-yellow';
        }

        return 'dtif-red';
    }

    // ============================================================
    // RENDER
    // ============================================================

    function renderResults(
        results,
        minROI,
        minProfit,
        budget
    ) {
        const container =
            document.getElementById(
                'dtif-results'
            );

        const showRejected =
            document.getElementById(
                'dtif-show-rejected'
            )?.checked || false;

        const filtered =
            sortResults(
                results.filter(
                    result =>
                        passesFilters(
                            result,
                            minROI,
                            minProfit
                        ) &&
                        (
                            showRejected ||
                            (
                                Number(
                                    result.buyUnits || 0
                                ) > 0 &&
                                result.rating !==
                                    'SKIP'
                            )
                        )
                )
            );

        const totalCapital =
            filtered.reduce(
                (sum, result) =>
                    sum +
                    result.capital,
                0
            );

        const totalProfit =
            filtered.reduce(
                (sum, result) =>
                    sum +
                    result.profit,
                0
            );

        const cards =
            filtered
                .map(
                    (
                        result,
                        index
                    ) => {
                        const rank =
                            index === 0
                                ? '🥇'
                                : index === 1
                                    ? '🥈'
                                    : index === 2
                                        ? '🥉'
                                        : `#${index + 1}`;

                        return `
                            <div
                                class="dtif-card dtif-market-link"
                                data-item-id="${Number(result.item?.id || 0)}"
                                title="Open ${result.item.name} in Torn Item Market"
                                style="cursor:pointer;"
                            >
                                <div
                                    style="
                                        display:flex;
                                        justify-content:space-between;
                                        gap:8px;
                                        align-items:flex-start;
                                    "
                                >
                                    <div>
                                        <div
                                            style="
                                                color:#fff !important;
                                                font-weight:bold;
                                                font-size:13px;
                                            "
                                        >
                                            ${rank}
                                            ${result.item.name}
                                        </div>

                                        <div class="dtif-small">
                                            Score:
                                            ${result.score.toFixed(0)}
                                            •
                                            <span
                                                class="${confidenceClass(
                                                    result.confidence
                                                )}"
                                            >
                                                ${result.confidence}
                                            </span>
                                        </div>
                                    </div>

                                    <div
                                        class="${ratingClass(
                                            result.rating
                                        )}"
                                        style="
                                            text-align:right;
                                        "
                                    >
                                        ${result.rating}
                                    </div>
                                </div>

                                <div
                                    style="
                                        display:grid;
                                        grid-template-columns:
                                            repeat(2,minmax(0,1fr));
                                        gap:6px;
                                        margin-top:9px;
                                    "
                                >
                                    <div class="dtif-card" style="margin:0;">
                                        <div class="dtif-small">
                                            Lowest Listing
                                        </div>
                                        <strong>
                                            ${exactMoney(result.lowest)}
                                        </strong>
                                    </div>

                                    <div class="dtif-card" style="margin:0;">
                                        <div class="dtif-small">
                                            Recommended Buy Qty
                                        </div>
                                        <strong>
                                            ${Number(result.buyUnits || 0).toLocaleString()}
                                        </strong>
                                    </div>

                                    <div class="dtif-card" style="margin:0;">
                                        <div class="dtif-small">
                                            Total Purchase Cost
                                        </div>
                                        <strong>
                                            ${money(result.capital)}
                                        </strong>
                                    </div>

                                    <div class="dtif-card" style="margin:0;">
                                        <div class="dtif-small">
                                            Average Buy Price
                                        </div>
                                        <strong>
                                            ${
                                                Number(result.buyUnits || 0) > 0
                                                    ? exactMoney(
                                                        result.capital /
                                                        result.buyUnits
                                                    )
                                                    : 'N/A'
                                            }
                                        </strong>
                                    </div>

                                    <div class="dtif-card" style="margin:0;">
                                        <div class="dtif-small">
                                            Estimated Resale Price
                                        </div>
                                        <strong class="dtif-blue">
                                            ${exactMoney(result.resale)}
                                        </strong>
                                    </div>

                                    <div class="dtif-card" style="margin:0;">
                                        <div class="dtif-small">
                                            Expected Revenue
                                        </div>
                                        <strong>
                                            ${
                                                Number(result.buyUnits || 0) > 0
                                                    ? money(
                                                        result.resale *
                                                        result.buyUnits
                                                    )
                                                    : '$0'
                                            }
                                        </strong>
                                    </div>

                                    <div class="dtif-card" style="margin:0;">
                                        <div class="dtif-small">
                                            Estimated Profit
                                        </div>
                                        <strong class="dtif-green">
                                            ${money(result.profit)}
                                        </strong>
                                    </div>

                                    <div class="dtif-card" style="margin:0;">
                                        <div class="dtif-small">
                                            ROI
                                        </div>
                                        <strong class="dtif-green">
                                            ${percent(result.roi)}
                                        </strong>
                                    </div>
                                </div>

                                <div
                                    class="dtif-small"
                                    style="
                                        margin-top:8px;
                                    "
                                >
                                    Cheap depth:
                                    ${Number(result.depthUnits || 0).toLocaleString()}
                                    units •
                                    Resale support:
                                    ${Number(result.resaleSupportCount || 0).toLocaleString()}
                                    listings /
                                    ${Number(result.resaleSupportUnits || 0).toLocaleString()}
                                    units •
                                    Buy cutoff:
                                    ${exactMoney(
                                        result.cutoffPrice
                                    )}
                                </div>
                            </div>
                        `;
                    }
                )
                .join('');

        container.innerHTML = `
            <div class="dtif-card">
                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        gap:8px;
                        flex-wrap:wrap;
                        align-items:center;
                    "
                >
                    <div>
                        <strong>
                            🛒 Flip Opportunities
                        </strong>

                        <div class="dtif-small">
                            ${filtered.length}
                            shown opportunities
                            • Budget:
                            ${
                                Number.isFinite(
                                    budget
                                )
                                    ? money(budget)
                                    : 'No limit'
                            }
                        </div>
                    </div>

                    <div
                        style="
                            display:flex;
                            gap:5px;
                        "
                    >
                        <button
                            id="dtif-sort-score"
                            ${
                                currentSort ===
                                'score'
                                    ? 'class="dtif-primary"'
                                    : ''
                            }
                        >
                            Best
                        </button>

                        <button
                            id="dtif-sort-profit"
                            ${
                                currentSort ===
                                'profit'
                                    ? 'class="dtif-primary"'
                                    : ''
                            }
                        >
                            Profit
                        </button>

                        <button
                            id="dtif-sort-roi"
                            ${
                                currentSort ===
                                'roi'
                                    ? 'class="dtif-primary"'
                                    : ''
                            }
                        >
                            ROI
                        </button>
                    </div>
                </div>

                <div
                    style="
                        display:grid;
                        grid-template-columns:
                            repeat(2,1fr);
                        gap:6px;
                        margin-top:8px;
                    "
                >
                    <div class="dtif-card" style="margin:0;">
                        <div class="dtif-small">
                            Capital if all shown bought
                        </div>
                        <div class="dtif-blue">
                            ${money(totalCapital)}
                        </div>
                    </div>

                    <div class="dtif-card" style="margin:0;">
                        <div class="dtif-small">
                            Est. combined gross profit
                        </div>
                        <div class="dtif-green">
                            ${money(totalProfit)}
                        </div>
                    </div>
                </div>
            </div>

            ${
                cards ||
                `
                    <div class="dtif-card">
                        <div
                            style="
                                text-align:center;
                                color:#aaa !important;
                                padding:12px;
                            "
                        >
                            No items match the current filters.
                        </div>
                    </div>
                `
            }

            <div class="dtif-card dtif-small">
                <strong style="color:#ddd !important;">
                    Estimates only.
                </strong>

                Item Market resale is based on nearby market depth.
                No automatic purchasing is performed.
            </div>
        `;

        container
            .querySelectorAll(
                '.dtif-market-link'
            )
            .forEach(
                card => {
                    card.onclick =
                        () => {
                            const itemId =
                                Number(
                                    card.dataset.itemId
                                );

                            if (!itemId) {
                                return;
                            }

                            window.open(
                                `https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${itemId}`,
                                '_blank'
                            );
                        };
                }
            );

        document
            .getElementById(
                'dtif-sort-score'
            )
            .onclick =
                () => {
                    currentSort =
                        'score';

                    renderResults(
                        currentResults,
                        minROI,
                        minProfit,
                        budget
                    );
                };

        document
            .getElementById(
                'dtif-sort-profit'
            )
            .onclick =
                () => {
                    currentSort =
                        'profit';

                    renderResults(
                        currentResults,
                        minROI,
                        minProfit,
                        budget
                    );
                };

        document
            .getElementById(
                'dtif-sort-roi'
            )
            .onclick =
                () => {
                    currentSort =
                        'roi';

                    renderResults(
                        currentResults,
                        minROI,
                        minProfit,
                        budget
                    );
                };
    }


    // ============================================================
    // SCAN
    // ============================================================

    async function runScan(
        panel,
        force = false
    ) {
        const status =
            panel.querySelector(
                '#dtif-status'
            );

        const budgetInput =
            panel.querySelector(
                '#dtif-budget'
            );

        const roiInput =
            panel.querySelector(
                '#dtif-min-roi'
            );

        const profitInput =
            panel.querySelector(
                '#dtif-min-profit'
            );

        const rawBudget =
            budgetInput.value.trim();

        const budget =
            rawBudget
                ? parseMoneyInput(
                    rawBudget
                )
                : Infinity;

        const minROI =
            Math.max(
                0,
                Number(
                    roiInput.value
                ) || 0
            );

        const rawProfit =
            profitInput.value.trim();

        const minProfit =
            rawProfit
                ? parseMoneyInput(
                    rawProfit
                )
                : 0;

        if (force) {
            localStorage.removeItem(
                CACHE_STORAGE
            );

        }

        if (
            rawBudget &&
            !Number.isFinite(budget)
        ) {
            status.innerHTML = `
                <span class="dtif-red">
                    Invalid budget.
                    Examples:
                    500m, 2b, 750k
                </span>
            `;

            return;
        }

        if (
            rawProfit &&
            !Number.isFinite(
                minProfit
            )
        ) {
            status.innerHTML = `
                <span class="dtif-red">
                    Invalid minimum profit.
                </span>
            `;

            return;
        }

        localStorage.setItem(
            BUDGET_STORAGE,
            rawBudget
        );

        localStorage.setItem(
            MIN_ROI_STORAGE,
            String(minROI)
        );

        localStorage.setItem(
            MIN_PROFIT_STORAGE,
            rawProfit
        );

        let apiKey =
            getApiKey();

        if (!apiKey) {
            apiKey =
                askForApiKey();
        }

        if (!apiKey) {
            status.innerHTML = `
                <span class="dtif-red">
                    API key required.
                </span>
            `;

            return;
        }

        try {
            status.innerHTML = `
                ⏳ Loading Torn item list...
            `;

            const items =
                await getTornItems(
                    apiKey
                );

            const itemMap =
                buildItemMap(
                    items
                );

            const watchlist =
                getWatchlist();

            const resolved = [];
            const missing = [];

            for (
                const name of watchlist
            ) {
                const item =
                    itemMap.get(
                        normalizeName(
                            name
                        )
                    );

                if (item) {
                    resolved.push(
                        item
                    );

                } else {
                    missing.push(
                        name
                    );
                }
            }

            const results = [];
            const failures = [];
            let successfulMarkets = 0;

            for (
                let i = 0;
                i < resolved.length;
                i++
            ) {
                const item =
                    resolved[i];

                status.innerHTML = `
                    ⏳ Scanning Item Market
                    <strong>
                        ${item.name}
                    </strong>

                    <br>

                    <span class="dtif-small">
                        ${i + 1}/${resolved.length}
                    </span>
                `;

                try {
                    const market =
                        await getItemMarketWithRetry(
                            item.id,
                            apiKey,
                            force
                        );

                    // A successful API response counts as analyzed even
                    // when Torn currently returns zero listings.
                    successfulMarkets++;

                    const analysis =
                        analyzeFlip(
                            item,
                            market.listings,
                            budget,
                            []
                        );

                    if (analysis) {
                        results.push(
                            analysis
                        );
                    }

                } catch (error) {
                    console.warn(
                        item.name,
                        error
                    );

                    failures.push({
                        name:
                            item.name,
                        error:
                            error?.message ||
                            String(error)
                    });
                }

                await sleep(
                    REQUEST_DELAY_MS
                );
            }

            currentResults =
                results;

            // Preserve the most recent successful scan when Torn
            // navigates/reloadss between Item Market pages.
            saveJSON(
                RESULTS_STORAGE,
                currentResults
            );

            status.innerHTML = `
                <strong class="${
                    failures.length
                        ? 'dtif-yellow'
                        : 'dtif-green'
                }">
                    Scan complete
                </strong>

                • ${successfulMarkets}/${resolved.length}
                Item Markets analyzed

                ${
                    failures.length
                        ? `<br><span class="dtif-red">Processing failures: ${failures.map(f => `${f.name} (${f.error})`).join(' • ')}</span>`
                        : ''
                }

                ${
                    missing.length
                        ? `<br><span class="dtif-yellow">Could not resolve: ${missing.join(', ')}</span>`
                        : ''
                }
            `;

            renderResults(
                currentResults,
                minROI,
                minProfit,
                budget
            );

        } catch (error) {
            console.error(error);

            status.innerHTML = `
                <span class="dtif-red">
                    Item Flipper Error
                </span>

                <br>

                ${error.message}
            `;
        }
    }

    // ============================================================
    // INIT
    // ============================================================

    function init() {
        injectStyles();

        const panel =
            createPanel();

        const budget =
            localStorage.getItem(
                BUDGET_STORAGE
            );

        if (budget) {
            panel
                .querySelector(
                    '#dtif-budget'
                )
                .value =
                    budget;
        }

        const minROI =
            localStorage.getItem(
                MIN_ROI_STORAGE
            );

        if (
            minROI !== null
        ) {
            panel
                .querySelector(
                    '#dtif-min-roi'
                )
                .value =
                    minROI;
        }

        const minProfit =
            localStorage.getItem(
                MIN_PROFIT_STORAGE
            );

        if (minProfit) {
            panel
                .querySelector(
                    '#dtif-min-profit'
                )
                .value =
                    minProfit;
        }

        const savedResults =
            loadJSON(
                RESULTS_STORAGE,
                []
            );

        if (
            Array.isArray(savedResults) &&
            savedResults.length
        ) {
            currentResults =
                savedResults;

            const restoredBudget =
                parseMoneyInput(
                    panel.querySelector(
                        '#dtif-budget'
                    ).value
                );

            const restoredROI =
                Number(
                    panel.querySelector(
                        '#dtif-min-roi'
                    ).value
                ) || 0;

            const restoredProfit =
                parseMoneyInput(
                    panel.querySelector(
                        '#dtif-min-profit'
                    ).value
                ) || 0;

            panel.querySelector(
                '#dtif-status'
            ).innerHTML = `
                <span class="dtif-green">
                    Last scan restored
                </span>
            `;

            renderResults(
                currentResults,
                restoredROI,
                restoredProfit,
                restoredBudget
            );
        }

        panel
            .querySelector(
                '#dtif-scan'
            )
            .onclick =
                () =>
                    runScan(
                        panel,
                        false
                    );

        panel
            .querySelector(
                '#dtif-refresh'
            )
            .onclick =
                () =>
                    runScan(
                        panel,
                        true
                    );

        panel
            .querySelector(
                '#dtif-settings'
            )
            .onclick =
                editWatchlist;

        panel
            .querySelector(
                '#dtif-show-rejected'
            )
            .onchange =
                () => {
                    const budget =
                        parseMoneyInput(
                            panel.querySelector(
                                '#dtif-budget'
                            ).value
                        );

                    const minROI =
                        Number(
                            panel.querySelector(
                                '#dtif-min-roi'
                            ).value
                        ) || 0;

                    const minProfit =
                        parseMoneyInput(
                            panel.querySelector(
                                '#dtif-min-profit'
                            ).value
                        ) || 0;

                    renderResults(
                        currentResults,
                        minROI,
                        minProfit,
                        budget
                    );
                };

        panel
            .querySelector(
                '#dtif-change-key'
            )
            .onclick =
                () => {
                    const key =
                        prompt(
                            'Enter a new Torn API key.\n\nYour key is stored only in this browser, used only for Torn item / Item Market data, and is never shared with the developer or third parties.'
                        );

                    if (key) {
                        saveApiKey(
                            key.trim()
                        );

                        alert(
                            'API key updated.'
                        );
                    }
                };
    }

    init();

})();

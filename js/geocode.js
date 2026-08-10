/* ============================================================
   RIDERX 2.0
   GEOCODING ENGINE
   File: js/geocode.js

   Handles:
   - Address → Coordinates
   - Coordinates → Address
   - Pickup search
   - Destination search
   - Recent locations
   - Search suggestions
   - Chandigarh-focused results
   - Current GPS location
   - OpenStreetMap Nominatim
   - Request cancellation
   - Search/reverse caching
   - RiderX custom events

   IMPORTANT:
   This file is provider-independent from the rest of RiderX.
   Existing RiderX.searchAddress(), reverseGeocode(),
   getCurrentLocation(), getCurrentAddress() and
   getAddressCoordinates() APIs are preserved.
   ============================================================ */

(function () {

    "use strict";


    /* ============================================================
       RIDERX NAMESPACE
       ============================================================ */

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Geo =
        RX.geocode =
        RX.geocode || {};


    /* ============================================================
       CONFIGURATION
       ============================================================ */

    Geo.config = {

        provider:
            "nominatim",

        endpoint:
            "https://nominatim.openstreetmap.org",

        countryCode:
            "in",

        city:
            "Chandigarh",

        state:
            "Chandigarh",

        country:
            "India",

        language:
            "en",

        limit:
            8,

        timeout:
            10000,

        debounce:
            450,

        minQueryLength:
            2,

        maxRecent:
            10,

        cacheLimit:
            100,

        /*
         * Chandigarh approximate bounding box.
         *
         * Nominatim viewbox format:
         * left,top,right,bottom
         */
        chandigarhViewBox:
            [
                76.68,
                30.80,
                76.95,
                30.60
            ]
    };


    /* ============================================================
       STATE
       ============================================================ */

    Geo.state = {

        lastQuery:
            "",

        lastResults:
            [],

        lastReverse:
            null,

        loading:
            false,

        activeSearchId:
            0,

        controller:
            null,

        reverseController:
            null,

        cache:
            new Map(),

        recent:
            []
    };


    /* ============================================================
       STORAGE
       ============================================================ */

    Geo.storageKey =
        "riderx_recent_locations";


    Geo.loadRecent =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Geo.storageKey
                    );


                if (
                    !saved
                ) {

                    Geo.state.recent =
                        [];

                    return [];
                }


                const data =
                    JSON.parse(
                        saved
                    );


                if (
                    !Array.isArray(
                        data
                    )
                ) {

                    Geo.state.recent =
                        [];

                    return [];
                }


                Geo.state.recent =
                    data
                        .map(
                            Geo.normalizeResult
                        )
                        .filter(
                            Boolean
                        )
                        .slice(
                            0,
                            Geo.config.maxRecent
                        );


            } catch (error) {

                console.warn(
                    "RiderX recent locations could not be loaded.",
                    error
                );

                Geo.state.recent =
                    [];
            }


            return Geo.state.recent;
        };


    Geo.saveRecent =
        function () {

            try {

                localStorage.setItem(
                    Geo.storageKey,
                    JSON.stringify(
                        Geo.state.recent
                    )
                );

            } catch (error) {

                console.warn(
                    "RiderX recent locations could not be saved.",
                    error
                );
            }
        };


    Geo.addRecent =
        function (
            location
        ) {

            const normalized =
                Geo.normalizeResult(
                    location
                );


            if (
                !normalized
            ) {

                return null;
            }


            const key =
                Geo.coordinateKey(
                    normalized.lat,
                    normalized.lng
                );


            Geo.state.recent =
                Geo.state.recent.filter(
                    function (
                        item
                    ) {

                        return (
                            Geo.coordinateKey(
                                item.lat,
                                item.lng
                            ) !== key
                        );
                    }
                );


            Geo.state.recent.unshift(
                normalized
            );


            Geo.state.recent =
                Geo.state.recent.slice(
                    0,
                    Geo.config.maxRecent
                );


            Geo.saveRecent();


            Geo.emit(
                "recent-updated",
                {
                    locations:
                        Geo.state.recent
                }
            );


            return normalized;
        };


    Geo.clearRecent =
        function () {

            Geo.state.recent =
                [];


            try {

                localStorage.removeItem(
                    Geo.storageKey
                );

            } catch (error) {

                console.warn(
                    "RiderX recent locations could not be cleared.",
                    error
                );
            }


            Geo.emit(
                "recent-cleared",
                {
                    locations:
                        []
                }
            );
        };


    /* ============================================================
       NUMBER HELPERS
       ============================================================ */

    Geo.number =
        function (
            value,
            fallback
        ) {

            const number =
                Number(
                    value
                );


            if (
                Number.isFinite(
                    number
                )
            ) {

                return number;
            }


            return (
                fallback ??
                0
            );
        };


    Geo.coordinateKey =
        function (
            lat,
            lng
        ) {

            const latitude =
                Number(
                    lat
                );

            const longitude =
                Number(
                    lng
                );


            if (
                !Number.isFinite(
                    latitude
                ) ||
                !Number.isFinite(
                    longitude
                )
            ) {

                return "";
            }


            return (
                latitude.toFixed(5) +
                ":" +
                longitude.toFixed(5)
            );
        };


    /* ============================================================
       NORMALIZE RESULT
       ============================================================ */

    Geo.normalizeResult =
        function (
            item
        ) {

            if (
                !item ||
                typeof item !== "object"
            ) {

                return null;
            }


            let lat =
                item.lat ??
                item.latitude;


            let lng =
                item.lon ??
                item.lng ??
                item.longitude;


            lat =
                Number(
                    lat
                );

            lng =
                Number(
                    lng
                );


            if (
                !Number.isFinite(
                    lat
                ) ||
                !Number.isFinite(
                    lng
                )
            ) {

                return null;
            }


            const addressObject =
                item.address &&
                typeof item.address === "object"
                    ? item.address
                    : {};


            const displayName =
                item.display_name ||
                item.displayName ||
                (
                    typeof item.address === "string"
                        ? item.address
                        : ""
                ) ||
                item.name ||
                "";


            const countryCode =
                String(
                    addressObject.country_code ||
                    item.countryCode ||
                    "in"
                )
                .toLowerCase();


            return {

                id:
                    item.place_id ||
                    item.id ||
                    Geo.coordinateKey(
                        lat,
                        lng
                    ),

                lat:
                    lat,

                lng:
                    lng,

                latitude:
                    lat,

                longitude:
                    lng,

                displayName:
                    String(
                        displayName
                    ),

                address:
                    String(
                        displayName
                    ),

                name:
                    item.name ||
                    addressObject.name ||
                    "",

                type:
                    item.type ||
                    "",

                category:
                    item.category ||
                    "",

                placeRank:
                    item.place_rank ??
                    null,

                importance:
                    item.importance ??
                    null,

                city:
                    addressObject.city ||
                    addressObject.town ||
                    addressObject.village ||
                    addressObject.municipality ||
                    addressObject.city_district ||
                    "",

                state:
                    addressObject.state ||
                    "",

                stateDistrict:
                    addressObject.state_district ||
                    "",

                postcode:
                    addressObject.postcode ||
                    "",

                country:
                    addressObject.country ||
                    "India",

                countryCode:
                    countryCode,

                road:
                    addressObject.road ||
                    "",

                houseNumber:
                    addressObject.house_number ||
                    "",

                suburb:
                    addressObject.suburb ||
                    "",

                neighbourhood:
                    addressObject.neighbourhood ||
                    "",

                locality:
                    addressObject.locality ||
                    "",

                raw:
                    item
            };
        };


    /* ============================================================
       CHANDIGARH CHECK
       ============================================================ */

    Geo.isChandigarh =
        function (
            result
        ) {

            const item =
                Geo.normalizeResult(
                    result
                );


            if (
                !item
            ) {

                return false;
            }


            const text =
                [
                    item.displayName,
                    item.name,
                    item.city,
                    item.state,
                    item.suburb,
                    item.neighbourhood
                ]
                .join(" ")
                .toLowerCase();


            return (
                text.includes(
                    "chandigarh"
                ) ||
                (
                    item.countryCode === "in" &&
                    (
                        text.includes(
                            "sector "
                        ) &&
                        (
                            text.includes(
                                "chandigarh"
                            ) ||
                            item.state
                                .toLowerCase()
                                .includes(
                                    "chandigarh"
                                )
                        )
                    )
                )
            );
        };


    /* ============================================================
       CHANDIGARH BOUNDS CHECK
       ============================================================ */

    Geo.isInsideChandigarhBounds =
        function (
            lat,
            lng
        ) {

            const latitude =
                Number(
                    lat
                );

            const longitude =
                Number(
                    lng
                );


            if (
                !Number.isFinite(
                    latitude
                ) ||
                !Number.isFinite(
                    longitude
                )
            ) {

                return false;
            }


            const box =
                Geo.config
                    .chandigarhViewBox;


            const west =
                box[0];

            const north =
                box[1];

            const east =
                box[2];

            const south =
                box[3];


            return (
                longitude >= west &&
                longitude <= east &&
                latitude <= north &&
                latitude >= south
            );
        };


    /* ============================================================
       SEARCH URL BUILDER
       ============================================================ */

    Geo.buildSearchURL =
        function (
            query,
            options
        ) {

            options =
                options ||
                {};


            const text =
                String(
                    query ||
                    ""
                )
                .trim();


            const params =
                new URLSearchParams();


            params.set(
                "format",
                "jsonv2"
            );


            params.set(
                "q",
                text
            );


            params.set(
                "addressdetails",
                "1"
            );


            params.set(
                "limit",
                String(
                    Math.max(
                        1,
                        Math.min(
                            20,
                            Number(
                                options.limit ??
                                Geo.config.limit
                            )
                        )
                    )
                )
            );


            params.set(
                "countrycodes",
                String(
                    options.countryCode ||
                    Geo.config.countryCode
                )
            );


            params.set(
                "accept-language",
                String(
                    options.language ||
                    Geo.config.language
                )
            );


            /*
             * Chandigarh-only mode:
             *
             * Instead of blindly appending
             * ", Chandigarh, India" every time,
             * use Nominatim's geographic viewbox.
             */
            if (
                options.chandigarhOnly ===
                true
            ) {

                const box =
                    Geo.config
                        .chandigarhViewBox;


                params.set(
                    "viewbox",
                    box.join(",")
                );


                params.set(
                    "bounded",
                    "1"
                );
            }


            /*
             * Optional custom viewbox.
             */
            if (
                Array.isArray(
                    options.viewbox
                ) &&
                options.viewbox.length === 4
            ) {

                params.set(
                    "viewbox",
                    options.viewbox.join(",")
                );


                if (
                    options.bounded !==
                    undefined
                ) {

                    params.set(
                        "bounded",
                        options.bounded
                            ? "1"
                            : "0"
                    );
                }
            }


            return (
                Geo.config.endpoint +
                "/search?" +
                params.toString()
            );
        };


    /* ============================================================
       REVERSE URL BUILDER
       ============================================================ */

    Geo.buildReverseURL =
        function (
            lat,
            lng,
            options
        ) {

            options =
                options ||
                {};


            const params =
                new URLSearchParams();


            params.set(
                "format",
                "jsonv2"
            );


            params.set(
                "lat",
                String(
                    lat
                )
            );


            params.set(
                "lon",
                String(
                    lng
                )
            );


            params.set(
                "addressdetails",
                "1"
            );


            params.set(
                "zoom",
                String(
                    options.zoom ??
                    18
                )
            );


            params.set(
                "accept-language",
                String(
                    options.language ||
                    Geo.config.language
                )
            );


            return (
                Geo.config.endpoint +
                "/reverse?" +
                params.toString()
            );
        };


    /* ============================================================
       FETCH HELPER
       ============================================================ */

    Geo.fetch =
        async function (
            url,
            options
        ) {

            options =
                options ||
                {};


            const controller =
                options.controller ||
                new AbortController();


            const timeoutMs =
                Number(
                    options.timeout ??
                    Geo.config.timeout
                );


            let timeout =
                null;


            if (
                timeoutMs > 0
            ) {

                timeout =
                    setTimeout(
                        function () {

                            try {

                                controller.abort();

                            } catch (error) {}

                        },
                        timeoutMs
                    );
            }


            try {

                const headers =
                    {
                        "Accept":
                            "application/json",

                        "Accept-Language":
                            String(
                                options.language ||
                                Geo.config.language
                            )
                    };


                const response =
                    await fetch(
                        url,
                        {
                            method:
                                options.method ||
                                "GET",

                            headers:
                                headers,

                            signal:
                                controller.signal,

                            cache:
                                "no-store"
                        }
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Geocoding request failed: HTTP " +
                        response.status
                    );
                }


                return await response.json();

            } finally {

                if (
                    timeout
                ) {

                    clearTimeout(
                        timeout
                    );
                }
            }
        };


    /* ============================================================
       SEARCH CACHE KEY
       ============================================================ */

    Geo.buildSearchCacheKey =
        function (
            query,
            options
        ) {

            options =
                options ||
                {};


            return [
                "search",
                String(
                    query ||
                    ""
                )
                .trim()
                .toLowerCase(),

                options.chandigarhOnly
                    ? "chd"
                    : "all",

                options.limit ??
                    Geo.config.limit,

                options.language ||
                    Geo.config.language,

                options.countryCode ||
                    Geo.config.countryCode
            ].join("|");
        };


    /* ============================================================
       REVERSE CACHE KEY
       ============================================================ */

    Geo.buildReverseCacheKey =
        function (
            lat,
            lng,
            options
        ) {

            options =
                options ||
                {};


            return [
                "reverse",
                Number(
                    lat
                ).toFixed(5),

                Number(
                    lng
                ).toFixed(5),

                options.zoom ??
                    18,

                options.language ||
                    Geo.config.language
            ].join("|");
        };


    /* ============================================================
       CACHE SET
       ============================================================ */

    Geo.setCache =
        function (
            key,
            value
        ) {

            if (
                !key
            ) {

                return;
            }


            Geo.state.cache.set(
                key,
                value
            );


            while (
                Geo.state.cache.size >
                Geo.config.cacheLimit
            ) {

                const firstKey =
                    Geo.state.cache
                        .keys()
                        .next()
                        .value;


                if (
                    firstKey ===
                    undefined
                ) {

                    break;
                }


                Geo.state.cache.delete(
                    firstKey
                );
            }
        };


    /* ============================================================
       SEARCH
       ============================================================ */

    Geo.search =
        async function (
            query,
            options
        ) {

            options =
                {
                    ...(options || {})
                };


            const text =
                String(
                    query ||
                    ""
                )
                .trim();


            const minLength =
                Number(
                    options.minQueryLength ??
                    Geo.config.minQueryLength
                );


            if (
                text.length <
                minLength
            ) {

                return [];
            }


            const cacheKey =
                Geo.buildSearchCacheKey(
                    text,
                    options
                );


            if (
                Geo.state.cache.has(
                    cacheKey
                )
            ) {

                const cached =
                    Geo.state.cache.get(
                        cacheKey
                    );


                Geo.state.lastQuery =
                    text;

                Geo.state.lastResults =
                    cached;


                Geo.emit(
                    "search-success",
                    {
                        query:
                            text,

                        results:
                            cached,

                        cached:
                            true
                    }
                );


                return cached;
            }


            /*
             * Cancel previous search.
             */
            if (
                Geo.state.controller
            ) {

                try {

                    Geo.state.controller.abort();

                } catch (error) {}
            }


            const controller =
                new AbortController();


            Geo.state.controller =
                controller;


            const searchId =
                ++Geo.state.activeSearchId;


            Geo.state.loading =
                true;


            Geo.state.lastQuery =
                text;


            Geo.emit(
                "search-start",
                {
                    query:
                        text,

                    searchId:
                        searchId
                }
            );


            try {

                const url =
                    Geo.buildSearchURL(
                        text,
                        options
                    );


                const data =
                    await Geo.fetch(
                        url,
                        {
                            controller:
                                controller,

                            timeout:
                                options.timeout ??
                                Geo.config.timeout,

                            language:
                                options.language ||
                                Geo.config.language
                        }
                    );


                /*
                 * Ignore stale responses.
                 */
                if (
                    searchId !==
                    Geo.state.activeSearchId
                ) {

                    return [];
                }


                let results =
                    Array.isArray(
                        data
                    )
                        ? data
                            .map(
                                Geo.normalizeResult
                            )
                            .filter(
                                Boolean
                            )
                        : [];


                /*
                 * Chandigarh-only filtering.
                 *
                 * Nominatim bounded search already limits
                 * the result geographically. The additional
                 * check protects against unexpected provider
                 * results.
                 */
                if (
                    options.chandigarhOnly ===
                    true
                ) {

                    results =
                        results.filter(
                            function (
                                item
                            ) {

                                return (
                                    Geo.isChandigarh(
                                        item
                                    ) ||
                                    Geo.isInsideChandigarhBounds(
                                        item.lat,
                                        item.lng
                                    )
                                );
                            }
                        );
                }


                /*
                 * Remove duplicate coordinates.
                 */
                const seen =
                    new Set();


                results =
                    results.filter(
                        function (
                            item
                        ) {

                            const key =
                                Geo.coordinateKey(
                                    item.lat,
                                    item.lng
                                );


                            if (
                                !key ||
                                seen.has(
                                    key
                                )
                            ) {

                                return false;
                            }


                            seen.add(
                                key
                            );

                            return true;
                        }
                    );


                /*
                 * Keep requested result limit.
                 */
                const requestedLimit =
                    Math.max(
                        1,
                        Math.min(
                            20,
                            Number(
                                options.limit ??
                                Geo.config.limit
                            )
                        )
                    );


                results =
                    results.slice(
                        0,
                        requestedLimit
                    );


                Geo.setCache(
                    cacheKey,
                    results
                );


                Geo.state.lastResults =
                    results;


                Geo.emit(
                    "search-success",
                    {
                        query:
                            text,

                        results:
                            results,

                        cached:
                            false,

                        searchId:
                            searchId
                    }
                );


                return results;

            } catch (error) {

                if (
                    error &&
                    error.name ===
                    "AbortError"
                ) {

                    return [];
                }


                /*
                 * Ignore stale errors.
                 */
                if (
                    searchId !==
                    Geo.state.activeSearchId
                ) {

                    return [];
                }


                console.error(
                    "RiderX geocoding error:",
                    error
                );


                Geo.emit(
                    "search-error",
                    {
                        query:
                            text,

                        error:
                            error,

                        searchId:
                            searchId
                    }
                );


                return [];

            } finally {

                /*
                 * Only the active request may change
                 * the global loading state.
                 */
                if (
                    searchId ===
                    Geo.state.activeSearchId
                ) {

                    Geo.state.loading =
                        false;

                    if (
                        Geo.state.controller ===
                        controller
                    ) {

                        Geo.state.controller =
                            null;
                    }
                }
            }
        };


    /* ============================================================
       REVERSE GEOCODING
       ============================================================ */

    Geo.reverse =
        async function (
            lat,
            lng,
            options
        ) {

            options =
                {
                    ...(options || {})
                };


            lat =
                Number(
                    lat
                );

            lng =
                Number(
                    lng
                );


            if (
                !Number.isFinite(
                    lat
                ) ||
                !Number.isFinite(
                    lng
                )
            ) {

                return null;
            }


            const cacheKey =
                Geo.buildReverseCacheKey(
                    lat,
                    lng,
                    options
                );


            if (
                Geo.state.cache.has(
                    cacheKey
                )
            ) {

                const cached =
                    Geo.state.cache.get(
                        cacheKey
                    );


                Geo.state.lastReverse =
                    cached;


                return cached;
            }


            /*
             * Cancel previous reverse request.
             */
            if (
                Geo.state.reverseController
            ) {

                try {

                    Geo.state.reverseController.abort();

                } catch (error) {}
            }


            const controller =
                new AbortController();


            Geo.state.reverseController =
                controller;


            try {

                const url =
                    Geo.buildReverseURL(
                        lat,
                        lng,
                        options
                    );


                const response =
                    await Geo.fetch(
                        url,
                        {
                            controller:
                                controller,

                            timeout:
                                options.timeout ??
                                Geo.config.timeout,

                            language:
                                options.language ||
                                Geo.config.language
                        }
                    );


                const result =
                    Geo.normalizeResult(
                        response
                    );


                Geo.state.lastReverse =
                    result;


                if (
                    result
                ) {

                    /*
                     * Add coordinate accuracy information
                     * if provider returned it.
                     */
                    result.latitude =
                        lat;

                    result.longitude =
                        lng;


                    Geo.setCache(
                        cacheKey,
                        result
                    );


                    Geo.emit(
                        "reverse-success",
                        {
                            result:
                                result
                        }
                    );
                }


                return result;

            } catch (error) {

                if (
                    error &&
                    error.name ===
                    "AbortError"
                ) {

                    return null;
                }


                console.error(
                    "RiderX reverse geocoding error:",
                    error
                );


                Geo.emit(
                    "reverse-error",
                    {
                        error:
                            error,

                        lat:
                            lat,

                        lng:
                            lng
                    }
                );


                return null;

            } finally {

                if (
                    Geo.state.reverseController ===
                    controller
                ) {

                    Geo.state.reverseController =
                        null;
                }
            }
        };


    /* ============================================================
       CURRENT GPS LOCATION
       ============================================================ */

    Geo.currentLocation =
        function (
            options
        ) {

            options =
                options ||
                {};


            return new Promise(
                function (
                    resolve,
                    reject
                ) {

                    if (
                        !navigator.geolocation
                    ) {

                        const error =
                            new Error(
                                "Geolocation is not supported by this device."
                            );


                        error.code =
                            0;


                        reject(
                            error
                        );

                        return;
                    }


                    navigator.geolocation
                        .getCurrentPosition(

                            function (
                                position
                            ) {

                                const coords =
                                    position.coords;


                                resolve({

                                    lat:
                                        Number(
                                            coords.latitude
                                        ),

                                    lng:
                                        Number(
                                            coords.longitude
                                        ),

                                    latitude:
                                        Number(
                                            coords.latitude
                                        ),

                                    longitude:
                                        Number(
                                            coords.longitude
                                        ),

                                    accuracy:
                                        Number(
                                            coords.accuracy
                                        ),

                                    altitude:
                                        coords.altitude !== null
                                            ? Number(
                                                coords.altitude
                                            )
                                            : null,

                                    heading:
                                        coords.heading !== null
                                            ? Number(
                                                coords.heading
                                            )
                                            : null,

                                    speed:
                                        coords.speed !== null
                                            ? Number(
                                                coords.speed
                                            )
                                            : null,

                                    timestamp:
                                        position.timestamp
                                });

                            },

                            function (
                                error
                            ) {

                                console.warn(
                                    "RiderX GPS error:",
                                    error
                                );


                                reject(
                                    error
                                );
                            },

                            {

                                enableHighAccuracy:
                                    options.enableHighAccuracy ??
                                    true,

                                timeout:
                                    options.timeout ??
                                    12000,

                                maximumAge:
                                    options.maximumAge ??
                                    5000
                            }
                        );
                }
            );
        };


    /* ============================================================
       WATCH CURRENT GPS LOCATION
       ============================================================ */

    Geo.watchLocation =
        function (
            success,
            error,
            options
        ) {

            options =
                options ||
                {};


            if (
                !navigator.geolocation
            ) {

                if (
                    typeof error ===
                    "function"
                ) {

                    error(
                        new Error(
                            "Geolocation is not supported."
                        )
                    );
                }


                return null;
            }


            return navigator.geolocation
                .watchPosition(

                    function (
                        position
                    ) {

                        if (
                            typeof success !==
                            "function"
                        ) {

                            return;
                        }


                        const coords =
                            position.coords;


                        success({

                            lat:
                                Number(
                                    coords.latitude
                                ),

                            lng:
                                Number(
                                    coords.longitude
                                ),

                            latitude:
                                Number(
                                    coords.latitude
                                ),

                            longitude:
                                Number(
                                    coords.longitude
                                ),

                            accuracy:
                                Number(
                                    coords.accuracy
                                ),

                            altitude:
                                coords.altitude,

                            heading:
                                coords.heading,

                            speed:
                                coords.speed,

                            timestamp:
                                position.timestamp
                        });
                    },

                    function (
                        positionError
                    ) {

                        if (
                            typeof error ===
                            "function"
                        ) {

                            error(
                                positionError
                            );
                        }
                    },

                    {

                        enableHighAccuracy:
                            options.enableHighAccuracy ??
                            true,

                        timeout:
                            options.timeout ??
                            15000,

                        maximumAge:
                            options.maximumAge ??
                            3000
                    }
                );
        };


    /* ============================================================
       CLEAR GPS WATCH
       ============================================================ */

    Geo.clearWatch =
        function (
            watchId
        ) {

            if (
                watchId === null ||
                watchId === undefined
            ) {

                return false;
            }


            if (
                !navigator.geolocation
            ) {

                return false;
            }


            navigator.geolocation.clearWatch(
                watchId
            );


            return true;
        };


    /* ============================================================
       CURRENT ADDRESS
       ============================================================ */

    Geo.currentAddress =
        async function (
            options
        ) {

            options =
                options ||
                {};


            try {

                const position =
                    await Geo.currentLocation(
                        options
                    );


                const address =
                    await Geo.reverse(
                        position.lat,
                        position.lng,
                        options
                    );


                if (
                    address
                ) {

                    address.accuracy =
                        position.accuracy;

                    address.latitude =
                        position.lat;

                    address.longitude =
                        position.lng;
                }


                return address;

            } catch (error) {

                console.error(
                    "RiderX current address error:",
                    error
                );


                Geo.emit(
                    "current-address-error",
                    {
                        error:
                            error
                    }
                );


                return null;
            }
        };


    /* ============================================================
       AUTOCOMPLETE
       ============================================================ */

    Geo.autocomplete =
        async function (
            query,
            options
        ) {

            options =
                {
                    ...(options || {})
                };


            return Geo.search(
                query,
                {
                    ...options,

                    limit:
                        options.limit ??
                        6,

                    debounce:
                        options.debounce ??
                        Geo.config.debounce
                }
            );
        };


    /* ============================================================
       FORMAT SHORT ADDRESS
       ============================================================ */

    Geo.shortAddress =
        function (
            result
        ) {

            const item =
                Geo.normalizeResult(
                    result
                );


            if (
                !item
            ) {

                return "";
            }


            const parts =
                [];


            const add =
                function (
                    value
                ) {

                    const text =
                        String(
                            value ||
                            ""
                        )
                        .trim();


                    if (
                        !text
                    ) {

                        return;
                    }


                    if (
                        !parts.includes(
                            text
                        )
                    ) {

                        parts.push(
                            text
                        );
                    }
                };


            add(
                item.name
            );

            add(
                item.houseNumber &&
                item.road
                    ? (
                        item.houseNumber +
                        " " +
                        item.road
                    )
                    : item.road
            );

            add(
                item.suburb
            );

            add(
                item.neighbourhood
            );

            add(
                item.city
            );


            return parts
                .slice(
                    0,
                    3
                )
                .join(
                    ", "
                );
        };


    /* ============================================================
       FORMAT FULL LOCATION
       ============================================================ */

    Geo.format =
        function (
            result
        ) {

            const item =
                Geo.normalizeResult(
                    result
                );


            if (
                !item
            ) {

                return "";
            }


            return (
                item.displayName ||
                Geo.shortAddress(
                    item
                )
            );
        };


    /* ============================================================
       LOCATION OBJECT
       ============================================================ */

    Geo.toLocation =
        function (
            result
        ) {

            const item =
                Geo.normalizeResult(
                    result
                );


            if (
                !item
            ) {

                return null;
            }


            return {

                id:
                    item.id,

                lat:
                    item.lat,

                lng:
                    item.lng,

                latitude:
                    item.lat,

                longitude:
                    item.lng,

                address:
                    item.displayName ||
                    Geo.shortAddress(
                        item
                    ),

                displayName:
                    item.displayName,

                name:
                    item.name,

                road:
                    item.road,

                suburb:
                    item.suburb,

                neighbourhood:
                    item.neighbourhood,

                city:
                    item.city,

                state:
                    item.state,

                country:
                    item.country,

                countryCode:
                    item.countryCode,

                postcode:
                    item.postcode
            };
        };


    /* ============================================================
       SEARCH INPUT BINDING
       ============================================================ */

    Geo.bindSearch =
        function (
            input,
            options
        ) {

            options =
                options ||
                {};


            const element =
                typeof input ===
                "string"
                    ? document.querySelector(
                        input
                    )
                    : input;


            if (
                !element
            ) {

                return null;
            }


            let timer =
                null;


            let destroyed =
                false;


            const onInput =
                function () {

                    clearTimeout(
                        timer
                    );


                    const query =
                        String(
                            element.value ||
                            ""
                        )
                        .trim();


                    if (
                        query.length <
                        (
                            options.minQueryLength ??
                            Geo.config.minQueryLength
                        )
                    ) {

                        Geo.emit(
                            "suggestions",
                            {
                                input:
                                    element,

                                query:
                                    query,

                                results:
                                    []
                            }
                        );


                        return;
                    }


                    timer =
                        setTimeout(
                            async function () {

                                if (
                                    destroyed
                                ) {

                                    return;
                                }


                                const results =
                                    await Geo.autocomplete(
                                        query,
                                        options
                                    );


                                if (
                                    destroyed
                                ) {

                                    return;
                                }


                                Geo.emit(
                                    "suggestions",
                                    {
                                        input:
                                            element,

                                        query:
                                            query,

                                        results:
                                            results
                                    }
                                );

                            },
                            options.debounce ??
                            Geo.config.debounce
                        );
                };


            element.addEventListener(
                "input",
                onInput
            );


            return {

                element:
                    element,

                destroy:
                    function () {

                        destroyed =
                            true;


                        clearTimeout(
                            timer
                        );


                        element.removeEventListener(
                            "input",
                            onInput
                        );
                    }
            };
        };


    /* ============================================================
       PICKUP / DESTINATION INPUT BINDING
       ============================================================ */

    Geo.bindLocationInput =
        function (
            input,
            type,
            options
        ) {

            options =
                options ||
                {};


            const binding =
                Geo.bindSearch(
                    input,
                    options
                );


            if (
                !binding
            ) {

                return null;
            }


            const eventName =
                type === "pickup"
                    ? "pickup-suggestions"
                    : "destination-suggestions";


            const listener =
                function (
                    event
                ) {

                    const detail =
                        event.detail ||
                        {};


                    if (
                        detail.input !==
                        binding.element
                    ) {

                        return;
                    }


                    Geo.emit(
                        eventName,
                        detail
                    );
                };


            window.addEventListener(
                "riderx-geocode-suggestions",
                listener
            );


            return {

                ...binding,

                destroy:
                    function () {

                        binding.destroy();


                        window.removeEventListener(
                            "riderx-geocode-suggestions",
                            listener
                        );
                    }
            };
        };


    /* ============================================================
       SELECT LOCATION
       ============================================================ */

    Geo.select =
        function (
            result,
            type
        ) {

            const location =
                Geo.toLocation(
                    result
                );


            if (
                !location
            ) {

                return null;
            }


            Geo.addRecent(
                location
            );


            Geo.emit(
                "location-selected",
                {

                    type:
                        type ||
                        "location",

                    location:
                        location
                }
            );


            if (
                type ===
                "pickup"
            ) {

                Geo.emit(
                    "pickup-selected",
                    {
                        location:
                            location
                    }
                );
            }


            if (
                type ===
                "destination"
            ) {

                Geo.emit(
                    "destination-selected",
                    {
                        location:
                            location
                    }
                );
            }


            return location;
        };


    /* ============================================================
       GET ADDRESS FROM COORDINATES
       ============================================================ */

    Geo.getAddress =
        Geo.reverse;


    /* ============================================================
       GET COORDINATES FROM ADDRESS
       ============================================================ */

    Geo.getCoordinates =
        async function (
            address,
            options
        ) {

            const results =
                await Geo.search(
                    address,
                    options
                );


            if (
                !Array.isArray(
                    results
                ) ||
                results.length ===
                0
            ) {

                return null;
            }


            const first =
                results[0];


            return {

                lat:
                    first.lat,

                lng:
                    first.lng,

                latitude:
                    first.lat,

                longitude:
                    first.lng,

                address:
                    first.displayName,

                result:
                    first
            };
        };


    /* ============================================================
       SEARCH CHANDIGARH
       ============================================================ */

    Geo.searchChandigarh =
        async function (
            query,
            options
        ) {

            return Geo.search(
                query,
                {
                    ...(options || {}),

                    chandigarhOnly:
                        true
                }
            );
        };


    /* ============================================================
       CLEAR CACHE
       ============================================================ */

    Geo.clearCache =
        function () {

            Geo.state.cache.clear();

            Geo.state.lastResults =
                [];

            Geo.state.lastReverse =
                null;


            Geo.emit(
                "cache-cleared",
                {}
            );
        };


    /* ============================================================
       CANCEL ACTIVE SEARCH
       ============================================================ */

    Geo.cancelSearch =
        function () {

            if (
                Geo.state.controller
            ) {

                try {

                    Geo.state.controller.abort();

                } catch (error) {}
            }


            Geo.state.activeSearchId++;


            Geo.state.controller =
                null;


            Geo.state.loading =
                false;
        };


    /* ============================================================
       CANCEL REVERSE REQUEST
       ============================================================ */

    Geo.cancelReverse =
        function () {

            if (
                Geo.state.reverseController
            ) {

                try {

                    Geo.state.reverseController.abort();

                } catch (error) {}
            }


            Geo.state.reverseController =
                null;
        };


    /* ============================================================
       EVENTS
       ============================================================ */

    Geo.emit =
        function (
            name,
            data
        ) {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-geocode-" +
                        name,
                        {
                            detail:
                                data ||
                                {}
                        }
                    )
                );

            } catch (error) {

                /*
                 * Very old browser fallback.
                 */
                try {

                    const event =
                        document.createEvent(
                            "CustomEvent"
                        );


                    event.initCustomEvent(
                        "riderx-geocode-" +
                        name,
                        false,
                        false,
                        data ||
                        {}
                    );


                    window.dispatchEvent(
                        event
                    );

                } catch (fallbackError) {

                    console.warn(
                        "RiderX geocode event failed:",
                        fallbackError
                    );
                }
            }
        };


    /* ============================================================
       GLOBAL SHORTCUTS
       ============================================================ */

    RX.searchAddress =
        Geo.search;


    RX.reverseGeocode =
        Geo.reverse;


    RX.getCurrentLocation =
        Geo.currentLocation;


    RX.getCurrentAddress =
        Geo.currentAddress;


    RX.getAddressCoordinates =
        Geo.getCoordinates;


    RX.searchChandigarh =
        Geo.searchChandigarh;


    RX.watchLocation =
        Geo.watchLocation;


    RX.clearLocationWatch =
        Geo.clearWatch;


    /* ============================================================
       INIT
       ============================================================ */

    Geo.loadRecent();


    Geo.ready =
        true;


    Geo.version =
        "2.0.0";


    /*
     * Fire ready event after the current script has
     * completely initialized.
     */
    setTimeout(
        function () {

            Geo.emit(
                "ready",
                {
                    version:
                        Geo.version,

                    provider:
                        Geo.config.provider
                }
            );

        },
        0
    );


    console.log(
        "RiderX geocode.js 2.0.0 loaded."
    );

})();

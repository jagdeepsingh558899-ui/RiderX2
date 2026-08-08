/* ============================================================
   RIDERX GEOCODING ENGINE
   File: js/geocode.js

   Handles:
   - Address → Coordinates
   - Coordinates → Address
   - Pickup search
   - Destination search
   - Recent locations
   - Search suggestions
   - Chandigarh-focused results
   - OpenStreetMap Nominatim
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Geo =
        RX.geocode =
        RX.geocode || {};


    /* ========================================================
       CONFIG
       ======================================================== */

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
            350,

        minQueryLength:
            2,

        maxRecent:
            10
    };


    /* ========================================================
       STATE
       ======================================================== */

    Geo.state = {

        lastQuery:
            "",

        lastResults:
            [],

        lastReverse:
            null,

        loading:
            false,

        controller:
            null,

        cache:
            new Map(),

        recent:
            []
    };


    /* ========================================================
       STORAGE
       ======================================================== */

    Geo.storageKey =
        "riderx_recent_locations";


    Geo.loadRecent =
        function () {

            try {

                const saved =
                    localStorage.getItem(
                        Geo.storageKey
                    );


                const data =
                    saved
                        ? JSON.parse(saved)
                        : [];


                if (
                    Array.isArray(data)
                ) {

                    Geo.state.recent =
                        data.slice(
                            0,
                            Geo.config.maxRecent
                        );
                }

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

            if (
                !location
            ) {

                return;
            }


            const normalized =
                Geo.normalizeResult(
                    location
                );


            if (
                !normalized
            ) {

                return;
            }


            const key =
                [
                    normalized.lat,
                    normalized.lng
                ]
                .join(":");


            Geo.state.recent =
                Geo.state.recent.filter(
                    function (
                        item
                    ) {

                        return (
                            [
                                item.lat,
                                item.lng
                            ]
                            .join(":") !==
                            key
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
        };


    Geo.clearRecent =
        function () {

            Geo.state.recent =
                [];


            try {

                localStorage.removeItem(
                    Geo.storageKey
                );

            } catch (error) {}


            Geo.emit(
                "recent-cleared"
            );
        };


    /* ========================================================
       NUMBER HELPERS
       ======================================================== */

    Geo.number =
        function (
            value,
            fallback
        ) {

            const number =
                Number(value);


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


    /* ========================================================
       NORMALIZE RESULT
       ======================================================== */

    Geo.normalizeResult =
        function (
            item
        ) {

            if (
                !item
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
                Number(lat);

            lng =
                Number(lng);


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {

                return null;
            }


            const address =
                item.display_name ||
                item.displayName ||
                item.address ||
                item.name ||
                "";


            const addressObject =
                item.address &&
                typeof item.address ===
                "object"
                    ? item.address
                    : {};


            return {

                id:
                    item.place_id ||
                    item.id ||
                    (
                        lat +
                        ":" +
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
                        address
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

                city:
                    addressObject.city ||
                    addressObject.town ||
                    addressObject.village ||
                    addressObject.municipality ||
                    "",

                state:
                    addressObject.state ||
                    "",

                postcode:
                    addressObject.postcode ||
                    "",

                country:
                    addressObject.country ||
                    "India",

                countryCode:
                    addressObject.country_code ||
                    "in",

                road:
                    addressObject.road ||
                    "",

                suburb:
                    addressObject.suburb ||
                    addressObject.neighbourhood ||
                    "",

                raw:
                    item
            };
        };


    /* ========================================================
       CHANDIGARH CHECK
       ======================================================== */

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
                    item.city,
                    item.state
                ]
                .join(" ")
                .toLowerCase();


            return (
                text.includes(
                    "chandigarh"
                )
            );
        };


    /* ========================================================
       URL BUILDER
       ======================================================== */

    Geo.buildSearchURL =
        function (
            query,
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
                "q",
                query
            );


            params.set(
                "addressdetails",
                "1"
            );


            params.set(
                "limit",
                String(
                    options.limit ??
                    Geo.config.limit
                )
            );


            params.set(
                "countrycodes",
                options.countryCode ||
                Geo.config.countryCode
            );


            params.set(
                "accept-language",
                options.language ||
                Geo.config.language
            );


            /*
             * Chandigarh preference.
             *
             * We don't force a strict bounding box
             * because the user may search nearby areas,
             * but we include Chandigarh in the query when
             * the UI is configured for Chandigarh.
             */

            let finalQuery =
                query;


            if (
                options.chandigarhOnly ===
                true
            ) {

                finalQuery =
                    query +
                    ", Chandigarh, India";
            }


            params.set(
                "q",
                finalQuery
            );


            return (
                Geo.config.endpoint +
                "/search?" +
                params.toString()
            );
        };


    /* ========================================================
       FETCH WITH TIMEOUT
       ======================================================== */

    Geo.fetch =
        async function (
            url,
            options
        ) {

            options =
                options ||
                {};


            const controller =
                new AbortController();


            const timeout =
                setTimeout(
                    function () {

                        controller.abort();

                    },
                    options.timeout ??
                    Geo.config.timeout
                );


            try {

                const response =
                    await fetch(
                        url,
                        {
                            method:
                                options.method ||
                                "GET",

                            headers: {

                                "Accept":
                                    "application/json",

                                "Accept-Language":
                                    Geo.config.language
                            },

                            signal:
                                controller.signal
                        }
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Geocoding request failed: " +
                        response.status
                    );
                }


                return await response.json();

            } finally {

                clearTimeout(
                    timeout
                );
            }
        };


    /* ========================================================
       SEARCH
       ======================================================== */

    Geo.search =
        async function (
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


            if (
                text.length <
                (
                    options.minQueryLength ??
                    Geo.config.minQueryLength
                )
            ) {

                return [];
            }


            /*
             * Cache key.
             */

            const cacheKey =
                (
                    text +
                    "|" +
                    (
                        options.chandigarhOnly
                            ? "chd"
                            : "all"
                    )
                )
                .toLowerCase();


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


                return cached;
            }


            /*
             * Cancel previous request.
             */

            if (
                Geo.state.controller
            ) {

                try {

                    Geo.state.controller.abort();

                } catch (error) {}
            }


            Geo.state.controller =
                new AbortController();


            Geo.state.loading =
                true;


            Geo.state.lastQuery =
                text;


            Geo.emit(
                "search-start",
                {
                    query:
                        text
                }
            );


            try {

                let url =
                    Geo.buildSearchURL(
                        text,
                        options
                    );


                const response =
                    await fetch(
                        url,
                        {
                            headers: {

                                "Accept":
                                    "application/json",

                                "Accept-Language":
                                    Geo.config.language
                            },

                            signal:
                                Geo.state
                                    .controller
                                    .signal
                        }
                    );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Geocoding request failed."
                    );
                }


                const data =
                    await response.json();


                let results =
                    Array.isArray(data)
                        ? data.map(
                            Geo.normalizeResult
                        )
                        : [];


                results =
                    results.filter(
                        Boolean
                    );


                /*
                 * Optional Chandigarh filtering.
                 */

                if (
                    options.chandigarhOnly ===
                    true
                ) {

                    results =
                        results.filter(
                            Geo.isChandigarh
                        );
                }


                /*
                 * Remove duplicates.
                 */

                const seen =
                    new Set();


                results =
                    results.filter(
                        function (
                            item
                        ) {

                            const key =
                                item.lat.toFixed(
                                    5
                                ) +
                                ":" +
                                item.lng.toFixed(
                                    5
                                );


                            if (
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
                 * Cache.
                 */

                Geo.state.cache.set(
                    cacheKey,
                    results
                );


                /*
                 * Limit cache size.
                 */

                if (
                    Geo.state.cache.size >
                    100
                ) {

                    const firstKey =
                        Geo.state.cache
                            .keys()
                            .next()
                            .value;


                    Geo.state.cache.delete(
                        firstKey
                    );
                }


                Geo.state.lastResults =
                    results;


                Geo.emit(
                    "search-success",
                    {
                        query:
                            text,

                        results:
                            results
                    }
                );


                return results;

            } catch (error) {

                if (
                    error.name ===
                    "AbortError"
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
                            error
                    }
                );


                return [];

            } finally {

                Geo.state.loading =
                    false;
            }
        };


    /* ========================================================
       REVERSE GEOCODE
       ======================================================== */

    Geo.reverse =
        async function (
            lat,
            lng,
            options
        ) {

            options =
                options ||
                {};


            lat =
                Number(lat);

            lng =
                Number(lng);


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lng)
            ) {

                return null;
            }


            const cacheKey =
                "reverse:" +
                lat.toFixed(5) +
                ":" +
                lng.toFixed(5);


            if (
                Geo.state.cache.has(
                    cacheKey
                )
            ) {

                return Geo.state.cache.get(
                    cacheKey
                );
            }


            try {

                const params =
                    new URLSearchParams();


                params.set(
                    "format",
                    "jsonv2"
                );


                params.set(
                    "lat",
                    String(lat)
                );


                params.set(
                    "lon",
                    String(lng)
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
                    options.language ||
                    Geo.config.language
                );


                const url =
                    Geo.config.endpoint +
                    "/reverse?" +
                    params.toString();


                const response =
                    await Geo.fetch(
                        url,
                        options
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

                    Geo.state.cache.set(
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

                console.error(
                    "RiderX reverse geocoding error:",
                    error
                );


                Geo.emit(
                    "reverse-error",
                    {
                        error:
                            error
                    }
                );


                return null;
            }
        };


    /* ========================================================
       CURRENT LOCATION
       ======================================================== */

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

                        reject(
                            new Error(
                                "Geolocation is not supported."
                            )
                        );

                        return;
                    }


                    navigator.geolocation
                        .getCurrentPosition(
                            function (
                                position
                            ) {

                                resolve({

                                    lat:
                                        position
                                            .coords
                                            .latitude,

                                    lng:
                                        position
                                            .coords
                                            .longitude,

                                    accuracy:
                                        position
                                            .coords
                                            .accuracy,

                                    altitude:
                                        position
                                            .coords
                                            .altitude,

                                    heading:
                                        position
                                            .coords
                                            .heading,

                                    speed:
                                        position
                                            .coords
                                            .speed
                                });

                            },

                            function (
                                error
                            ) {

                                reject(
                                    error
                                );
                            },

                            {

                                enableHighAccuracy:
                                    options
                                        .enableHighAccuracy ??
                                    true,

                                timeout:
                                    options.timeout ??
                                    10000,

                                maximumAge:
                                    options.maximumAge ??
                                    5000
                            }
                        );
                }
            );
        };


    /* ========================================================
       CURRENT ADDRESS
       ======================================================== */

    Geo.currentAddress =
        async function (
            options
        ) {

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
                }


                return address;

            } catch (error) {

                console.error(
                    "RiderX current address error:",
                    error
                );


                return null;
            }
        };


    /* ========================================================
       AUTOCOMPLETE
       ======================================================== */

    Geo.autocomplete =
        async function (
            query,
            options
        ) {

            return Geo.search(
                query,
                {
                    ...(options || {}),

                    limit:
                        options?.limit ??
                        6
                }
            );
        };


    /* ========================================================
       FORMAT SHORT ADDRESS
       ======================================================== */

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


            const parts = [];


            if (
                item.name
            ) {

                parts.push(
                    item.name
                );
            }


            if (
                item.road &&
                !parts.includes(
                    item.road
                )
            ) {

                parts.push(
                    item.road
                );
            }


            if (
                item.suburb &&
                !parts.includes(
                    item.suburb
                )
            ) {

                parts.push(
                    item.suburb
                );
            }


            if (
                item.city &&
                !parts.includes(
                    item.city
                )
            ) {

                parts.push(
                    item.city
                );
            }


            return parts
                .slice(
                    0,
                    3
                )
                .join(
                    ", "
                );
        };


    /* ========================================================
       FORMAT LOCATION
       ======================================================== */

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


    /* ========================================================
       LOCATION OBJECT
       ======================================================== */

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

                lat:
                    item.lat,

                lng:
                    item.lng,

                latitude:
                    item.lat,

                longitude:
                    item.lng,

                address:
                    item.displayName,

                name:
                    item.name,

                city:
                    item.city,

                state:
                    item.state,

                country:
                    item.country,

                postcode:
                    item.postcode
            };
        };


    /* ========================================================
       SEARCH INPUT BINDING
       ======================================================== */

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


            const onInput =
                function () {

                    clearTimeout(
                        timer
                    );


                    const query =
                        element.value
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

                                const results =
                                    await Geo.autocomplete(
                                        query,
                                        options
                                    );


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


    /* ========================================================
       PICKUP / DESTINATION BINDING
       ======================================================== */

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
                        type ===
                        "pickup"
                            ? "pickup-suggestions"
                            : "destination-suggestions",
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


    /* ========================================================
       SELECT LOCATION
       ======================================================== */

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


    /* ========================================================
       GET ADDRESS FROM COORDINATES
       ======================================================== */

    Geo.getAddress =
        Geo.reverse;


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
                results.length ===
                0
            ) {

                return null;
            }


            return {

                lat:
                    results[0].lat,

                lng:
                    results[0].lng,

                latitude:
                    results[0].lat,

                longitude:
                    results[0].lng,

                address:
                    results[0].displayName,

                result:
                    results[0]
            };
        };


    /* ========================================================
       CACHE CONTROL
       ======================================================== */

    Geo.clearCache =
        function () {

            Geo.state.cache.clear();

            Geo.state.lastResults =
                [];

            Geo.state.lastReverse =
                null;
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Geo.emit =
        function (
            name,
            data
        ) {

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
        };


    /* ========================================================
       GLOBAL SHORTCUTS
       ======================================================== */

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


    /* ========================================================
       INIT
       ======================================================== */

    Geo.loadRecent();

    Geo.ready =
        true;


    Geo.emit(
        "ready",
        {
            version:
                "1.0.0",

            provider:
                Geo.config.provider
        }
    );


    console.log(
        "RiderX geocode.js loaded."
    );

})();

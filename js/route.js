/* ============================================================
   RIDERX - ROUTE ENGINE
   File: js/route.js

   Handles:
   - Pickup -> destination route
   - Rider -> pickup route
   - Leaflet route drawing
   - OSRM routing
   - Distance
   - ETA
   - Route polyline
   - Route bounds
   - Navigation steps
   - Route caching
   - Existing RiderX map integration
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Route =
        RX.route ||
        (RX.route = {});


    /* ========================================================
       CONFIG
       ======================================================== */

    Route.config = {

        router:
            "https://router.project-osrm.org/route/v1/driving/",

        profile:
            "driving",

        timeout:
            15000,

        cacheKey:
            "riderx_route_cache",

        cacheDuration:
            5 * 60 * 1000,

        maxCacheItems:
            20,

        defaultZoom:
            14
    };


    /* ========================================================
       STATE
       ======================================================== */

    Route.state = {

        initialized:
            false,

        active:
            null,

        map:
            null,

        polyline:
            null,

        alternatePolylines:
            [],

        markers:
            {

                pickup:
                    null,

                destination:
                    null,

                rider:
                    null
            },

        loading:
            false,

        lastRequest:
            null,

        lastResult:
            null,

        steps:
            [],

        distanceKm:
            0,

        durationMinutes:
            0
    };


    /* ========================================================
       NORMALIZE POINT
       ======================================================== */

    Route.normalizePoint =
        function (
            point
        ) {

            if (
                !point
            ) {

                return null;
            }


            let lat =
                null;

            let lng =
                null;


            /*
             * Array:
             * [lat, lng]
             */

            if (
                Array.isArray(
                    point
                )
            ) {

                lat =
                    Number(
                        point[0]
                    );

                lng =
                    Number(
                        point[1]
                    );
            }


            /*
             * Object:
             * {lat, lng}
             */

            if (
                typeof point ===
                "object"
            ) {

                lat =
                    Number(
                        point.lat ??
                        point.latitude
                    );

                lng =
                    Number(
                        point.lng ??
                        point.lon ??
                        point.longitude
                    );
            }


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


            if (
                lat < -90 ||
                lat > 90 ||
                lng < -180 ||
                lng > 180
            ) {

                return null;
            }


            return {

                lat:
                    lat,

                lng:
                    lng
            };
        };


    /* ========================================================
       POINT KEY
       ======================================================== */

    Route.pointKey =
        function (
            point
        ) {

            const p =
                Route.normalizePoint(
                    point
                );


            if (
                !p
            ) {

                return "";
            }


            return (
                p.lat.toFixed(
                    5
                ) +
                "," +
                p.lng.toFixed(
                    5
                )
            );
        };


    /* ========================================================
       BUILD CACHE KEY
       ======================================================== */

    Route.cacheKey =
        function (
            from,
            to,
            options
        ) {

            const start =
                Route.pointKey(
                    from
                );

            const end =
                Route.pointKey(
                    to
                );


            const mode =
                options &&
                options.profile
                    ? options.profile
                    : Route.config.profile;


            return (
                mode +
                "|" +
                start +
                "|" +
                end
            );
        };


    /* ========================================================
       FETCH ROUTE
       ======================================================== */

    Route.getRoute =
        async function (
            from,
            to,
            options
        ) {

            const start =
                Route.normalizePoint(
                    from
                );

            const end =
                Route.normalizePoint(
                    to
                );


            if (
                !start ||
                !end
            ) {

                throw new Error(
                    "Invalid route coordinates."
                );
            }


            options =
                options ||
                {};


            const key =
                Route.cacheKey(
                    start,
                    end,
                    options
                );


            const cached =
                Route.getCache(
                    key
                );


            if (
                cached
            ) {

                Route.state.lastResult =
                    cached;

                Route.state.distanceKm =
                    cached.distanceKm;

                Route.state.durationMinutes =
                    cached.durationMinutes;

                Route.state.steps =
                    cached.steps ||
                    [];

                return cached;
            }


            Route.state.loading =
                true;


            Route.state.lastRequest =
                {

                    from:
                        start,

                    to:
                        end,

                    timestamp:
                        Date.now()
                };


            const coordinates =
                start.lng +
                "," +
                start.lat +
                ";" +
                end.lng +
                "," +
                end.lat;


            const url =
                Route.config.router +
                coordinates +
                "?overview=full" +
                "&geometries=geojson" +
                "&steps=true" +
                "&alternatives=true";


            try {

                const controller =
                    new AbortController();


                const timeout =
                    setTimeout(
                        function () {

                            controller.abort();

                        },
                        options.timeout ||
                        Route.config.timeout
                    );


                const response =
                    await fetch(
                        url,
                        {

                            method:
                                "GET",

                            headers:
                                {

                                    Accept:
                                        "application/json"
                                },

                            signal:
                                controller.signal
                        }
                    );


                clearTimeout(
                    timeout
                );


                if (
                    !response.ok
                ) {

                    throw new Error(
                        "Routing service unavailable."
                    );
                }


                const data =
                    await response.json();


                if (
                    !data ||
                    data.code !==
                    "Ok" ||
                    !Array.isArray(
                        data.routes
                    ) ||
                    !data.routes.length
                ) {

                    throw new Error(
                        "No route found."
                    );
                }


                const result =
                    Route.normalizeResult(
                        data,
                        start,
                        end
                    );


                Route.saveCache(
                    key,
                    result
                );


                Route.state.lastResult =
                    result;

                Route.state.distanceKm =
                    result.distanceKm;

                Route.state.durationMinutes =
                    result.durationMinutes;

                Route.state.steps =
                    result.steps ||
                    [];


                Route.emit(
                    "route-found",
                    {

                        result:
                            result
                    }
                );


                return result;

            } catch (error) {

                console.error(
                    "RiderX route error:",
                    error
                );


                /*
                 * Fallback:
                 * straight-line distance.
                 */

                const fallback =
                    Route.createFallback(
                        start,
                        end
                    );


                Route.state.lastResult =
                    fallback;

                Route.state.distanceKm =
                    fallback.distanceKm;

                Route.state.durationMinutes =
                    fallback.durationMinutes;

                Route.state.steps =
                    [];


                Route.emit(
                    "route-error",
                    {

                        error:
                            error,

                        fallback:
                            fallback
                    }
                );


                return fallback;

            } finally {

                Route.state.loading =
                    false;
            }
        };


    /* ========================================================
       NORMALIZE OSRM RESULT
       ======================================================== */

    Route.normalizeResult =
        function (
            data,
            start,
            end
        ) {

            const routes =
                data.routes ||
                [];


            const primary =
                routes[0];


            const alternatives =
                routes
                    .slice(
                        1
                    )
                    .map(
                        function (
                            route
                        ) {

                            return {

                                distance:
                                    Number(
                                        route.distance ||
                                        0
                                    ),

                                distanceKm:
                                    Number(
                                        route.distance ||
                                        0
                                    ) / 1000,

                                duration:
                                    Number(
                                        route.duration ||
                                        0
                                    ),

                                durationMinutes:
                                    Number(
                                        route.duration ||
                                        0
                                    ) / 60,

                                geometry:
                                    route.geometry ||
                                    null
                            };
                        }
                    );


            const steps =
                [];


            if (
                Array.isArray(
                    primary.legs
                )
            ) {

                primary.legs.forEach(
                    function (
                        leg
                    ) {

                        if (
                            Array.isArray(
                                leg.steps
                            )
                        ) {

                            leg.steps.forEach(
                                function (
                                    step,
                                    index
                                ) {

                                    steps.push(
                                        Route.normalizeStep(
                                            step,
                                            index
                                        )
                                    );
                                }
                            );
                        }
                    }
                );
            }


            const coordinates =
                primary.geometry &&
                Array.isArray(
                    primary.geometry.coordinates
                )
                    ? primary.geometry.coordinates
                    : [];


            return {

                code:
                    "Ok",

                from:
                    start,

                to:
                    end,

                distance:
                    Number(
                        primary.distance ||
                        0
                    ),

                distanceKm:
                    Number(
                        primary.distance ||
                        0
                    ) / 1000,

                duration:
                    Number(
                        primary.duration ||
                        0
                    ),

                durationMinutes:
                    Number(
                        primary.duration ||
                        0
                    ) / 60,

                durationText:
                    Route.formatDuration(
                        Number(
                            primary.duration ||
                            0
                        ) / 60
                    ),

                distanceText:
                    Route.formatDistance(
                        Number(
                            primary.distance ||
                            0
                        ) / 1000
                    ),

                geometry:
                    primary.geometry ||
                    null,

                coordinates:
                    coordinates,

                steps:
                    steps,

                alternatives:
                    alternatives,

                bounds:
                    Route.getBoundsFromCoordinates(
                        coordinates
                    ),

                timestamp:
                    Date.now()
            };
        };


    /* ========================================================
       NORMALIZE STEP
       ======================================================== */

    Route.normalizeStep =
        function (
            step,
            index
        ) {

            const maneuver =
                step.maneuver ||
                {};


            const location =
                Array.isArray(
                    maneuver.location
                )
                    ? {

                        lat:
                            Number(
                                maneuver.location[1]
                            ),

                        lng:
                            Number(
                                maneuver.location[0]
                            )

                    }
                    : null;


            return {

                index:
                    index,

                instruction:
                    Route.cleanInstruction(
                        step.name ||
                        maneuver.type ||
                        "Continue"
                    ),

                name:
                    step.name ||
                    "",

                type:
                    maneuver.type ||
                    "",

                modifier:
                    maneuver.modifier ||
                    "",

                distance:
                    Number(
                        step.distance ||
                        0
                    ),

                distanceKm:
                    Number(
                        step.distance ||
                        0
                    ) / 1000,

                duration:
                    Number(
                        step.duration ||
                        0
                    ),

                durationMinutes:
                    Number(
                        step.duration ||
                        0
                    ) / 60,

                location:
                    location,

                exit:
                    maneuver.exit ||
                    null
            };
        };


    /* ========================================================
       CLEAN INSTRUCTION
       ======================================================== */

    Route.cleanInstruction =
        function (
            value
        ) {

            let text =
                String(
                    value ||
                    "Continue"
                );


            text =
                text.replace(
                    /_/g,
                    " "
                );


            text =
                text.charAt(
                    0
                ).toUpperCase() +
                text.slice(
                    1
                );


            return text;
        };


    /* ========================================================
       FALLBACK ROUTE
       ======================================================== */

    Route.createFallback =
        function (
            from,
            to
        ) {

            const distanceKm =
                Route.distanceBetween(
                    from,
                    to
                );


            /*
             * Approximate ETA for city driving.
             */

            const durationMinutes =
                Math.max(
                    1,
                    (
                        distanceKm /
                        25
                    ) *
                    60
                );


            return {

                code:
                    "Fallback",

                from:
                    from,

                to:
                    to,

                distance:
                    distanceKm *
                    1000,

                distanceKm:
                    distanceKm,

                duration:
                    durationMinutes *
                    60,

                durationMinutes:
                    durationMinutes,

                durationText:
                    Route.formatDuration(
                        durationMinutes
                    ),

                distanceText:
                    Route.formatDistance(
                        distanceKm
                    ),

                geometry:
                    null,

                coordinates:
                    [

                        [
                            from.lng,
                            from.lat
                        ],

                        [
                            to.lng,
                            to.lat
                        ]

                    ],

                steps:
                    [],

                alternatives:
                    [],

                bounds:
                    [

                        [
                            from.lat,
                            from.lng
                        ],

                        [
                            to.lat,
                            to.lng
                        ]

                    ],

                timestamp:
                    Date.now(),

                fallback:
                    true
            };
        };


    /* ========================================================
       STRAIGHT DISTANCE
       ======================================================== */

    Route.distanceBetween =
        function (
            a,
            b
        ) {

            const p1 =
                Route.normalizePoint(
                    a
                );

            const p2 =
                Route.normalizePoint(
                    b
                );


            if (
                !p1 ||
                !p2
            ) {

                return 0;
            }


            const earth =
                6371;


            const dLat =
                (
                    p2.lat -
                    p1.lat
                ) *
                Math.PI /
                180;


            const dLng =
                (
                    p2.lng -
                    p1.lng
                ) *
                Math.PI /
                180;


            const lat1 =
                p1.lat *
                Math.PI /
                180;


            const lat2 =
                p2.lat *
                Math.PI /
                180;


            const x =
                Math.sin(
                    dLat /
                    2
                ) *
                Math.sin(
                    dLat /
                    2
                ) +
                Math.sin(
                    dLng /
                    2
                ) *
                Math.sin(
                    dLng /
                    2
                ) *
                Math.cos(
                    lat1
                ) *
                Math.cos(
                    lat2
                );


            const y =
                2 *
                Math.atan2(
                    Math.sqrt(
                        x
                    ),
                    Math.sqrt(
                        1 -
                        x
                    )
                );


            return earth * y;
        };


    /* ========================================================
       DRAW ROUTE
       ======================================================== */

    Route.draw =
        function (
            map,
            result,
            options
        ) {

            if (
                !map ||
                !result
            ) {

                return null;
            }


            Route.state.map =
                map;


            options =
                options ||
                {};


            Route.clear(
                false
            );


            /*
             * Convert OSRM [lng,lat]
             * to Leaflet [lat,lng].
             */

            const coordinates =
                result.coordinates ||
                [];


            const latLngs =
                coordinates.map(
                    function (
                        coordinate
                    ) {

                        return [

                            Number(
                                coordinate[1]
                            ),

                            Number(
                                coordinate[0]
                            )

                        ];
                    }
                );


            if (
                !latLngs.length
            ) {

                return null;
            }


            /*
             * Leaflet availability check.
             */

            if (
                !window.L ||
                typeof L.polyline !==
                "function"
            ) {

                console.warn(
                    "Leaflet is not available."
                );


                return latLngs;
            }


            const polylineOptions =
                {

                    weight:
                        options.weight ||
                        5,

                    opacity:
                        options.opacity ??
                        0.9,

                    lineCap:
                        "round",

                    lineJoin:
                        "round"
                };


            Route.state.polyline =
                L.polyline(
                    latLngs,
                    polylineOptions
                )
                .addTo(
                    map
                );


            /*
             * Alternatives.
             */

            if (
                Array.isArray(
                    result.alternatives
                )
            ) {

                result.alternatives
                    .forEach(
                        function (
                            alternative
                        ) {

                            if (
                                !alternative.geometry ||
                                !Array.isArray(
                                    alternative
                                        .geometry
                                        .coordinates
                                )
                            ) {

                                return;
                            }


                            const altLatLngs =
                                alternative
                                    .geometry
                                    .coordinates
                                    .map(
                                        function (
                                            coordinate
                                        ) {

                                            return [

                                                Number(
                                                    coordinate[1]
                                                ),

                                                Number(
                                                    coordinate[0]
                                                )

                                            ];
                                        }
                                    );


                            if (
                                !altLatLngs.length
                            ) {

                                return;
                            }


                            const alt =
                                L.polyline(
                                    altLatLngs,
                                    {

                                        weight:
                                            4,

                                        opacity:
                                            0.35,

                                        dashArray:
                                            "8 8"
                                    }
                                )
                                .addTo(
                                    map
                                );


                            Route.state
                                .alternatePolylines
                                .push(
                                    alt
                                );
                        }
                    );
            }


            /*
             * Fit map to route.
             */

            if (
                options.fitBounds !==
                false &&
                Route.state.polyline
            ) {

                try {

                    map.fitBounds(
                        Route.state
                            .polyline
                            .getBounds(),
                        {

                            padding:
                                options.padding ||
                                [
                                    40,
                                    40
                                ],

                            maxZoom:
                                options.maxZoom ||
                                16
                        }
                    );

                } catch (error) {}
            }


            Route.emit(
                "drawn",
                {

                    result:
                        result,

                    polyline:
                        Route.state.polyline
                }
            );


            return Route.state.polyline;
        };


    /* ========================================================
       DRAW SIMPLE LINE
       ======================================================== */

    Route.drawSimple =
        function (
            map,
            from,
            to,
            options
        ) {

            const start =
                Route.normalizePoint(
                    from
                );

            const end =
                Route.normalizePoint(
                    to
                );


            if (
                !map ||
                !start ||
                !end ||
                !window.L
            ) {

                return null;
            }


            Route.clear(
                false
            );


            const line =
                L.polyline(
                    [

                        [
                            start.lat,
                            start.lng
                        ],

                        [
                            end.lat,
                            end.lng
                        ]

                    ],
                    {

                        weight:
                            options?.weight ||
                            5,

                        opacity:
                            options?.opacity ??
                            0.8,

                        dashArray:
                            options?.dashArray ||
                            null
                    }
                )
                .addTo(
                    map
                );


            Route.state.map =
                map;

            Route.state.polyline =
                line;


            if (
                options?.fitBounds !==
                false
            ) {

                try {

                    map.fitBounds(
                        line.getBounds(),
                        {

                            padding:
                                [
                                    40,
                                    40
                                ],

                            maxZoom:
                                16
                        }
                    );

                } catch (error) {}
            }


            return line;
        };


    /* ========================================================
       CLEAR ROUTE
       ======================================================== */

    Route.clear =
        function (
            clearMarkers
        ) {

            if (
                Route.state.map &&
                Route.state.polyline
            ) {

                try {

                    Route.state.map
                        .removeLayer(
                            Route.state.polyline
                        );

                } catch (error) {}
            }


            Route.state.polyline =
                null;


            if (
                Route.state.map
            ) {

                Route.state
                    .alternatePolylines
                    .forEach(
                        function (
                            line
                        ) {

                            try {

                                Route.state.map
                                    .removeLayer(
                                        line
                                    );

                            } catch (error) {}
                        }
                    );
            }


            Route.state
                .alternatePolylines =
                [];


            if (
                clearMarkers !==
                false
            ) {

                Route.clearMarkers();
            }
        };


    /* ========================================================
       MARKERS
       ======================================================== */

    Route.setMarker =
        function (
            type,
            point,
            options
        ) {

            const map =
                Route.state.map;


            if (
                !map ||
                !window.L
            ) {

                return null;
            }


            const normalized =
                Route.normalizePoint(
                    point
                );


            if (
                !normalized
            ) {

                return null;
            }


            if (
                Route.state.markers[type]
            ) {

                try {

                    map.removeLayer(
                        Route.state.markers[type]
                    );

                } catch (error) {}
            }


            const marker =
                L.marker(
                    [
                        normalized.lat,
                        normalized.lng
                    ],
                    options || {}
                )
                .addTo(
                    map
                );


            Route.state.markers[type] =
                marker;


            return marker;
        };


    Route.clearMarkers =
        function () {

            const map =
                Route.state.map;


            if (
                !map
            ) {

                return;
            }


            Object.keys(
                Route.state.markers
            )
            .forEach(
                function (
                    key
                ) {

                    const marker =
                        Route.state
                            .markers[key];


                    if (
                        marker
                    ) {

                        try {

                            map.removeLayer(
                                marker
                            );

                        } catch (error) {}
                    }


                    Route.state.markers[key] =
                        null;
                }
            );
        };


    /* ========================================================
       DRAW RIDE ROUTE
       ======================================================== */

    Route.drawRideRoute =
        async function (
            map,
            pickup,
            destination,
            options
        ) {

            const result =
                await Route.getRoute(
                    pickup,
                    destination,
                    options
                );


            Route.draw(
                map,
                result,
                options
            );


            Route.setMarker(
                "pickup",
                pickup,
                options?.pickupMarker
            );


            Route.setMarker(
                "destination",
                destination,
                options?.destinationMarker
            );


            Route.state.active =
                {

                    type:
                        "ride",

                    pickup:
                        Route.normalizePoint(
                            pickup
                        ),

                    destination:
                        Route.normalizePoint(
                            destination
                        )
                };


            Route.updateUI(
                result
            );


            return result;
        };


    /* ========================================================
       DRAW RIDER TO PICKUP
       ======================================================== */

    Route.drawRiderToPickup =
        async function (
            map,
            rider,
            pickup,
            options
        ) {

            const result =
                await Route.getRoute(
                    rider,
                    pickup,
                    options
                );


            Route.draw(
                map,
                result,
                options
            );


            Route.setMarker(
                "rider",
                rider,
                options?.riderMarker
            );


            Route.setMarker(
                "pickup",
                pickup,
                options?.pickupMarker
            );


            Route.state.active =
                {

                    type:
                        "rider-to-pickup",

                    rider:
                        Route.normalizePoint(
                            rider
                        ),

                    pickup:
                        Route.normalizePoint(
                            pickup
                        )
                };


            Route.updateUI(
                result
            );


            return result;
        };


    /* ========================================================
       DRAW RIDER TO DESTINATION
       ======================================================== */

    Route.drawRiderToDestination =
        async function (
            map,
            rider,
            destination,
            options
        ) {

            const result =
                await Route.getRoute(
                    rider,
                    destination,
                    options
                );


            Route.draw(
                map,
                result,
                options
            );


            Route.setMarker(
                "rider",
                rider,
                options?.riderMarker
            );


            Route.setMarker(
                "destination",
                destination,
                options?.destinationMarker
            );


            Route.state.active =
                {

                    type:
                        "rider-to-destination",

                    rider:
                        Route.normalizePoint(
                            rider
                        ),

                    destination:
                        Route.normalizePoint(
                            destination
                        )
                };


            Route.updateUI(
                result
            );


            return result;
        };


    /* ========================================================
       UPDATE UI
       ======================================================== */

    Route.updateUI =
        function (
            result
        ) {

            if (
                !result
            ) {

                return;
            }


            const values =
                {

                    distance:
                        result.distanceText,

                    distanceKm:
                        result.distanceKm
                            .toFixed(
                                1
                            ) +
                        " km",

                    duration:
                        result.durationText,

                    durationMinutes:
                        Math.ceil(
                            result.durationMinutes
                        ) +
                        " min"
                };


            Object.entries(
                values
            )
            .forEach(
                function (
                    [
                        key,
                        value
                    ]
                ) {

                    document
                        .querySelectorAll(
                            `[data-route="${key}"]`
                        )
                        .forEach(
                            function (
                                element
                            ) {

                                element.textContent =
                                    value;
                            }
                        );
                }
            );


            document
                .querySelectorAll(
                    "[data-route-distance]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            result.distanceText;
                    }
                );


            document
                .querySelectorAll(
                    "[data-route-eta]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            result.durationText;
                    }
                );


            Route.emit(
                "updated",
                {

                    result:
                        result
                }
            );
        };


    /* ========================================================
       ETA
       ======================================================== */

    Route.getETA =
        function (
            distanceKm,
            speedKmh
        ) {

            const distance =
                Number(
                    distanceKm ||
                    0
                );


            const speed =
                Number(
                    speedKmh ||
                    25
                );


            if (
                distance <= 0 ||
                speed <= 0
            ) {

                return 0;
            }


            return (
                distance /
                speed
            ) *
            60;
        };


    /* ========================================================
       FORMAT DISTANCE
       ======================================================== */

    Route.formatDistance =
        function (
            km
        ) {

            km =
                Number(
                    km ||
                    0
                );


            if (
                km < 1
            ) {

                return (
                    Math.round(
                        km *
                        1000
                    ) +
                    " m"
                );
            }


            return (
                km.toFixed(
                    km < 10
                        ? 1
                        : 0
                ) +
                " km"
            );
        };


    /* ========================================================
       FORMAT DURATION
       ======================================================== */

    Route.formatDuration =
        function (
            minutes
        ) {

            minutes =
                Math.max(
                    0,
                    Number(
                        minutes ||
                        0
                    )
                );


            const rounded =
                Math.ceil(
                    minutes
                );


            if (
                rounded < 60
            ) {

                return (
                    rounded +
                    " min"
                );
            }


            const hours =
                Math.floor(
                    rounded /
                    60
                );


            const mins =
                rounded %
                60;


            if (
                mins === 0
            ) {

                return (
                    hours +
                    (
                        hours ===
                        1
                            ? " hour"
                            : " hours"
                    )
                );
            }


            return (
                hours +
                "h " +
                mins +
                "m"
            );
        };


    /* ========================================================
       BOUNDS
       ======================================================== */

    Route.getBoundsFromCoordinates =
        function (
            coordinates
        ) {

            if (
                !Array.isArray(
                    coordinates
                ) ||
                !coordinates.length
            ) {

                return null;
            }


            let minLat =
                Infinity;

            let maxLat =
                -Infinity;

            let minLng =
                Infinity;

            let maxLng =
                -Infinity;


            coordinates.forEach(
                function (
                    coordinate
                ) {

                    if (
                        !Array.isArray(
                            coordinate
                        ) ||
                        coordinate.length <
                        2
                    ) {

                        return;
                    }


                    const lng =
                        Number(
                            coordinate[0]
                        );

                    const lat =
                        Number(
                            coordinate[1]
                        );


                    if (
                        !Number.isFinite(
                            lat
                        ) ||
                        !Number.isFinite(
                            lng
                        )
                    ) {

                        return;
                    }


                    minLat =
                        Math.min(
                            minLat,
                            lat
                        );


                    maxLat =
                        Math.max(
                            maxLat,
                            lat
                        );


                    minLng =
                        Math.min(
                            minLng,
                            lng
                        );


                    maxLng =
                        Math.max(
                            maxLng,
                            lng
                        );
                }
            );


            if (
                minLat ===
                Infinity
            ) {

                return null;
            }


            return [

                [
                    minLat,
                    minLng
                ],

                [
                    maxLat,
                    maxLng
                ]

            ];
        };


    /* ========================================================
       NAVIGATION STEP
       ======================================================== */

    Route.getNextStep =
        function (
            currentLocation
        ) {

            const current =
                Route.normalizePoint(
                    currentLocation
                );


            if (
                !current ||
                !Route.state.steps.length
            ) {

                return null;
            }


            let nearest =
                null;

            let nearestDistance =
                Infinity;


            Route.state.steps
                .forEach(
                    function (
                        step
                    ) {

                        if (
                            !step.location
                        ) {

                            return;
                        }


                        const distance =
                            Route.distanceBetween(
                                current,
                                step.location
                            );


                        if (
                            distance <
                            nearestDistance
                        ) {

                            nearestDistance =
                                distance;

                            nearest =
                                step;
                        }
                    }
                );


            return nearest;
        };


    /* ========================================================
       CACHE
       ======================================================== */

    Route.getAllCache =
        function () {

            try {

                return JSON.parse(
                    localStorage.getItem(
                        Route.config.cacheKey
                    ) ||
                    "{}"
                );

            } catch (error) {

                return {};
            }
        };


    Route.getCache =
        function (
            key
        ) {

            try {

                const cache =
                    Route.getAllCache();


                const item =
                    cache[key];


                if (
                    !item
                ) {

                    return null;
                }


                if (
                    Date.now() -
                    Number(
                        item.timestamp ||
                        0
                    ) >
                    Route.config.cacheDuration
                ) {

                    delete cache[key];

                    localStorage.setItem(
                        Route.config.cacheKey,
                        JSON.stringify(
                            cache
                        )
                    );

                    return null;
                }


                return item.data ||
                    null;

            } catch (error) {

                return null;
            }
        };


    Route.saveCache =
        function (
            key,
            data
        ) {

            try {

                const cache =
                    Route.getAllCache();


                cache[key] =
                    {

                        timestamp:
                            Date.now(),

                        data:
                            data
                    };


                const keys =
                    Object.keys(
                        cache
                    );


                if (
                    keys.length >
                    Route.config.maxCacheItems
                ) {

                    keys
                        .sort(
                            function (
                                a,
                                b
                            ) {

                                return (
                                    Number(
                                        cache[a]
                                            .timestamp
                                    ) -
                                    Number(
                                        cache[b]
                                            .timestamp
                                    )
                                );
                            }
                        )
                        .slice(
                            0,
                            keys.length -
                            Route.config.maxCacheItems
                        )
                        .forEach(
                            function (
                                oldKey
                            ) {

                                delete cache[
                                    oldKey
                                ];
                            }
                        );
                }


                localStorage.setItem(
                    Route.config.cacheKey,
                    JSON.stringify(
                        cache
                    )
                );

            } catch (error) {}
        };


    /* ========================================================
       CLEAR CACHE
       ======================================================== */

    Route.clearCache =
        function () {

            try {

                localStorage.removeItem(
                    Route.config.cacheKey
                );

            } catch (error) {}
        };


    /* ========================================================
       CURRENT ROUTE
       ======================================================== */

    Route.getCurrent =
        function () {

            return (
                Route.state.lastResult ||
                null
            );
        };


    Route.getDistance =
        function () {

            return Number(
                Route.state.distanceKm ||
                0
            );
        };


    Route.getDuration =
        function () {

            return Number(
                Route.state.durationMinutes ||
                0
            );
        };


    Route.getSteps =
        function () {

            return [
                ...Route.state.steps
            ];
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Route.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-route-" +
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
       EVENT BINDING
       ======================================================== */

    Route.bindEvents =
        function () {

            /*
             * Clear route button.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-route-clear]"
                        );


                    if (
                        button
                    ) {

                        event.preventDefault();

                        Route.clear();
                    }
                }
            );


            /*
             * Refresh route.
             */

            document.addEventListener(
                "click",
                async function (
                    event
                ) {

                    const button =
                        event.target.closest(
                            "[data-route-refresh]"
                        );


                    if (
                        !button
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const active =
                        Route.state.active;


                    if (
                        !active
                    ) {

                        return;
                    }


                    try {

                        if (
                            active.type ===
                            "ride"
                        ) {

                            await Route.drawRideRoute(
                                Route.state.map,
                                active.pickup,
                                active.destination
                            );
                        }


                        if (
                            active.type ===
                            "rider-to-pickup"
                        ) {

                            await Route.drawRiderToPickup(
                                Route.state.map,
                                active.rider,
                                active.pickup
                            );
                        }


                        if (
                            active.type ===
                            "rider-to-destination"
                        ) {

                            await Route.drawRiderToDestination(
                                Route.state.map,
                                active.rider,
                                active.destination
                            );
                        }

                    } catch (error) {

                        console.error(
                            error
                        );
                    }
                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.routeEngine =
        Route;


    RX.getRoute =
        Route.getRoute;


    RX.drawRoute =
        Route.draw;


    RX.drawRideRoute =
        Route.drawRideRoute;


    RX.drawRiderToPickup =
        Route.drawRiderToPickup;


    RX.drawRiderToDestination =
        Route.drawRiderToDestination;


    RX.clearRoute =
        Route.clear;


    RX.getRouteDistance =
        Route.getDistance;


    RX.getRouteDuration =
        Route.getDuration;


    RX.getRouteSteps =
        Route.getSteps;


    RX.distanceBetween =
        Route.distanceBetween;


    /* ========================================================
       INIT
       ======================================================== */

    Route.init =
        function () {

            if (
                Route.state.initialized
            ) {

                return;
            }


            Route.state.initialized =
                true;


            Route.bindEvents();


            console.log(
                "RiderX route.js loaded."
            );
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Route.init
        );

    } else {

        Route.init();

    }

})();

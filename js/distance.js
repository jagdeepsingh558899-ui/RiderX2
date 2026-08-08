/* ============================================================
   RIDERX DISTANCE ENGINE
   File: js/distance.js

   Distance utilities for:
   - Pickup → Destination
   - Route distance
   - Straight-line distance
   - KM / Miles conversion
   - ETA estimation
   - Fare system support
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Distance =
        RX.distance =
        RX.distance || {};


    /* ========================================================
       CONSTANTS
       ======================================================== */

    Distance.EARTH_RADIUS_KM =
        6371.0088;

    Distance.EARTH_RADIUS_M =
        6371008.8;

    Distance.KM_TO_MILES =
        0.6213711922;

    Distance.MILES_TO_KM =
        1.609344;

    Distance.KM_TO_METERS =
        1000;

    Distance.METERS_TO_KM =
        0.001;


    /* ========================================================
       NUMBER HELPERS
       ======================================================== */

    Distance.number =
        function (value, fallback) {

            const number =
                Number(value);

            if (
                Number.isFinite(number)
            ) {

                return number;
            }

            return (
                fallback ??
                0
            );
        };


    Distance.round =
        function (
            value,
            decimals
        ) {

            const number =
                Distance.number(
                    value
                );

            const places =
                Number.isFinite(
                    Number(decimals)
                )
                    ? Number(decimals)
                    : 2;

            const factor =
                Math.pow(
                    10,
                    places
                );

            return (
                Math.round(
                    number * factor
                ) / factor
            );
        };


    /* ========================================================
       COORDINATE NORMALIZATION
       ======================================================== */

    Distance.normalizePoint =
        function (point) {

            if (!point) {
                return null;
            }


            let lat =
                point.lat ??
                point.latitude;


            let lng =
                point.lng ??
                point.lon ??
                point.longitude;


            /*
             * Support Leaflet LatLng.
             */

            if (
                typeof point.lat ===
                    "function" &&
                typeof point.lng ===
                    "function"
            ) {

                lat =
                    point.lat();

                lng =
                    point.lng();
            }


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


    Distance.isValidPoint =
        function (point) {

            return Boolean(
                Distance.normalizePoint(
                    point
                )
            );
        };


    /* ========================================================
       HAVERSINE DISTANCE
       ======================================================== */

    Distance.haversine =
        function (
            pointA,
            pointB
        ) {

            const a =
                Distance.normalizePoint(
                    pointA
                );

            const b =
                Distance.normalizePoint(
                    pointB
                );


            if (!a || !b) {

                return 0;
            }


            const lat1 =
                a.lat *
                Math.PI /
                180;

            const lat2 =
                b.lat *
                Math.PI /
                180;


            const deltaLat =
                (
                    b.lat -
                    a.lat
                ) *
                Math.PI /
                180;


            const deltaLng =
                (
                    b.lng -
                    a.lng
                ) *
                Math.PI /
                180;


            const sinLat =
                Math.sin(
                    deltaLat / 2
                );


            const sinLng =
                Math.sin(
                    deltaLng / 2
                );


            const value =
                (
                    sinLat *
                    sinLat
                ) +
                (
                    Math.cos(lat1) *
                    Math.cos(lat2) *
                    sinLng *
                    sinLng
                );


            const safeValue =
                Math.min(
                    1,
                    Math.max(
                        0,
                        value
                    )
                );


            const centralAngle =
                2 *
                Math.atan2(
                    Math.sqrt(
                        safeValue
                    ),
                    Math.sqrt(
                        1 -
                        safeValue
                    )
                );


            return (
                Distance
                    .EARTH_RADIUS_KM *
                centralAngle
            );
        };


    Distance.calculate =
        Distance.haversine;


    /* ========================================================
       METERS
       ======================================================== */

    Distance.haversineMeters =
        function (
            pointA,
            pointB
        ) {

            return (
                Distance.haversine(
                    pointA,
                    pointB
                ) *
                Distance.KM_TO_METERS
            );
        };


    /* ========================================================
       MILES
       ======================================================== */

    Distance.haversineMiles =
        function (
            pointA,
            pointB
        ) {

            return (
                Distance.haversine(
                    pointA,
                    pointB
                ) *
                Distance.KM_TO_MILES
            );
        };


    /* ========================================================
       DISTANCE BETWEEN MULTIPLE POINTS
       ======================================================== */

    Distance.polylineDistance =
        function (
            points
        ) {

            if (
                !Array.isArray(points) ||
                points.length < 2
            ) {

                return 0;
            }


            let total =
                0;


            for (
                let i = 1;
                i < points.length;
                i++
            ) {

                total +=
                    Distance.haversine(
                        points[i - 1],
                        points[i]
                    );
            }


            return total;
        };


    Distance.routeDistance =
        Distance.polylineDistance;


    /* ========================================================
       ROUTE SUMMARY
       ======================================================== */

    Distance.routeSummary =
        function (
            points
        ) {

            const km =
                Distance.polylineDistance(
                    points
                );


            return {

                kilometers:
                    Distance.round(
                        km,
                        2
                    ),

                meters:
                    Math.round(
                        km *
                        1000
                    ),

                miles:
                    Distance.round(
                        km *
                        Distance.KM_TO_MILES,
                        2
                    ),

                points:
                    Array.isArray(points)
                        ? points.length
                        : 0
            };
        };


    /* ========================================================
       CONVERSIONS
       ======================================================== */

    Distance.kmToMeters =
        function (km) {

            return (
                Distance.number(
                    km
                ) *
                1000
            );
        };


    Distance.metersToKm =
        function (meters) {

            return (
                Distance.number(
                    meters
                ) /
                1000
            );
        };


    Distance.kmToMiles =
        function (km) {

            return (
                Distance.number(
                    km
                ) *
                Distance.KM_TO_MILES
            );
        };


    Distance.milesToKm =
        function (miles) {

            return (
                Distance.number(
                    miles
                ) *
                Distance.MILES_TO_KM
            );
        };


    Distance.metersToMiles =
        function (meters) {

            return Distance.kmToMiles(
                Distance.metersToKm(
                    meters
                )
            );
        };


    Distance.milesToMeters =
        function (miles) {

            return Distance.kmToMeters(
                Distance.milesToKm(
                    miles
                )
            );
        };


    /* ========================================================
       FORMAT DISTANCE
       ======================================================== */

    Distance.format =
        function (
            km,
            options
        ) {

            options =
                options ||
                {};


            const value =
                Distance.number(
                    km
                );


            const unit =
                options.unit ||
                "km";


            const decimals =
                options.decimals ??
                (
                    value < 1
                        ? 1
                        : 1
                );


            let converted =
                value;


            let suffix =
                "km";


            switch (
                String(unit)
                    .toLowerCase()
            ) {

                case "m":
                case "meter":
                case "meters":

                    converted =
                        value *
                        1000;

                    suffix =
                        "m";

                    break;


                case "mi":
                case "mile":
                case "miles":

                    converted =
                        Distance
                            .kmToMiles(
                                value
                            );

                    suffix =
                        "mi";

                    break;


                default:

                    converted =
                        value;

                    suffix =
                        "km";
            }


            if (
                suffix === "m" &&
                converted >= 1000
            ) {

                converted =
                    value;

                suffix =
                    "km";
            }


            return (
                Distance.round(
                    converted,
                    decimals
                ) +
                " " +
                suffix
            );
        };


    /* ========================================================
       SMART DISTANCE FORMAT
       ======================================================== */

    Distance.formatSmart =
        function (
            km
        ) {

            const value =
                Distance.number(
                    km
                );


            if (
                value < 1
            ) {

                return (
                    Math.round(
                        value *
                        1000
                    ) +
                    " m"
                );
            }


            if (
                value < 10
            ) {

                return (
                    value.toFixed(
                        1
                    ) +
                    " km"
                );
            }


            return (
                Math.round(
                    value
                ) +
                " km"
            );
        };


    /* ========================================================
       BEARING
       ======================================================== */

    Distance.bearing =
        function (
            pointA,
            pointB
        ) {

            const a =
                Distance.normalizePoint(
                    pointA
                );

            const b =
                Distance.normalizePoint(
                    pointB
                );


            if (!a || !b) {
                return 0;
            }


            const lat1 =
                a.lat *
                Math.PI /
                180;

            const lat2 =
                b.lat *
                Math.PI /
                180;


            const deltaLng =
                (
                    b.lng -
                    a.lng
                ) *
                Math.PI /
                180;


            const y =
                Math.sin(
                    deltaLng
                ) *
                Math.cos(lat2);


            const x =
                Math.cos(lat1) *
                Math.sin(lat2) -
                Math.sin(lat1) *
                Math.cos(lat2) *
                Math.cos(deltaLng);


            const angle =
                Math.atan2(
                    y,
                    x
                ) *
                180 /
                Math.PI;


            return (
                angle +
                360
            ) % 360;
        };


    /* ========================================================
       COMPASS DIRECTION
       ======================================================== */

    Distance.direction =
        function (
            bearing
        ) {

            const value =
                (
                    Number(bearing) +
                    360
                ) % 360;


            const directions = [
                "N",
                "NE",
                "E",
                "SE",
                "S",
                "SW",
                "W",
                "NW"
            ];


            const index =
                Math.round(
                    value / 45
                ) %
                8;


            return directions[
                index
            ];
        };


    /* ========================================================
       ETA
       ======================================================== */

    Distance.estimateETA =
        function (
            distanceKm,
            speedKmh
        ) {

            const km =
                Math.max(
                    0,
                    Distance.number(
                        distanceKm
                    )
                );


            const speed =
                Math.max(
                    1,
                    Distance.number(
                        speedKmh,
                        25
                    )
                );


            const hours =
                km /
                speed;


            const minutes =
                Math.ceil(
                    hours *
                    60
                );


            return {

                minutes:
                    minutes,

                seconds:
                    minutes *
                    60,

                text:
                    Distance.formatETA(
                        minutes
                    )
            };
        };


    Distance.formatETA =
        function (
            minutes
        ) {

            const value =
                Math.max(
                    0,
                    Math.round(
                        Number(
                            minutes
                        ) || 0
                    )
                );


            if (
                value <= 0
            ) {

                return "Now";
            }


            if (
                value < 60
            ) {

                return (
                    value +
                    " min"
                );
            }


            const hours =
                Math.floor(
                    value / 60
                );


            const remaining =
                value %
                60;


            if (
                remaining === 0
            ) {

                return (
                    hours +
                    " hr"
                );
            }


            return (
                hours +
                " hr " +
                remaining +
                " min"
            );
        };


    /* ========================================================
       AVERAGE SPEED
       ======================================================== */

    Distance.averageSpeed =
        function (
            distanceKm,
            minutes
        ) {

            const distance =
                Distance.number(
                    distanceKm
                );


            const time =
                Distance.number(
                    minutes
                );


            if (
                distance <= 0 ||
                time <= 0
            ) {

                return 0;
            }


            return (
                distance /
                (
                    time / 60
                )
            );
        };


    /* ========================================================
       ROUTE VS STRAIGHT-LINE
       ======================================================== */

    Distance.roadFactor =
        function (
            straightDistance,
            routeDistance
        ) {

            const straight =
                Distance.number(
                    straightDistance
                );


            const route =
                Distance.number(
                    routeDistance
                );


            if (
                straight <= 0 ||
                route <= 0
            ) {

                return 1;
            }


            return (
                route /
                straight
            );
        };


    Distance.estimateRoadDistance =
        function (
            straightDistance,
            factor
        ) {

            const distance =
                Distance.number(
                    straightDistance
                );


            const multiplier =
                Distance.number(
                    factor,
                    1.25
                );


            return (
                distance *
                Math.max(
                    1,
                    multiplier
                )
            );
        };


    /* ========================================================
       ROUTE DATA NORMALIZATION
       ======================================================== */

    Distance.extractRouteDistance =
        function (
            route
        ) {

            if (!route) {
                return 0;
            }


            /*
             * Common routing APIs:
             *
             * distance in meters
             */

            if (
                Number.isFinite(
                    Number(
                        route.distance
                    )
                )
            ) {

                const distance =
                    Number(
                        route.distance
                    );


                /*
                 * Most route APIs use meters.
                 * If explicitly supplied in KM,
                 * respect it.
                 */

                if (
                    route.distanceUnit ===
                    "km"
                ) {

                    return distance;
                }


                return (
                    distance /
                    1000
                );
            }


            if (
                Number.isFinite(
                    Number(
                        route.distanceKm
                    )
                )
            ) {

                return Number(
                    route.distanceKm
                );
            }


            if (
                Number.isFinite(
                    Number(
                        route.kilometers
                    )
                )
            ) {

                return Number(
                    route.kilometers
                );
            }


            if (
                Number.isFinite(
                    Number(
                        route.km
                    )
                )
            ) {

                return Number(
                    route.km
                );
            }


            return 0;
        };


    /* ========================================================
       ROUTE ETA EXTRACTION
       ======================================================== */

    Distance.extractRouteETA =
        function (
            route
        ) {

            if (!route) {
                return 0;
            }


            if (
                Number.isFinite(
                    Number(
                        route.duration
                    )
                )
            ) {

                /*
                 * Most routing APIs return
                 * duration in seconds.
                 */

                return Math.ceil(
                    Number(
                        route.duration
                    ) /
                    60
                );
            }


            if (
                Number.isFinite(
                    Number(
                        route.durationMinutes
                    )
                )
            ) {

                return Math.ceil(
                    Number(
                        route.durationMinutes
                    )
                );
            }


            if (
                Number.isFinite(
                    Number(
                        route.minutes
                    )
                )
            ) {

                return Math.ceil(
                    Number(
                        route.minutes
                    )
                );
            }


            return 0;
        };


    /* ========================================================
       COMPLETE TRIP DISTANCE
       ======================================================== */

    Distance.trip =
        function (
            pickup,
            destination,
            options
        ) {

            options =
                options ||
                {};


            const straight =
                Distance.haversine(
                    pickup,
                    destination
                );


            let route =
                options.routeDistance;


            if (
                route === undefined ||
                route === null
            ) {

                route =
                    options.route?.distance ??
                    null;
            }


            let road =
                route !== null
                    ? Distance.extractRouteDistance(
                        {
                            distance:
                                route,
                            distanceUnit:
                                "km"
                        }
                    )
                    : 0;


            if (
                road <= 0
            ) {

                const factor =
                    options.roadFactor ??
                    1.25;


                road =
                    Distance
                        .estimateRoadDistance(
                            straight,
                            factor
                        );
            }


            return {

                straightDistanceKm:
                    Distance.round(
                        straight,
                        2
                    ),

                routeDistanceKm:
                    Distance.round(
                        road,
                        2
                    ),

                distanceKm:
                    Distance.round(
                        road,
                        2
                    ),

                distanceMeters:
                    Math.round(
                        road *
                        1000
                    ),

                distanceMiles:
                    Distance.round(
                        road *
                        Distance.KM_TO_MILES,
                        2
                    ),

                formatted:
                    Distance.formatSmart(
                        road
                    ),

                bearing:
                    Distance.bearing(
                        pickup,
                        destination
                    ),

                direction:
                    Distance.direction(
                        Distance.bearing(
                            pickup,
                            destination
                        )
                    )
            };
        };


    /* ========================================================
       DISTANCE VALIDATION
       ======================================================== */

    Distance.validateTrip =
        function (
            pickup,
            destination,
            options
        ) {

            options =
                options ||
                {};


            const a =
                Distance.normalizePoint(
                    pickup
                );


            const b =
                Distance.normalizePoint(
                    destination
                );


            if (!a) {

                return {

                    valid:
                        false,

                    error:
                        "Invalid pickup location."
                };
            }


            if (!b) {

                return {

                    valid:
                        false,

                    error:
                        "Invalid destination."
                };
            }


            const distance =
                Distance.haversine(
                    a,
                    b
                );


            if (
                distance <= 0.01
            ) {

                return {

                    valid:
                        false,

                    error:
                        "Pickup and destination are too close."
                };
            }


            if (
                options.minKm !==
                undefined &&
                distance <
                Number(
                    options.minKm
                )
            ) {

                return {

                    valid:
                        false,

                    error:
                        "Trip distance is below the minimum allowed distance."
                };
            }


            if (
                options.maxKm !==
                undefined &&
                distance >
                Number(
                    options.maxKm
                )
            ) {

                return {

                    valid:
                        false,

                    error:
                        "Trip distance exceeds the maximum allowed distance."
                };
            }


            return {

                valid:
                    true,

                pickup:
                    a,

                destination:
                    b,

                straightDistanceKm:
                    Distance.round(
                        distance,
                        2
                    )
            };
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Distance.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-distance-" +
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
       GLOBAL HELPERS
       ======================================================== */

    RX.calculateDistance =
        Distance.haversine;


    RX.calculateDistanceKm =
        Distance.haversine;


    RX.calculateDistanceMeters =
        Distance.haversineMeters;


    RX.formatDistance =
        Distance.formatSmart;


    RX.estimateETA =
        Distance.estimateETA;


    /* ========================================================
       READY
       ======================================================== */

    Distance.ready =
        true;


    Distance.emit(
        "ready",
        {
            version:
                "1.0.0"
        }
    );


    console.log(
        "RiderX distance.js loaded."
    );

})();

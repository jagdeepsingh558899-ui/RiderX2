/* ============================================================
   RIDERX - RATING & REVIEW CONTROLLER
   File: js/rating.js

   Handles:
   - 1-5 star rating
   - Ride rating
   - Rider rating
   - Customer rating
   - Written review
   - Firebase save
   - Average rating calculation
   - Rating history
   - Rating UI
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Rating =
        RX.rating ||
        (RX.rating = {});


    /* ========================================================
       CONFIG
       ======================================================== */

    Rating.config = {

        storageKey:
            "riderx_ratings",

        maxRating:
            5,

        minRating:
            1,

        maxReviewLength:
            500,

        ratingCollection:
            "ratings",

        defaultRating:
            5
    };


    /* ========================================================
       STATE
       ======================================================== */

    Rating.state = {

        initialized:
            false,

        loading:
            false,

        saving:
            false,

        selectedRating:
            0,

        currentRideId:
            null,

        currentTargetId:
            null,

        currentTargetRole:
            null,

        ratings:
            []
    };


    /* ========================================================
       FIREBASE USER
       ======================================================== */

    Rating.getUser =
        function () {

            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth()
                        .currentUser;
                }

            } catch (error) {}

            return null;
        };


    Rating.getUserId =
        function () {

            const user =
                Rating.getUser();


            if (
                user &&
                user.uid
            ) {

                return user.uid;
            }


            try {

                return (
                    localStorage.getItem(
                        "riderx_uid"
                    ) ||
                    localStorage.getItem(
                        "uid"
                    ) ||
                    null
                );

            } catch (error) {

                return null;
            }
        };


    Rating.getUserRole =
        function () {

            try {

                const role =
                    localStorage.getItem(
                        "riderx_role"
                    );


                if (
                    role
                ) {

                    return String(
                        role
                    ).toLowerCase();
                }

            } catch (error) {}


            try {

                if (
                    RX.auth &&
                    typeof RX.auth.getRole ===
                    "function"
                ) {

                    return RX.auth.getRole();
                }

            } catch (error) {}


            return "customer";
        };


    /* ========================================================
       DATABASE
       ======================================================== */

    Rating.getDatabase =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.database
                ) {

                    return RX.firebase.database;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.database ===
                    "function"
                ) {

                    return firebase.database();
                }

            } catch (error) {}


            return null;
        };


    Rating.getFirestore =
        function () {

            try {

                if (
                    RX.firebase &&
                    RX.firebase.firestore
                ) {

                    return RX.firebase.firestore;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.firestore ===
                    "function"
                ) {

                    return firebase.firestore();
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       NORMALIZE RATING
       ======================================================== */

    Rating.normalize =
        function (
            value
        ) {

            let rating =
                Number(
                    value
                );


            if (
                !Number.isFinite(
                    rating
                )
            ) {

                rating =
                    0;
            }


            rating =
                Math.round(
                    rating
                );


            rating =
                Math.max(
                    Rating.config.minRating,
                    Math.min(
                        Rating.config.maxRating,
                        rating
                    )
                );


            return rating;
        };


    /* ========================================================
       REVIEW TEXT
       ======================================================== */

    Rating.cleanReview =
        function (
            review
        ) {

            if (
                review ===
                undefined ||
                review ===
                null
            ) {

                return "";
            }


            return String(
                review
            )
            .trim()
            .slice(
                0,
                Rating.config.maxReviewLength
            );
        };


    /* ========================================================
       SET CURRENT RATING
       ======================================================== */

    Rating.setRating =
        function (
            value
        ) {

            const rating =
                Rating.normalize(
                    value
                );


            Rating.state.selectedRating =
                rating;


            Rating.renderStars(
                rating
            );


            Rating.emit(
                "selected",
                {

                    rating:
                        rating
                }
            );


            return rating;
        };


    /* ========================================================
       GET CURRENT RATING
       ======================================================== */

    Rating.getRating =
        function () {

            return Number(
                Rating.state.selectedRating ||
                0
            );
        };


    /* ========================================================
       SET RATING CONTEXT
       ======================================================== */

    Rating.setContext =
        function (
            data
        ) {

            data =
                data ||
                {};


            Rating.state.currentRideId =
                data.rideId ||
                data.tripId ||
                null;


            Rating.state.currentTargetId =
                data.targetId ||
                data.riderId ||
                data.customerId ||
                null;


            Rating.state.currentTargetRole =
                data.targetRole ||
                (
                    Rating.getUserRole() ===
                    "customer"
                        ? "rider"
                        : "customer"
                );


            if (
                data.rating !==
                undefined
            ) {

                Rating.setRating(
                    data.rating
                );

            } else {

                Rating.setRating(
                    0
                );
            }


            Rating.renderContext();


            return {
                ...Rating.state
            };
        };


    /* ========================================================
       RENDER CONTEXT
       ======================================================== */

    Rating.renderContext =
        function () {

            const state =
                Rating.state;


            document
                .querySelectorAll(
                    "[data-rating-ride-id]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.value =
                            state.currentRideId ||
                            "";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rating-target-id]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.value =
                            state.currentTargetId ||
                            "";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rating-target-role]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.value =
                            state.currentTargetRole ||
                            "";
                    }
                );
        };


    /* ========================================================
       STAR RENDERING
       ======================================================== */

    Rating.renderStars =
        function (
            rating
        ) {

            rating =
                Number(
                    rating ||
                    0
                );


            document
                .querySelectorAll(
                    "[data-rating-star]"
                )
                .forEach(
                    function (
                        star
                    ) {

                        const value =
                            Number(
                                star.dataset
                                    .ratingStar
                            );


                        const active =
                            value <=
                            rating;


                        star.classList.toggle(
                            "active",
                            active
                        );


                        star.classList.toggle(
                            "selected",
                            active
                        );


                        star.setAttribute(
                            "aria-checked",
                            String(
                                active
                            )
                        );


                        /*
                         * Supports Unicode
                         * star buttons.
                         */

                        if (
                            star.dataset
                                .ratingEmpty &&
                            star.dataset
                                .ratingFilled
                        ) {

                            star.textContent =
                                active
                                    ? star.dataset
                                        .ratingFilled
                                    : star.dataset
                                        .ratingEmpty;
                        }
                    }
                );


            document
                .querySelectorAll(
                    "[data-rating-value]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            rating >
                            0
                                ? rating
                                : "";
                    }
                );


            document
                .querySelectorAll(
                    "[data-rating-label]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Rating.getRatingLabel(
                                rating
                            );
                    }
                );
        };


    /* ========================================================
       RATING LABEL
       ======================================================== */

    Rating.getRatingLabel =
        function (
            rating
        ) {

            rating =
                Number(
                    rating ||
                    0
                );


            switch (
                rating
            ) {

                case 5:

                    return "Excellent";

                case 4:

                    return "Very good";

                case 3:

                    return "Good";

                case 2:

                    return "Needs improvement";

                case 1:

                    return "Poor";

                default:

                    return "Rate your trip";
            }
        };


    /* ========================================================
       STARS AS TEXT
       ======================================================== */

    Rating.starsText =
        function (
            rating
        ) {

            rating =
                Rating.normalize(
                    rating
                );


            return (
                "★".repeat(
                    rating
                ) +
                "☆".repeat(
                    Rating.config.maxRating -
                    rating
                )
            );
        };


    /* ========================================================
       LOCAL STORAGE
       ======================================================== */

    Rating.loadLocal =
        function () {

            try {

                const data =
                    JSON.parse(
                        localStorage.getItem(
                            Rating.config.storageKey
                        ) ||
                        "[]"
                    );


                if (
                    Array.isArray(
                        data
                    )
                ) {

                    Rating.state.ratings =
                        data;
                }

            } catch (error) {

                Rating.state.ratings =
                    [];
            }


            return Rating.state.ratings;
        };


    Rating.saveLocal =
        function () {

            try {

                localStorage.setItem(
                    Rating.config.storageKey,
                    JSON.stringify(
                        Rating.state.ratings
                    )
                );


                return true;

            } catch (error) {

                return false;
            }
        };


    /* ========================================================
       CHECK EXISTING RATING
       ======================================================== */

    Rating.hasRated =
        async function (
            rideId
        ) {

            if (
                !rideId
            ) {

                return false;
            }


            const userId =
                Rating.getUserId();


            if (
                !userId
            ) {

                return false;
            }


            /*
             * Local check.
             */

            const local =
                Rating.state.ratings
                    .some(
                        function (
                            item
                        ) {

                            return (
                                item.rideId ===
                                rideId &&
                                item.raterId ===
                                userId
                            );
                        }
                    );


            if (
                local
            ) {

                return true;
            }


            /*
             * Firebase check.
             */

            const database =
                Rating.getDatabase();


            if (
                database
            ) {

                try {

                    const snapshot =
                        await database
                            .ref(
                                Rating.config
                                    .ratingCollection
                            )
                            .orderByChild(
                                "rideId"
                            )
                            .equalTo(
                                rideId
                            )
                            .once(
                                "value"
                            );


                    let exists =
                        false;


                    snapshot.forEach(
                        function (
                            child
                        ) {

                            const value =
                                child.val();


                            if (
                                value &&
                                value.raterId ===
                                userId
                            ) {

                                exists =
                                    true;
                            }
                        }
                    );


                    return exists;

                } catch (error) {

                    console.warn(
                        "Rating check failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ========================================================
       CREATE RATING
       ======================================================== */

    Rating.create =
        async function (
            data
        ) {

            data =
                data ||
                {};


            const raterId =
                Rating.getUserId();


            if (
                !raterId
            ) {

                throw new Error(
                    "Please login before rating."
                );
            }


            const rating =
                Rating.normalize(
                    data.rating ||
                    Rating.getRating()
                );


            if (
                rating <
                Rating.config.minRating
            ) {

                throw new Error(
                    "Please select a rating."
                );
            }


            const rideId =
                data.rideId ||
                Rating.state.currentRideId;


            const targetId =
                data.targetId ||
                Rating.state.currentTargetId;


            if (
                !targetId
            ) {

                throw new Error(
                    "Rating recipient not found."
                );
            }


            const targetRole =
                data.targetRole ||
                Rating.state.currentTargetRole ||
                (
                    Rating.getUserRole() ===
                    "customer"
                        ? "rider"
                        : "customer"
                );


            const review =
                Rating.cleanReview(
                    data.review ||
                    data.comment ||
                    ""
                );


            /*
             * Prevent duplicate ride rating.
             */

            if (
                rideId &&
                await Rating.hasRated(
                    rideId
                )
            ) {

                throw new Error(
                    "You have already rated this ride."
                );
            }


            const ratingId =
                Rating.createId();


            const ratingData =
                {

                    id:
                        ratingId,

                    rideId:
                        rideId ||
                        null,

                    tripId:
                        data.tripId ||
                        rideId ||
                        null,

                    raterId:
                        raterId,

                    raterRole:
                        Rating.getUserRole(),

                    targetId:
                        targetId,

                    targetRole:
                        targetRole,

                    rating:
                        rating,

                    review:
                        review,

                    tags:
                        Array.isArray(
                            data.tags
                        )
                            ? data.tags
                            : [],

                    createdAt:
                        Date.now(),

                    updatedAt:
                        Date.now()
                };


            Rating.state.saving =
                true;


            try {

                /*
                 * Save locally first.
                 */

                Rating.state.ratings
                    .push(
                        ratingData
                    );


                Rating.saveLocal();


                /*
                 * Save to Firebase.
                 */

                const saved =
                    await Rating.saveRemote(
                        ratingData
                    );


                /*
                 * Update aggregate.
                 */

                await Rating.updateAggregate(
                    targetId,
                    targetRole,
                    rating
                );


                /*
                 * Update ride record.
                 */

                if (
                    rideId
                ) {

                    await Rating.markRideRated(
                        rideId,
                        ratingData
                    );
                }


                Rating.emit(
                    "submitted",
                    {

                        rating:
                            ratingData,

                        remote:
                            saved
                    }
                );


                Rating.showSuccess(
                    "Thanks! Your rating has been submitted."
                );


                return ratingData;

            } finally {

                Rating.state.saving =
                    false;
            }
        };


    /* ========================================================
       SAVE REMOTE
       ======================================================== */

    Rating.saveRemote =
        async function (
            ratingData
        ) {

            const database =
                Rating.getDatabase();


            if (
                database
            ) {

                try {

                    await database
                        .ref(
                            Rating.config
                                .ratingCollection +
                            "/" +
                            ratingData.id
                        )
                        .set(
                            ratingData
                        );


                    return true;

                } catch (error) {

                    console.warn(
                        "Realtime rating save failed:",
                        error
                    );
                }
            }


            const firestore =
                Rating.getFirestore();


            if (
                firestore
            ) {

                try {

                    await firestore
                        .collection(
                            Rating.config
                                .ratingCollection
                        )
                        .doc(
                            ratingData.id
                        )
                        .set(
                            ratingData
                        );


                    return true;

                } catch (error) {

                    console.warn(
                        "Firestore rating save failed:",
                        error
                    );
                }
            }


            return false;
        };


    /* ========================================================
       UPDATE AGGREGATE RATING
       ======================================================== */

    Rating.updateAggregate =
        async function (
            targetId,
            targetRole,
            newRating
        ) {

            if (
                !targetId
            ) {

                return false;
            }


            const database =
                Rating.getDatabase();


            if (
                !database
            ) {

                return false;
            }


            const collection =
                targetRole ===
                "rider"
                    ? "riders"
                    : "customers";


            const ref =
                database.ref(
                    collection +
                    "/" +
                    targetId
                );


            try {

                const snapshot =
                    await ref.once(
                        "value"
                    );


                const profile =
                    snapshot.val() ||
                    {};


                const oldCount =
                    Number(
                        profile.totalRatings ||
                        0
                    );


                const oldRating =
                    Number(
                        profile.rating ||
                        0
                    );


                const newCount =
                    oldCount +
                    1;


                const total =
                    (
                        oldRating *
                        oldCount
                    ) +
                    newRating;


                const average =
                    Math.round(
                        (
                            total /
                            newCount
                        ) *
                        10
                    ) /
                    10;


                await ref.update(
                    {

                        rating:
                            average,

                        totalRatings:
                            newCount,

                        updatedAt:
                            Date.now()
                    }
                );


                return true;

            } catch (error) {

                console.warn(
                    "Rating aggregate update failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       MARK RIDE RATED
       ======================================================== */

    Rating.markRideRated =
        async function (
            rideId,
            ratingData
        ) {

            const database =
                Rating.getDatabase();


            if (
                !database ||
                !rideId
            ) {

                return false;
            }


            try {

                await database
                    .ref(
                        "rides/" +
                        rideId
                    )
                    .update(
                        {

                            rated:
                                true,

                            rating:
                                ratingData.rating,

                            ratingId:
                                ratingData.id,

                            ratedAt:
                                Date.now()
                        }
                    );


                return true;

            } catch (error) {

                console.warn(
                    "Ride rating update failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       LOAD RATINGS FOR USER
       ======================================================== */

    Rating.loadForUser =
        async function (
            userId,
            limit
        ) {

            userId =
                userId ||
                Rating.getUserId();


            if (
                !userId
            ) {

                return [];
            }


            limit =
                Number(
                    limit ||
                    20
                );


            Rating.state.loading =
                true;


            try {

                const database =
                    Rating.getDatabase();


                if (
                    database
                ) {

                    try {

                        const snapshot =
                            await database
                                .ref(
                                    Rating.config
                                        .ratingCollection
                                )
                                .orderByChild(
                                    "targetId"
                                )
                                .equalTo(
                                    userId
                                )
                                .once(
                                    "value"
                                );


                        const results =
                            [];


                        snapshot.forEach(
                            function (
                                child
                            ) {

                                const item =
                                    child.val();


                                if (
                                    item
                                ) {

                                    results.push(
                                        item
                                    );
                                }
                            }
                        );


                        results.sort(
                            function (
                                a,
                                b
                            ) {

                                return (
                                    Number(
                                        b.createdAt ||
                                        0
                                    ) -
                                    Number(
                                        a.createdAt ||
                                        0
                                    )
                                );
                            }
                        );


                        Rating.state.ratings =
                            results.slice(
                                0,
                                limit
                            );


                        Rating.saveLocal();


                        Rating.renderList(
                            Rating.state.ratings
                        );


                        return Rating.state.ratings;

                    } catch (error) {

                        console.warn(
                            "Remote ratings load failed:",
                            error
                        );
                    }
                }


                return Rating.state.ratings
                    .filter(
                        function (
                            item
                        ) {

                            return (
                                item.targetId ===
                                userId
                            );
                        }
                    )
                    .slice(
                        0,
                        limit
                    );

            } finally {

                Rating.state.loading =
                    false;
            }
        };


    /* ========================================================
       RATING LIST
       ======================================================== */

    Rating.renderList =
        function (
            ratings
        ) {

            ratings =
                Array.isArray(
                    ratings
                )
                    ? ratings
                    : [];


            const containers =
                document.querySelectorAll(
                    "[data-rating-list]"
                );


            containers.forEach(
                function (
                    container
                ) {

                    container.innerHTML =
                        "";


                    if (
                        ratings.length ===
                        0
                    ) {

                        const empty =
                            document.createElement(
                                "div"
                            );


                        empty.className =
                            "rating-empty";


                        empty.textContent =
                            "No ratings yet.";


                        container.appendChild(
                            empty
                        );


                        return;
                    }


                    ratings.forEach(
                        function (
                            item
                        ) {

                            const row =
                                document.createElement(
                                    "div"
                                );


                            row.className =
                                "rating-item";


                            row.dataset
                                .ratingId =
                                item.id ||
                                "";


                            const stars =
                                document.createElement(
                                    "div"
                                );


                            stars.className =
                                "rating-item-stars";


                            stars.textContent =
                                Rating.starsText(
                                    item.rating
                                );


                            const review =
                                document.createElement(
                                    "div"
                                );


                            review.className =
                                "rating-item-review";


                            review.textContent =
                                item.review ||
                                "";


                            const date =
                                document.createElement(
                                    "div"
                                );


                            date.className =
                                "rating-item-date";


                            date.textContent =
                                Rating.formatDate(
                                    item.createdAt
                                );


                            row.appendChild(
                                stars
                            );


                            if (
                                item.review
                            ) {

                                row.appendChild(
                                    review
                                );
                            }


                            row.appendChild(
                                date
                            );


                            container.appendChild(
                                row
                            );
                        }
                    );
                }
            );
        };


    /* ========================================================
       AVERAGE
       ======================================================== */

    Rating.calculateAverage =
        function (
            ratings
        ) {

            if (
                !Array.isArray(
                    ratings
                ) ||
                ratings.length ===
                0
            ) {

                return 0;
            }


            let total =
                0;


            ratings.forEach(
                function (
                    item
                ) {

                    total +=
                        Number(
                            item.rating ||
                            0
                        );
                }
            );


            return Math.round(
                (
                    total /
                    ratings.length
                ) *
                10
            ) /
            10;
        };


    /* ========================================================
       RENDER AVERAGE
       ======================================================== */

    Rating.renderAverage =
        function (
            rating,
            count
        ) {

            rating =
                Number(
                    rating ||
                    0
                );


            count =
                Number(
                    count ||
                    0
                );


            document
                .querySelectorAll(
                    "[data-average-rating]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            rating.toFixed(
                                1
                            );
                    }
                );


            document
                .querySelectorAll(
                    "[data-rating-count]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            count;
                    }
                );


            document
                .querySelectorAll(
                    "[data-average-stars]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            Rating.starsText(
                                Math.round(
                                    rating
                                )
                            );
                    }
                );
        };


    /* ========================================================
       QUICK RATING
       ======================================================== */

    Rating.quickRate =
        async function (
            rating
        ) {

            Rating.setRating(
                rating
            );


            return Rating.submit();
        };


    /* ========================================================
       SUBMIT CURRENT FORM
       ======================================================== */

    Rating.submit =
        async function () {

            const form =
                document.querySelector(
                    "[data-rating-form]"
                );


            let review =
                "";


            if (
                form
            ) {

                const input =
                    form.querySelector(
                        "[name='review'], [name='comment'], textarea"
                    );


                if (
                    input
                ) {

                    review =
                        input.value;
                }
            }


            return Rating.create(
                {

                    rideId:
                        Rating.state.currentRideId,

                    targetId:
                        Rating.state.currentTargetId,

                    targetRole:
                        Rating.state.currentTargetRole,

                    rating:
                        Rating.getRating(),

                    review:
                        review
                }
            );
        };


    /* ========================================================
       FORM
       ======================================================== */

    Rating.bindForm =
        function () {

            document.addEventListener(
                "submit",
                async function (
                    event
                ) {

                    const form =
                        event.target.closest(
                            "[data-rating-form]"
                        );


                    if (
                        !form
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const rideInput =
                        form.querySelector(
                            "[name='rideId']"
                        );


                    const targetInput =
                        form.querySelector(
                            "[name='targetId']"
                        );


                    const roleInput =
                        form.querySelector(
                            "[name='targetRole']"
                        );


                    const reviewInput =
                        form.querySelector(
                            "[name='review'], [name='comment'], textarea"
                        );


                    if (
                        rideInput &&
                        rideInput.value
                    ) {

                        Rating.state.currentRideId =
                            rideInput.value;
                    }


                    if (
                        targetInput &&
                        targetInput.value
                    ) {

                        Rating.state.currentTargetId =
                            targetInput.value;
                    }


                    if (
                        roleInput &&
                        roleInput.value
                    ) {

                        Rating.state.currentTargetRole =
                            roleInput.value;
                    }


                    try {

                        await Rating.create(
                            {

                                rideId:
                                    Rating.state
                                        .currentRideId,

                                targetId:
                                    Rating.state
                                        .currentTargetId,

                                targetRole:
                                    Rating.state
                                        .currentTargetRole,

                                rating:
                                    Rating.getRating(),

                                review:
                                    reviewInput
                                        ?.value ||
                                    ""
                            }
                        );


                        form.reset();


                        Rating.setRating(
                            0
                        );


                        Rating.showSuccess(
                            "Thank you for rating your trip."
                        );


                    } catch (error) {

                        Rating.showError(
                            error.message ||
                            "Unable to submit rating."
                        );
                    }
                }
            );
        };


    /* ========================================================
       STAR CLICK EVENTS
       ======================================================== */

    Rating.bindStars =
        function () {

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const star =
                        event.target.closest(
                            "[data-rating-star]"
                        );


                    if (
                        !star
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const value =
                        Number(
                            star.dataset
                                .ratingStar
                        );


                    Rating.setRating(
                        value
                    );
                }
            );


            /*
             * Hover preview.
             */

            document.addEventListener(
                "mouseover",
                function (
                    event
                ) {

                    const star =
                        event.target.closest(
                            "[data-rating-star]"
                        );


                    if (
                        !star
                    ) {

                        return;
                    }


                    const value =
                        Number(
                            star.dataset
                                .ratingStar
                        );


                    Rating.renderStars(
                        value
                    );
                }
            );


            document.addEventListener(
                "mouseout",
                function (
                    event
                ) {

                    const star =
                        event.target.closest(
                            "[data-rating-star]"
                        );


                    if (
                        !star
                    ) {

                        return;
                    }


                    Rating.renderStars(
                        Rating.getRating()
                    );
                }
            );
        };


    /* ========================================================
       DATE FORMAT
       ======================================================== */

    Rating.formatDate =
        function (
            timestamp
        ) {

            if (
                !timestamp
            ) {

                return "";
            }


            try {

                return new Intl.DateTimeFormat(
                    "en-IN",
                    {

                        day:
                            "numeric",

                        month:
                            "short",

                        year:
                            "numeric"
                    }
                )
                .format(
                    new Date(
                        timestamp
                    )
                );

            } catch (error) {

                return "";
            }
        };


    /* ========================================================
       ID
       ======================================================== */

    Rating.createId =
        function () {

            return (
                "rating_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(
                        36
                    )
                    .slice(
                        2,
                        9
                    )
            );
        };


    /* ========================================================
       UI MESSAGE
       ======================================================== */

    Rating.showSuccess =
        function (
            message
        ) {

            Rating.showMessage(
                message,
                "success"
            );
        };


    Rating.showError =
        function (
            message
        ) {

            Rating.showMessage(
                message,
                "error"
            );
        };


    Rating.showMessage =
        function (
            message,
            type
        ) {

            const target =
                document.querySelector(
                    "[data-rating-message]"
                );


            if (
                target
            ) {

                target.textContent =
                    message;


                target.dataset.type =
                    type ||
                    "info";


                target.classList.add(
                    "show"
                );


                setTimeout(
                    function () {

                        target.classList.remove(
                            "show"
                        );

                    },
                    3500
                );


                return;
            }


            if (
                type ===
                "error"
            ) {

                console.error(
                    "RiderX Rating:",
                    message
                );

            } else {

                console.log(
                    "RiderX Rating:",
                    message
                );
            }
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Rating.emit =
        function (
            name,
            detail
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-rating-" +
                    name,
                    {

                        detail:
                            detail ||
                            {}
                    }
                )
            );
        };


    /* ========================================================
       INIT
       ======================================================== */

    Rating.init =
        function () {

            if (
                Rating.state.initialized
            ) {

                return;
            }


            Rating.state.initialized =
                true;


            Rating.loadLocal();

            Rating.bindStars();

            Rating.bindForm();

            Rating.renderStars(
                0
            );


            /*
             * Support URL parameters:
             *
             * ?rideId=...
             * &riderId=...
             * &customerId=...
             */

            try {

                const params =
                    new URLSearchParams(
                        window.location.search
                    );


                const rideId =
                    params.get(
                        "rideId"
                    );


                const riderId =
                    params.get(
                        "riderId"
                    );


                const customerId =
                    params.get(
                        "customerId"
                    );


                if (
                    rideId ||
                    riderId ||
                    customerId
                ) {

                    const role =
                        Rating.getUserRole();


                    Rating.setContext(
                        {

                            rideId:
                                rideId,

                            targetId:
                                riderId ||
                                customerId,

                            targetRole:
                                riderId
                                    ? "rider"
                                    : "customer"
                        }
                    );
                }

            } catch (error) {}


            console.log(
                "RiderX rating.js loaded."
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.ratingController =
        Rating;


    RX.setRating =
        Rating.setRating;


    RX.getRating =
        Rating.getRating;


    RX.submitRating =
        Rating.submit;


    RX.createRating =
        Rating.create;


    RX.loadRatings =
        Rating.loadForUser;


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Rating.init
        );

    } else {

        Rating.init();

    }

})();

/* ============================================================
   RIDERX - SETTINGS CONTROLLER
   File: js/settings.js

   Handles:
   - App settings
   - Dark / light mode
   - Language preference
   - Push notification preference
   - Ride notification preference
   - Sound / vibration preference
   - Location preference
   - Privacy settings
   - Account settings
   - Settings persistence
   ============================================================ */

(function () {

    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    const Settings =
        RX.settings ||
        (RX.settings = {});


    /* ========================================================
       CONFIG
       ======================================================== */

    Settings.config = {

        storageKey:
            "riderx_settings",

        defaultLanguage:
            "en",

        defaultTheme:
            "dark",

        defaults:
            {

                theme:
                    "dark",

                language:
                    "en",

                notifications:
                    true,

                rideNotifications:
                    true,

                promotionalNotifications:
                    true,

                sound:
                    true,

                vibration:
                    true,

                location:
                    true,

                liveLocation:
                    true,

                autoRefresh:
                    true,

                dataSaver:
                    false,

                showOnlineStatus:
                    true,

                shareTripLocation:
                    true,

                marketing:
                    false
            }
    };


    /* ========================================================
       STATE
       ======================================================== */

    Settings.state = {

        initialized:
            false,

        values:
            {},

        loading:
            false,

        saving:
            false
    };


    /* ========================================================
       LOAD SETTINGS
       ======================================================== */

    Settings.load =
        function () {

            let saved =
                {};


            try {

                saved =
                    JSON.parse(
                        localStorage.getItem(
                            Settings.config.storageKey
                        ) ||
                        "{}"
                    ) ||
                    {};

            } catch (error) {

                saved =
                    {};
            }


            Settings.state.values =
                {

                    ...Settings.config.defaults,

                    ...saved
                };


            return Settings.state.values;
        };


    /* ========================================================
       SAVE SETTINGS
       ======================================================== */

    Settings.save =
        function () {

            try {

                localStorage.setItem(
                    Settings.config.storageKey,
                    JSON.stringify(
                        Settings.state.values
                    )
                );

                return true;

            } catch (error) {

                console.error(
                    "RiderX settings save failed:",
                    error
                );

                return false;
            }
        };


    /* ========================================================
       GET
       ======================================================== */

    Settings.get =
        function (
            key
        ) {

            if (
                !key
            ) {

                return {
                    ...Settings.state.values
                };
            }


            return Settings.state.values[
                key
            ];
        };


    /* ========================================================
       SET
       ======================================================== */

    Settings.set =
        function (
            key,
            value,
            options
        ) {

            if (
                !key
            ) {

                return false;
            }


            const oldValue =
                Settings.state.values[
                    key
                ];


            Settings.state.values[
                key
            ] =
                value;


            Settings.save();


            Settings.apply(
                key,
                value
            );


            Settings.render(
                key
            );


            Settings.emit(
                "changed",
                {

                    key:
                        key,

                    value:
                        value,

                    oldValue:
                        oldValue
                }
            );


            if (
                !options ||
                options.sync !== false
            ) {

                Settings.sync(
                    key,
                    value
                );
            }


            return true;
        };


    /* ========================================================
       UPDATE MULTIPLE
       ======================================================== */

    Settings.update =
        function (
            values,
            options
        ) {

            if (
                !values ||
                typeof values !==
                "object"
            ) {

                return false;
            }


            const changes =
                {};


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

                    const oldValue =
                        Settings.state.values[
                            key
                        ];


                    Settings.state.values[
                        key
                    ] =
                        value;


                    changes[key] =
                        {

                            value:
                                value,

                            oldValue:
                                oldValue
                        };


                    Settings.apply(
                        key,
                        value
                    );
                }
            );


            Settings.save();


            Settings.render();


            if (
                !options ||
                options.sync !== false
            ) {

                Settings.syncAll();
            }


            Settings.emit(
                "updated",
                {

                    values:
                        values,

                    changes:
                        changes
                }
            );


            return true;
        };


    /* ========================================================
       RESET
       ======================================================== */

    Settings.reset =
        function () {

            Settings.state.values =
                {

                    ...Settings.config.defaults
                };


            Settings.save();

            Settings.applyAll();

            Settings.render();

            Settings.syncAll();


            Settings.emit(
                "reset",
                {

                    values:
                        Settings.get()
                }
            );


            return Settings.get();
        };


    /* ========================================================
       APPLY SETTINGS
       ======================================================== */

    Settings.apply =
        function (
            key,
            value
        ) {

            switch (
                key
            ) {

                case "theme":

                    Settings.applyTheme(
                        value
                    );

                    break;


                case "language":

                    Settings.applyLanguage(
                        value
                    );

                    break;


                case "notifications":

                    Settings.applyNotifications(
                        value
                    );

                    break;


                case "sound":

                    Settings.applySound(
                        value
                    );

                    break;


                case "vibration":

                    Settings.applyVibration(
                        value
                    );

                    break;


                case "location":

                    Settings.applyLocation(
                        value
                    );

                    break;


                case "liveLocation":

                    Settings.applyLiveLocation(
                        value
                    );

                    break;


                default:

                    break;
            }
        };


    Settings.applyAll =
        function () {

            const values =
                Settings.state.values;


            Settings.applyTheme(
                values.theme
            );


            Settings.applyLanguage(
                values.language
            );


            Settings.applyNotifications(
                values.notifications
            );


            Settings.applySound(
                values.sound
            );


            Settings.applyVibration(
                values.vibration
            );


            Settings.applyLocation(
                values.location
            );


            Settings.applyLiveLocation(
                values.liveLocation
            );
        };


    /* ========================================================
       THEME
       ======================================================== */

    Settings.applyTheme =
        function (
            theme
        ) {

            theme =
                String(
                    theme ||
                    "dark"
                ).toLowerCase();


            if (
                ![
                    "dark",
                    "light",
                    "system"
                ].includes(
                    theme
                )
            ) {

                theme =
                    "dark";
            }


            const root =
                document.documentElement;


            if (
                theme ===
                "system"
            ) {

                root.dataset.theme =
                    window.matchMedia &&
                    window.matchMedia(
                        "(prefers-color-scheme: light)"
                    ).matches
                        ? "light"
                        : "dark";

            } else {

                root.dataset.theme =
                    theme;
            }


            root.dataset.riderxTheme =
                theme;


            document.body?.classList.toggle(
                "dark-mode",
                root.dataset.theme ===
                "dark"
            );


            document.body?.classList.toggle(
                "light-mode",
                root.dataset.theme ===
                "light"
            );


            document
                .querySelectorAll(
                    "[data-theme-value]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            theme;
                    }
                );
        };


    Settings.toggleTheme =
        function () {

            const current =
                Settings.state.values
                    .theme;


            const next =
                current ===
                "dark"
                    ? "light"
                    : "dark";


            return Settings.set(
                "theme",
                next
            );
        };


    /* ========================================================
       LANGUAGE
       ======================================================== */

    Settings.applyLanguage =
        function (
            language
        ) {

            language =
                String(
                    language ||
                    Settings.config
                        .defaultLanguage
                )
                .toLowerCase();


            document.documentElement
                .setAttribute(
                    "lang",
                    language
                );


            document.documentElement
                .dataset.language =
                language;


            document
                .querySelectorAll(
                    "[data-current-language]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            language
                                .toUpperCase();
                    }
                );


            /*
             * Existing RiderX language module.
             */

            try {

                if (
                    RX.language &&
                    typeof RX.language
                        .setLanguage ===
                    "function"
                ) {

                    RX.language.setLanguage(
                        language
                    );
                }

            } catch (error) {}


            try {

                if (
                    RX.setLanguage &&
                    typeof RX.setLanguage ===
                    "function"
                ) {

                    RX.setLanguage(
                        language
                    );
                }

            } catch (error) {}
        };


    Settings.setLanguage =
        function (
            language
        ) {

            if (
                !language
            ) {

                return false;
            }


            return Settings.set(
                "language",
                String(
                    language
                ).toLowerCase()
            );
        };


    /* ========================================================
       NOTIFICATIONS
       ======================================================== */

    Settings.applyNotifications =
        function (
            enabled
        ) {

            enabled =
                Boolean(
                    enabled
                );


            document
                .querySelectorAll(
                    "[data-notification-status]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            enabled
                                ? "Enabled"
                                : "Disabled";
                    }
                );


            document
                .querySelectorAll(
                    "[data-notification-toggle]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            element.type ===
                            "checkbox"
                        ) {

                            element.checked =
                                enabled;
                        }
                    }
                );


            try {

                if (
                    RX.notification &&
                    typeof RX.notification
                        .setEnabled ===
                    "function"
                ) {

                    RX.notification.setEnabled(
                        enabled
                    );
                }

            } catch (error) {}
        };


    Settings.toggleNotifications =
        function () {

            return Settings.set(
                "notifications",
                !Settings.get(
                    "notifications"
                )
            );
        };


    /* ========================================================
       SOUND
       ======================================================== */

    Settings.applySound =
        function (
            enabled
        ) {

            enabled =
                Boolean(
                    enabled
                );


            document
                .querySelectorAll(
                    "[data-sound-toggle]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            element.type ===
                            "checkbox"
                        ) {

                            element.checked =
                                enabled;
                        }
                    }
                );
        };


    Settings.toggleSound =
        function () {

            return Settings.set(
                "sound",
                !Settings.get(
                    "sound"
                )
            );
        };


    /* ========================================================
       VIBRATION
       ======================================================== */

    Settings.applyVibration =
        function (
            enabled
        ) {

            enabled =
                Boolean(
                    enabled
                );


            document
                .querySelectorAll(
                    "[data-vibration-toggle]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            element.type ===
                            "checkbox"
                        ) {

                            element.checked =
                                enabled;
                        }
                    }
                );
        };


    Settings.vibrate =
        function (
            pattern
        ) {

            if (
                !Settings.get(
                    "vibration"
                )
            ) {

                return false;
            }


            if (
                !navigator.vibrate
            ) {

                return false;
            }


            try {

                navigator.vibrate(
                    pattern ||
                    120
                );

                return true;

            } catch (error) {

                return false;
            }
        };


    /* ========================================================
       LOCATION
       ======================================================== */

    Settings.applyLocation =
        function (
            enabled
        ) {

            enabled =
                Boolean(
                    enabled
                );


            document
                .querySelectorAll(
                    "[data-location-toggle]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            element.type ===
                            "checkbox"
                        ) {

                            element.checked =
                                enabled;
                        }
                    }
                );
        };


    Settings.applyLiveLocation =
        function (
            enabled
        ) {

            enabled =
                Boolean(
                    enabled
                );


            document
                .querySelectorAll(
                    "[data-live-location-toggle]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        if (
                            element.type ===
                            "checkbox"
                        ) {

                            element.checked =
                                enabled;
                        }
                    }
                );
        };


    /* ========================================================
       RENDER
       ======================================================== */

    Settings.render =
        function (
            key
        ) {

            const values =
                Settings.state.values;


            document
                .querySelectorAll(
                    "[data-setting]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        const setting =
                            element.dataset
                                .setting;


                        if (
                            !setting
                        ) {

                            return;
                        }


                        const value =
                            values[
                                setting
                            ];


                        if (
                            element.type ===
                            "checkbox"
                        ) {

                            element.checked =
                                Boolean(
                                    value
                                );

                            return;
                        }


                        if (
                            element.type ===
                            "radio"
                        ) {

                            element.checked =
                                element.value ===
                                String(
                                    value
                                );

                            return;
                        }


                        if (
                            element.tagName ===
                            "SELECT"
                        ) {

                            element.value =
                                String(
                                    value
                                );

                            return;
                        }


                        element.textContent =
                            value;
                    }
                );


            /*
             * Theme radio buttons.
             */

            document
                .querySelectorAll(
                    "[data-theme-option]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element
                            .classList
                            .toggle(
                                "active",
                                element.dataset
                                    .themeOption ===
                                values.theme
                            );
                    }
                );


            /*
             * Language options.
             */

            document
                .querySelectorAll(
                    "[data-language-option]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element
                            .classList
                            .toggle(
                                "active",
                                element.dataset
                                    .languageOption ===
                                values.language
                            );
                    }
                );
        };


    /* ========================================================
       SYNC CURRENT USER SETTINGS TO FIREBASE
       ======================================================== */

    Settings.getDatabase =
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


    Settings.getUserId =
        function () {

            try {

                if (
                    window.firebase &&
                    firebase.auth
                ) {

                    const user =
                        firebase.auth()
                            .currentUser;


                    if (
                        user
                    ) {

                        return user.uid;
                    }
                }

            } catch (error) {}


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


    Settings.getUserRole =
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


            if (
                RX.riderController &&
                RX.riderController.getRiderId &&
                RX.riderController.getRiderId()
            ) {

                return "rider";
            }


            return "customer";
        };


    Settings.sync =
        async function (
            key,
            value
        ) {

            const userId =
                Settings.getUserId();


            const database =
                Settings.getDatabase();


            if (
                !userId ||
                !database
            ) {

                return false;
            }


            Settings.state.saving =
                true;


            try {

                const role =
                    Settings.getUserRole();


                const path =
                    role ===
                    "rider"
                        ? "riders/"
                        : "customers/";


                await database
                    .ref(
                        path +
                        userId +
                        "/settings/" +
                        key
                    )
                    .set(
                        value
                    );


                Settings.emit(
                    "synced",
                    {

                        key:
                            key,

                        value:
                            value
                    }
                );


                return true;

            } catch (error) {

                console.warn(
                    "Settings sync failed:",
                    error
                );


                return false;

            } finally {

                Settings.state.saving =
                    false;
            }
        };


    Settings.syncAll =
        async function () {

            const userId =
                Settings.getUserId();


            const database =
                Settings.getDatabase();


            if (
                !userId ||
                !database
            ) {

                return false;
            }


            Settings.state.saving =
                true;


            try {

                const role =
                    Settings.getUserRole();


                const path =
                    role ===
                    "rider"
                        ? "riders/"
                        : "customers/";


                await database
                    .ref(
                        path +
                        userId +
                        "/settings"
                    )
                    .update(
                        Settings.state.values
                    );


                return true;

            } catch (error) {

                console.warn(
                    "Settings sync all failed:",
                    error
                );


                return false;

            } finally {

                Settings.state.saving =
                    false;
            }
        };


    /* ========================================================
       LOAD FROM FIREBASE
       ======================================================== */

    Settings.loadFromFirebase =
        async function () {

            const userId =
                Settings.getUserId();


            const database =
                Settings.getDatabase();


            if (
                !userId ||
                !database
            ) {

                return Settings.get();
            }


            try {

                const role =
                    Settings.getUserRole();


                const path =
                    role ===
                    "rider"
                        ? "riders/"
                        : "customers/";


                const snapshot =
                    await database
                        .ref(
                            path +
                            userId +
                            "/settings"
                        )
                        .once(
                            "value"
                        );


                const remote =
                    snapshot.val();


                if (
                    remote &&
                    typeof remote ===
                    "object"
                ) {

                    Settings.state.values =
                        {

                            ...Settings.state.values,

                            ...remote
                        };


                    Settings.save();

                    Settings.applyAll();

                    Settings.render();
                }


                return Settings.get();

            } catch (error) {

                console.warn(
                    "Remote settings load failed:",
                    error
                );


                return Settings.get();
            }
        };


    /* ========================================================
       PERMISSIONS
       ======================================================== */

    Settings.requestNotificationPermission =
        async function () {

            if (
                !("Notification" in window)
            ) {

                return "unsupported";
            }


            try {

                const permission =
                    await Notification
                        .requestPermission();


                if (
                    permission ===
                    "granted"
                ) {

                    Settings.set(
                        "notifications",
                        true,
                        {
                            sync:
                                true
                        }
                    );

                }


                return permission;

            } catch (error) {

                return "denied";
            }
        };


    Settings.getLocationPermission =
        async function () {

            if (
                !navigator.permissions
            ) {

                return "unknown";
            }


            try {

                const permission =
                    await navigator
                        .permissions
                        .query(
                            {

                                name:
                                    "geolocation"
                            }
                        );


                return permission.state;

            } catch (error) {

                return "unknown";
            }
        };


    /* ========================================================
       DATA SAVER
       ======================================================== */

    Settings.isDataSaver =
        function () {

            return Boolean(
                Settings.get(
                    "dataSaver"
                )
            );
        };


    Settings.toggleDataSaver =
        function () {

            return Settings.set(
                "dataSaver",
                !Settings.get(
                    "dataSaver"
                )
            );
        };


    /* ========================================================
       ACCOUNT DELETE REQUEST
       ======================================================== */

    Settings.requestAccountDeletion =
        async function (
            reason
        ) {

            const userId =
                Settings.getUserId();


            if (
                !userId
            ) {

                return false;
            }


            const database =
                Settings.getDatabase();


            if (
                !database
            ) {

                return false;
            }


            try {

                await database
                    .ref(
                        "accountDeletionRequests/" +
                        userId
                    )
                    .set(
                        {

                            userId:
                                userId,

                            role:
                                Settings
                                    .getUserRole(),

                            reason:
                                reason ||
                                "",

                            status:
                                "pending",

                            requestedAt:
                                Date.now()
                        }
                    );


                Settings.emit(
                    "account-deletion-requested"
                );


                return true;

            } catch (error) {

                console.error(
                    "Account deletion request failed:",
                    error
                );


                return false;
            }
        };


    /* ========================================================
       CLEAR LOCAL DATA
       ======================================================== */

    Settings.clearLocal =
        function () {

            try {

                localStorage.removeItem(
                    Settings.config.storageKey
                );

            } catch (error) {}


            Settings.load();

            Settings.applyAll();

            Settings.render();
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    Settings.emit =
        function (
            name,
            detail
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-settings-" +
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
       BIND EVENTS
       ======================================================== */

    Settings.bindEvents =
        function () {

            /*
             * Generic settings controls.
             */

            document.addEventListener(
                "change",
                function (
                    event
                ) {

                    const element =
                        event.target.closest(
                            "[data-setting]"
                        );


                    if (
                        !element
                    ) {

                        return;
                    }


                    const key =
                        element.dataset
                            .setting;


                    let value =
                        element.value;


                    if (
                        element.type ===
                        "checkbox"
                    ) {

                        value =
                            element.checked;
                    }


                    if (
                        element.type ===
                        "number"
                    ) {

                        value =
                            Number(
                                value
                            );
                    }


                    Settings.set(
                        key,
                        value
                    );
                }
            );


            /*
             * Theme buttons.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const element =
                        event.target.closest(
                            "[data-theme-option]"
                        );


                    if (
                        !element
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const theme =
                        element.dataset
                            .themeOption;


                    if (
                        theme
                    ) {

                        Settings.set(
                            "theme",
                            theme
                        );
                    }
                }
            );


            /*
             * Language buttons.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const element =
                        event.target.closest(
                            "[data-language-option]"
                        );


                    if (
                        !element
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const language =
                        element.dataset
                            .languageOption;


                    if (
                        language
                    ) {

                        Settings.setLanguage(
                            language
                        );
                    }
                }
            );


            /*
             * Dark mode shortcut.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const element =
                        event.target.closest(
                            "[data-toggle-theme]"
                        );


                    if (
                        element
                    ) {

                        event.preventDefault();

                        Settings.toggleTheme();
                    }
                }
            );


            /*
             * Notification shortcut.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const element =
                        event.target.closest(
                            "[data-toggle-notifications]"
                        );


                    if (
                        element
                    ) {

                        event.preventDefault();

                        Settings
                            .toggleNotifications();
                    }
                }
            );


            /*
             * Sound shortcut.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const element =
                        event.target.closest(
                            "[data-toggle-sound]"
                        );


                    if (
                        element
                    ) {

                        event.preventDefault();

                        Settings.toggleSound();
                    }
                }
            );


            /*
             * Data saver.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const element =
                        event.target.closest(
                            "[data-toggle-data-saver]"
                        );


                    if (
                        element
                    ) {

                        event.preventDefault();

                        Settings
                            .toggleDataSaver();
                    }
                }
            );


            /*
             * Notification permission.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const element =
                        event.target.closest(
                            "[data-request-notification-permission]"
                        );


                    if (
                        element
                    ) {

                        event.preventDefault();

                        Settings
                            .requestNotificationPermission();
                    }
                }
            );


            /*
             * Reset settings.
             */

            document.addEventListener(
                "click",
                function (
                    event
                ) {

                    const element =
                        event.target.closest(
                            "[data-reset-settings]"
                        );


                    if (
                        !element
                    ) {

                        return;
                    }


                    event.preventDefault();


                    const confirmed =
                        window.confirm(
                            "Reset all RiderX settings?"
                        );


                    if (
                        confirmed
                    ) {

                        Settings.reset();
                    }
                }
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.settingsController =
        Settings;


    RX.getSettings =
        Settings.get;


    RX.setSetting =
        Settings.set;


    RX.updateSettings =
        Settings.update;


    RX.resetSettings =
        Settings.reset;


    RX.toggleTheme =
        Settings.toggleTheme;


    RX.toggleNotifications =
        Settings.toggleNotifications;


    RX.toggleSound =
        Settings.toggleSound;


    /* ========================================================
       INIT
       ======================================================== */

    Settings.init =
        async function () {

            if (
                Settings.state.initialized
            ) {

                return;
            }


            Settings.state.initialized =
                true;

            Settings.state.loading =
                true;


            try {

                Settings.load();

                Settings.applyAll();

                Settings.bindEvents();

                Settings.render();


                /*
                 * Remote settings are loaded after
                 * local settings so the app remains
                 * usable even without network.
                 */

                await Settings
                    .loadFromFirebase();


                Settings.render();


                Settings.emit(
                    "ready",
                    {

                        values:
                            Settings.get()
                    }
                );


                console.log(
                    "RiderX settings.js loaded."
                );

            } finally {

                Settings.state.loading =
                    false;
            }
        };


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Settings.init
        );

    } else {

        Settings.init();

    }

})();

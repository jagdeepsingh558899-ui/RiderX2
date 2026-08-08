/* ============================================================
   RIDERX 2.0
   LANGUAGE SYSTEM
   File: js/language.js

   Supports:
   - English
   - Hindi
   - Saved language preference
   - Dynamic text translation
   - Dynamic placeholders
   - Buttons / labels / navigation
   - Language selector
   ============================================================ */

(function () {
    "use strict";

    window.RiderX = window.RiderX || {};

    const RX = window.RiderX;

    RX.language = RX.language || {};

    const LANG = RX.language;


    /* ========================================================
       CONFIG
       ======================================================== */

    LANG.config = {

        defaultLanguage: "en",

        storageKey:
            "riderx_language",

        supported: [
            "en",
            "hi"
        ]
    };


    /* ========================================================
       STATE
       ======================================================== */

    LANG.state = {

        current:
            LANG.config.defaultLanguage
    };


    /* ========================================================
       TRANSLATIONS
       ======================================================== */

    LANG.translations = {

        en: {

            appName:
                "RiderX",

            home:
                "Home",

            booking:
                "Booking",

            rides:
                "Rides",

            history:
                "History",

            wallet:
                "Wallet",

            profile:
                "Profile",

            settings:
                "Settings",

            notifications:
                "Notifications",

            support:
                "Support",

            logout:
                "Logout",

            login:
                "Login",

            register:
                "Register",

            continue:
                "Continue",

            next:
                "Next",

            back:
                "Back",

            save:
                "Save",

            cancel:
                "Cancel",

            confirm:
                "Confirm",

            done:
                "Done",

            search:
                "Search",

            pickup:
                "Pickup location",

            destination:
                "Where to?",

            chooseDestination:
                "Choose destination",

            currentLocation:
                "Current location",

            setLocation:
                "Set location",

            bikeTaxi:
                "Bike Taxi",

            cab:
                "Cab",

            parcel:
                "Parcel",

            foodDelivery:
                "Food Delivery",

            bookRide:
                "Book Ride",

            findingRider:
                "Finding a rider",

            riderAccepted:
                "Rider accepted",

            riderArriving:
                "Rider is arriving",

            riderArrived:
                "Rider has arrived",

            rideStarted:
                "Ride started",

            rideCompleted:
                "Ride completed",

            rideCancelled:
                "Ride cancelled",

            rideInProgress:
                "Ride in progress",

            fare:
                "Fare",

            total:
                "Total",

            estimatedFare:
                "Estimated fare",

            distance:
                "Distance",

            duration:
                "Duration",

            payment:
                "Payment",

            cash:
                "Cash",

            online:
                "Online",

            walletPayment:
                "Wallet",

            chat:
                "Chat",

            call:
                "Call",

            message:
                "Message",

            send:
                "Send",

            typeMessage:
                "Type a message",

            arrived:
                "Arrived",

            otp:
                "OTP",

            shareRide:
                "Share Ride",

            safety:
                "Safety",

            emergency:
                "Emergency",

            help:
                "Help",

            referral:
                "Referral",

            inviteFriends:
                "Invite Friends",

            earnings:
                "Earnings",

            available:
                "Available",

            offline:
                "Offline",

            onlineStatus:
                "Online",

            goOnline:
                "Go Online",

            goOffline:
                "Go Offline",

            accept:
                "Accept",

            reject:
                "Reject",

            startRide:
                "Start Ride",

            endRide:
                "End Ride",

            completeRide:
                "Complete Ride",

            pickupRequired:
                "Please select your pickup location.",

            destinationRequired:
                "Please select your destination.",

            loginRequired:
                "Please login to continue.",

            noActiveRide:
                "No active ride found.",

            bookingFailed:
                "Booking failed.",

            somethingWrong:
                "Something went wrong.",

            tryAgain:
                "Please try again.",

            noRides:
                "No rides yet.",

            noNotifications:
                "No notifications.",

            noMessages:
                "No messages yet.",

            welcome:
                "Welcome to RiderX",

            welcomeBack:
                "Welcome back",

            goodMorning:
                "Good morning",

            goodAfternoon:
                "Good afternoon",

            goodEvening:
                "Good evening",

            chooseService:
                "Choose a service",

            whereAreYouGoing:
                "Where are you going?",

            selectPayment:
                "Select payment method",

            rideDetails:
                "Ride Details",

            driverDetails:
                "Rider Details",

            customerDetails:
                "Customer Details",

            vehicle:
                "Vehicle",

            vehicleNumber:
                "Vehicle Number",

            rating:
                "Rating",

            reviews:
                "Reviews",

            rateRide:
                "Rate your ride",

            submitRating:
                "Submit Rating",

            skip:
                "Skip",

            thankYou:
                "Thank you",

            privacy:
                "Privacy",

            terms:
                "Terms & Conditions",

            language:
                "Language",

            english:
                "English",

            hindi:
                "Hindi",

            selectLanguage:
                "Select Language",

            account:
                "Account",

            personalInformation:
                "Personal Information",

            editProfile:
                "Edit Profile",

            name:
                "Name",

            phone:
                "Phone",

            email:
                "Email",

            password:
                "Password",

            changePassword:
                "Change Password",

            deleteAccount:
                "Delete Account",

            appSettings:
                "App Settings",

            darkMode:
                "Dark Mode",

            notificationsSettings:
                "Notification Settings",

            locationPermission:
                "Location Permission",

            enableLocation:
                "Enable Location",

            walletBalance:
                "Wallet Balance",

            addMoney:
                "Add Money",

            withdraw:
                "Withdraw",

            transactionHistory:
                "Transaction History",

            referralCode:
                "Referral Code",

            copy:
                "Copy",

            copied:
                "Copied",

            invite:
                "Invite",

            logoutConfirm:
                "Are you sure you want to logout?",

            cancelRideConfirm:
                "Are you sure you want to cancel this ride?",

            noRiderAvailable:
                "No rider is available right now.",

            searchingNearby:
                "Searching for nearby riders...",

            rideRequested:
                "Ride requested",

            waitingForRider:
                "Waiting for a rider to accept.",

            riderOnTheWay:
                "Your rider is on the way.",

            riderReached:
                "Your rider has reached the pickup location.",

            enjoyRide:
                "Enjoy your ride!",

            paymentSuccessful:
                "Payment successful",

            paymentFailed:
                "Payment failed",

            insufficientBalance:
                "Insufficient wallet balance.",

            networkError:
                "Network error. Please check your internet connection.",

            locationUnavailable:
                "Unable to get your location.",

            permissionDenied:
                "Location permission denied.",

            retry:
                "Retry",

            refresh:
                "Refresh",

            loading:
                "Loading...",

            pleaseWait:
                "Please wait...",

            today:
                "Today",

            yesterday:
                "Yesterday",

            tomorrow:
                "Tomorrow",

            date:
                "Date",

            time:
                "Time",

            status:
                "Status",

            pending:
                "Pending",

            accepted:
                "Accepted",

            rejected:
                "Rejected",

            completed:
                "Completed",

            cancelled:
                "Cancelled",

            active:
                "Active",

            inactive:
                "Inactive",

            admin:
                "Admin",

            customers:
                "Customers",

            riders:
                "Riders",

            dashboard:
                "Dashboard",

            reports:
                "Reports",

            manageRiders:
                "Manage Riders",

            manageCustomers:
                "Manage Customers",

            rideRequests:
                "Ride Requests",

            allRides:
                "All Rides",

            supportTickets:
                "Support Tickets",

            systemSettings:
                "System Settings"
        },


        /* ====================================================
           HINDI
           ==================================================== */

        hi: {

            appName:
                "RiderX",

            home:
                "होम",

            booking:
                "बुकिंग",

            rides:
                "राइड्स",

            history:
                "इतिहास",

            wallet:
                "वॉलेट",

            profile:
                "प्रोफाइल",

            settings:
                "सेटिंग्स",

            notifications:
                "नोटिफिकेशन",

            support:
                "सपोर्ट",

            logout:
                "लॉग आउट",

            login:
                "लॉगिन",

            register:
                "रजिस्टर",

            continue:
                "जारी रखें",

            next:
                "आगे",

            back:
                "पीछे",

            save:
                "सेव करें",

            cancel:
                "रद्द करें",

            confirm:
                "पुष्टि करें",

            done:
                "हो गया",

            search:
                "खोजें",

            pickup:
                "पिकअप लोकेशन",

            destination:
                "कहाँ जाना है?",

            chooseDestination:
                "डेस्टिनेशन चुनें",

            currentLocation:
                "वर्तमान लोकेशन",

            setLocation:
                "लोकेशन सेट करें",

            bikeTaxi:
                "बाइक टैक्सी",

            cab:
                "कैब",

            parcel:
                "पार्सल",

            foodDelivery:
                "फूड डिलीवरी",

            bookRide:
                "राइड बुक करें",

            findingRider:
                "राइडर खोज रहे हैं",

            riderAccepted:
                "राइडर ने राइड स्वीकार कर ली",

            riderArriving:
                "राइडर आ रहा है",

            riderArrived:
                "राइडर पहुँच गया है",

            rideStarted:
                "राइड शुरू हो गई",

            rideCompleted:
                "राइड पूरी हो गई",

            rideCancelled:
                "राइड रद्द कर दी गई",

            rideInProgress:
                "राइड चल रही है",

            fare:
                "किराया",

            total:
                "कुल",

            estimatedFare:
                "अनुमानित किराया",

            distance:
                "दूरी",

            duration:
                "समय",

            payment:
                "भुगतान",

            cash:
                "कैश",

            online:
                "ऑनलाइन",

            walletPayment:
                "वॉलेट",

            chat:
                "चैट",

            call:
                "कॉल",

            message:
                "मैसेज",

            send:
                "भेजें",

            typeMessage:
                "मैसेज लिखें",

            arrived:
                "पहुँच गया",

            otp:
                "ओटीपी",

            shareRide:
                "राइड शेयर करें",

            safety:
                "सेफ्टी",

            emergency:
                "इमरजेंसी",

            help:
                "मदद",

            referral:
                "रेफरल",

            inviteFriends:
                "दोस्तों को आमंत्रित करें",

            earnings:
                "कमाई",

            available:
                "उपलब्ध",

            offline:
                "ऑफलाइन",

            onlineStatus:
                "ऑनलाइन",

            goOnline:
                "ऑनलाइन जाएँ",

            goOffline:
                "ऑफलाइन जाएँ",

            accept:
                "स्वीकार करें",

            reject:
                "अस्वीकार करें",

            startRide:
                "राइड शुरू करें",

            endRide:
                "राइड समाप्त करें",

            completeRide:
                "राइड पूरी करें",

            pickupRequired:
                "कृपया पिकअप लोकेशन चुनें।",

            destinationRequired:
                "कृपया डेस्टिनेशन चुनें।",

            loginRequired:
                "जारी रखने के लिए लॉगिन करें।",

            noActiveRide:
                "कोई एक्टिव राइड नहीं मिली।",

            bookingFailed:
                "बुकिंग असफल रही।",

            somethingWrong:
                "कुछ गलत हो गया।",

            tryAgain:
                "कृपया दोबारा प्रयास करें।",

            noRides:
                "अभी कोई राइड नहीं है।",

            noNotifications:
                "कोई नोटिफिकेशन नहीं है।",

            noMessages:
                "अभी कोई मैसेज नहीं है।",

            welcome:
                "RiderX में आपका स्वागत है",

            welcomeBack:
                "वापसी पर स्वागत है",

            goodMorning:
                "सुप्रभात",

            goodAfternoon:
                "नमस्कार",

            goodEvening:
                "शुभ संध्या",

            chooseService:
                "सर्विस चुनें",

            whereAreYouGoing:
                "आप कहाँ जाना चाहते हैं?",

            selectPayment:
                "पेमेंट का तरीका चुनें",

            rideDetails:
                "राइड की जानकारी",

            driverDetails:
                "राइडर की जानकारी",

            customerDetails:
                "कस्टमर की जानकारी",

            vehicle:
                "वाहन",

            vehicleNumber:
                "वाहन नंबर",

            rating:
                "रेटिंग",

            reviews:
                "रिव्यू",

            rateRide:
                "अपनी राइड को रेट करें",

            submitRating:
                "रेटिंग भेजें",

            skip:
                "स्किप करें",

            thankYou:
                "धन्यवाद",

            privacy:
                "प्राइवेसी",

            terms:
                "नियम और शर्तें",

            language:
                "भाषा",

            english:
                "English",

            hindi:
                "हिंदी",

            selectLanguage:
                "भाषा चुनें",

            account:
                "अकाउंट",

            personalInformation:
                "व्यक्तिगत जानकारी",

            editProfile:
                "प्रोफाइल एडिट करें",

            name:
                "नाम",

            phone:
                "फोन",

            email:
                "ईमेल",

            password:
                "पासवर्ड",

            changePassword:
                "पासवर्ड बदलें",

            deleteAccount:
                "अकाउंट डिलीट करें",

            appSettings:
                "ऐप सेटिंग्स",

            darkMode:
                "डार्क मोड",

            notificationsSettings:
                "नोटिफिकेशन सेटिंग्स",

            locationPermission:
                "लोकेशन परमिशन",

            enableLocation:
                "लोकेशन चालू करें",

            walletBalance:
                "वॉलेट बैलेंस",

            addMoney:
                "पैसे जोड़ें",

            withdraw:
                "पैसे निकालें",

            transactionHistory:
                "लेन-देन इतिहास",

            referralCode:
                "रेफरल कोड",

            copy:
                "कॉपी",

            copied:
                "कॉपी हो गया",

            invite:
                "आमंत्रित करें",

            logoutConfirm:
                "क्या आप लॉग आउट करना चाहते हैं?",

            cancelRideConfirm:
                "क्या आप इस राइड को रद्द करना चाहते हैं?",

            noRiderAvailable:
                "अभी कोई राइडर उपलब्ध नहीं है।",

            searchingNearby:
                "पास के राइडर खोजे जा रहे हैं...",

            rideRequested:
                "राइड रिक्वेस्ट भेज दी गई",

            waitingForRider:
                "राइडर के स्वीकार करने का इंतजार है।",

            riderOnTheWay:
                "आपका राइडर रास्ते में है।",

            riderReached:
                "आपका राइडर पिकअप लोकेशन पर पहुँच गया है।",

            enjoyRide:
                "अपनी राइड का आनंद लें!",

            paymentSuccessful:
                "पेमेंट सफल रहा",

            paymentFailed:
                "पेमेंट असफल रहा",

            insufficientBalance:
                "वॉलेट में पर्याप्त बैलेंस नहीं है।",

            networkError:
                "नेटवर्क एरर। इंटरनेट कनेक्शन चेक करें।",

            locationUnavailable:
                "आपकी लोकेशन प्राप्त नहीं हो सकी।",

            permissionDenied:
                "लोकेशन परमिशन नहीं दी गई।",

            retry:
                "दोबारा प्रयास करें",

            refresh:
                "रिफ्रेश करें",

            loading:
                "लोड हो रहा है...",

            pleaseWait:
                "कृपया प्रतीक्षा करें...",

            today:
                "आज",

            yesterday:
                "कल",

            tomorrow:
                "कल",

            date:
                "तारीख",

            time:
                "समय",

            status:
                "स्थिति",

            pending:
                "पेंडिंग",

            accepted:
                "स्वीकार किया गया",

            rejected:
                "अस्वीकार किया गया",

            completed:
                "पूरा हुआ",

            cancelled:
                "रद्द",

            active:
                "सक्रिय",

            inactive:
                "निष्क्रिय",

            admin:
                "एडमिन",

            customers:
                "कस्टमर्स",

            riders:
                "राइडर्स",

            dashboard:
                "डैशबोर्ड",

            reports:
                "रिपोर्ट्स",

            manageRiders:
                "राइडर्स मैनेज करें",

            manageCustomers:
                "कस्टमर्स मैनेज करें",

            rideRequests:
                "राइड रिक्वेस्ट",

            allRides:
                "सभी राइड्स",

            supportTickets:
                "सपोर्ट टिकट्स",

            systemSettings:
                "सिस्टम सेटिंग्स"
        }
    };


    /* ========================================================
       GET CURRENT LANGUAGE
       ======================================================== */

    LANG.get = function () {

        return LANG.state.current;
    };


    /* ========================================================
       GET TRANSLATION
       ======================================================== */

    LANG.t = function (
        key,
        fallback
    ) {

        const language =
            LANG.state.current;

        const dictionary =
            LANG.translations[
                language
            ] ||
            LANG.translations.en;

        if (
            dictionary &&
            Object.prototype
                .hasOwnProperty
                .call(
                    dictionary,
                    key
                )
        ) {

            return dictionary[key];
        }

        if (
            LANG.translations.en &&
            Object.prototype
                .hasOwnProperty
                .call(
                    LANG.translations.en,
                    key
                )
        ) {

            return LANG.translations
                .en[key];
        }

        return (
            fallback ||
            key
        );
    };


    /* ========================================================
       SET LANGUAGE
       ======================================================== */

    LANG.set = function (
        language
    ) {

        language =
            String(
                language || ""
            ).toLowerCase();

        if (
            !LANG.config.supported
                .includes(language)
        ) {

            language =
                LANG.config.defaultLanguage;
        }

        LANG.state.current =
            language;

        try {

            localStorage.setItem(
                LANG.config.storageKey,
                language
            );

        } catch (error) {

            console.warn(
                "Language storage unavailable",
                error
            );
        }

        document.documentElement
            .setAttribute(
                "lang",
                language === "hi"
                    ? "hi"
                    : "en"
            );

        document.body.dataset.language =
            language;

        LANG.apply();

        LANG.updateSelectors();

        window.dispatchEvent(
            new CustomEvent(
                "riderx-language-changed",
                {
                    detail: {
                        language:
                            language
                    }
                }
            )
        );

        return language;
    };


    /* ========================================================
       LOAD SAVED LANGUAGE
       ======================================================== */

    LANG.load = function () {

        let language =
            LANG.config.defaultLanguage;

        try {

            const saved =
                localStorage.getItem(
                    LANG.config.storageKey
                );

            if (
                saved &&
                LANG.config.supported
                    .includes(saved)
            ) {

                language =
                    saved;
            }

        } catch (error) {

            console.warn(
                "Unable to load language",
                error
            );
        }

        LANG.state.current =
            language;

        document.documentElement
            .setAttribute(
                "lang",
                language === "hi"
                    ? "hi"
                    : "en"
            );

        document.body.dataset.language =
            language;
    };


    /* ========================================================
       APPLY TRANSLATIONS
       ======================================================== */

    LANG.apply = function () {

        /*
         * Text content
         *
         * Example:
         * <span data-i18n="home"></span>
         */

        document
            .querySelectorAll(
                "[data-i18n]"
            )
            .forEach(
                function (element) {

                    const key =
                        element.dataset
                            .i18n;

                    if (!key) {
                        return;
                    }

                    element.textContent =
                        LANG.t(
                            key,
                            element
                                .textContent
                        );
                }
            );


        /*
         * HTML content
         */

        document
            .querySelectorAll(
                "[data-i18n-html]"
            )
            .forEach(
                function (element) {

                    const key =
                        element.dataset
                            .i18nHtml;

                    if (!key) {
                        return;
                    }

                    element.innerHTML =
                        LANG.t(
                            key,
                            element
                                .innerHTML
                        );
                }
            );


        /*
         * Placeholder
         */

        document
            .querySelectorAll(
                "[data-i18n-placeholder]"
            )
            .forEach(
                function (element) {

                    const key =
                        element.dataset
                            .i18nPlaceholder;

                    if (!key) {
                        return;
                    }

                    element.placeholder =
                        LANG.t(
                            key,
                            element.placeholder
                        );
                }
            );


        /*
         * Title
         */

        document
            .querySelectorAll(
                "[data-i18n-title]"
            )
            .forEach(
                function (element) {

                    const key =
                        element.dataset
                            .i18nTitle;

                    element.title =
                        LANG.t(
                            key,
                            element.title
                        );
                }
            );


        /*
         * Aria label
         */

        document
            .querySelectorAll(
                "[data-i18n-aria]"
            )
            .forEach(
                function (element) {

                    const key =
                        element.dataset
                            .i18nAria;

                    element.setAttribute(
                        "aria-label",
                        LANG.t(
                            key,
                            element
                                .getAttribute(
                                    "aria-label"
                                ) || ""
                        )
                    );
                }
            );
    };


    /* ========================================================
       LANGUAGE SELECTORS
       ======================================================== */

    LANG.updateSelectors = function () {

        document
            .querySelectorAll(
                "[data-language]"
            )
            .forEach(
                function (element) {

                    element.classList.toggle(
                        "active",
                        element.dataset
                            .language ===
                        LANG.state.current
                    );

                    element
                        .setAttribute(
                            "aria-selected",
                            element.dataset
                                .language ===
                            LANG.state.current
                                ? "true"
                                : "false"
                        );
                }
            );


        document
            .querySelectorAll(
                "[data-language-value]"
            )
            .forEach(
                function (element) {

                    element.value =
                        LANG.state.current;
                }
            );
    };


    /* ========================================================
       TOGGLE LANGUAGE
       ======================================================== */

    LANG.toggle = function () {

        const next =
            LANG.state.current === "en"
                ? "hi"
                : "en";

        return LANG.set(
            next
        );
    };


    /* ========================================================
       GET LANGUAGE NAME
       ======================================================== */

    LANG.getName = function (
        language
    ) {

        if (
            language === "hi"
        ) {

            return "हिंदी";
        }

        return "English";
    };


    /* ========================================================
       CREATE LANGUAGE SWITCHER
       ======================================================== */

    LANG.createSwitcher = function (
        container
    ) {

        if (!container) {
            return;
        }

        container.innerHTML = "";

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "rx-language-switcher";


        LANG.config.supported
            .forEach(
                function (language) {

                    const button =
                        document
                            .createElement(
                                "button"
                            );

                    button.type =
                        "button";

                    button.className =
                        "rx-language-option";

                    button.dataset.language =
                        language;

                    button.textContent =
                        LANG.getName(
                            language
                        );

                    button.classList.toggle(
                        "active",
                        language ===
                        LANG.state.current
                    );

                    button.addEventListener(
                        "click",
                        function () {

                            LANG.set(
                                language
                            );

                            LANG.createSwitcher(
                                container
                            );
                        }
                    );

                    wrapper.appendChild(
                        button
                    );
                }
            );

        container.appendChild(
            wrapper
        );
    };


    /* ========================================================
       BIND LANGUAGE BUTTONS
       ======================================================== */

    LANG.bind = function () {

        document
            .querySelectorAll(
                "[data-language]"
            )
            .forEach(
                function (element) {

                    if (
                        element.dataset
                            .languageBound ===
                        "true"
                    ) {
                        return;
                    }

                    element.dataset
                        .languageBound =
                        "true";

                    element.addEventListener(
                        "click",
                        function () {

                            LANG.set(
                                element.dataset
                                    .language
                            );
                        }
                    );
                }
            );


        document
            .querySelectorAll(
                "[data-action='toggle-language']"
            )
            .forEach(
                function (button) {

                    if (
                        button.dataset
                            .languageBound ===
                        "true"
                    ) {
                        return;
                    }

                    button.dataset
                        .languageBound =
                        "true";

                    button.addEventListener(
                        "click",
                        function () {

                            LANG.toggle();
                        }
                    );
                }
            );


        document
            .querySelectorAll(
                "[data-language-select]"
            )
            .forEach(
                function (select) {

                    if (
                        select.dataset
                            .languageBound ===
                        "true"
                    ) {
                        return;
                    }

                    select.dataset
                        .languageBound =
                        "true";

                    select.value =
                        LANG.state.current;

                    select.addEventListener(
                        "change",
                        function () {

                            LANG.set(
                                select.value
                            );
                        }
                    );
                }
            );
    };


    /* ========================================================
       FORMAT TEXT
       ======================================================== */

    LANG.format = function (
        key,
        values
    ) {

        let text =
            LANG.t(key);

        values =
            values || {};

        Object.keys(values)
            .forEach(
                function (name) {

                    text =
                        text.replace(
                            new RegExp(
                                "\\{" +
                                name +
                                "\\}",
                                "g"
                            ),
                            String(
                                values[name]
                            )
                        );
                }
            );

        return text;
    };


    /* ========================================================
       INIT
       ======================================================== */

    LANG.init = function () {

        LANG.load();

        LANG.apply();

        LANG.bind();

        LANG.updateSelectors();

        console.log(
            "RiderX Language System loaded:",
            LANG.state.current
        );
    };


    /* ========================================================
       DOM READY
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            LANG.init
        );

    } else {

        LANG.init();
    }


})();

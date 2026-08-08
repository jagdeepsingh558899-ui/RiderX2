/* ============================================================
   RIDERX LANGUAGE ENGINE
   File: js/language.js

   Supports:
   - English
   - Hindi
   - Customer
   - Rider
   - Admin
   - Dynamic translation
   - Placeholder translation
   - Title translation
   - Button translation
   - Saved language preference
   - Runtime language switching
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Language =
        RX.language =
        RX.language || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    Language.config = {

        defaultLanguage:
            "en",

        storageKey:
            "riderx_language",

        supportedLanguages: [
            "en",
            "hi"
        ]
    };


    /* ========================================================
       STATE
       ======================================================== */

    Language.state = {

        current:
            Language.config.defaultLanguage,

        ready:
            false
    };


    /* ========================================================
       TRANSLATIONS
       ======================================================== */

    Language.translations = {

        en: {

            /* General */

            app_name:
                "RiderX",

            home:
                "Home",

            menu:
                "Menu",

            back:
                "Back",

            next:
                "Next",

            continue:
                "Continue",

            cancel:
                "Cancel",

            confirm:
                "Confirm",

            save:
                "Save",

            update:
                "Update",

            edit:
                "Edit",

            delete:
                "Delete",

            close:
                "Close",

            done:
                "Done",

            retry:
                "Retry",

            search:
                "Search",

            submit:
                "Submit",

            loading:
                "Loading...",

            yes:
                "Yes",

            no:
                "No",

            ok:
                "OK",


            /* Navigation */

            profile:
                "Profile",

            settings:
                "Settings",

            notifications:
                "Notifications",

            wallet:
                "Wallet",

            history:
                "History",

            support:
                "Support",

            rides:
                "Rides",

            payments:
                "Payments",

            offers:
                "Offers",

            logout:
                "Logout",


            /* Customer */

            where_to:
                "Where to?",

            pickup_location:
                "Pickup location",

            destination:
                "Destination",

            choose_destination:
                "Choose your destination",

            set_pickup:
                "Set pickup location",

            current_location:
                "Current location",

            choose_ride:
                "Choose a ride",

            book_ride:
                "Book a ride",

            confirm_ride:
                "Confirm ride",

            searching_for_rider:
                "Finding your rider...",

            rider_found:
                "Rider found",

            ride_accepted:
                "Ride accepted",

            rider_arriving:
                "Rider is arriving",

            trip_started:
                "Trip started",

            trip_completed:
                "Trip completed",

            ride_cancelled:
                "Ride cancelled",

            ride_details:
                "Ride details",

            fare:
                "Fare",

            estimated_fare:
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

            upi:
                "UPI",

            card:
                "Card",

            wallet_payment:
                "Wallet",

            rate_your_ride:
                "Rate your ride",

            how_was_your_ride:
                "How was your ride?",

            submit_rating:
                "Submit rating",


            /* Services */

            bike_taxi:
                "Bike Taxi",

            cab:
                "Cab",

            parcel:
                "Parcel",

            food_delivery:
                "Food Delivery",

            fast_affordable:
                "Fast & affordable",

            comfortable_rides:
                "Comfortable rides",

            send_anything:
                "Send anything",

            quick_delivery:
                "Quick delivery",


            /* Rider */

            rider_dashboard:
                "Rider Dashboard",

            go_online:
                "Go Online",

            go_offline:
                "Go Offline",

            online_status:
                "You are online",

            offline_status:
                "You are offline",

            new_ride_request:
                "New ride request",

            accept_ride:
                "Accept Ride",

            decline_ride:
                "Decline",

            pickup:
                "Pickup",

            drop:
                "Drop",

            navigate:
                "Navigate",

            arrive:
                "Arrived",

            start_ride:
                "Start Ride",

            complete_ride:
                "Complete Ride",

            earnings:
                "Earnings",

            today_earnings:
                "Today's earnings",

            total_earnings:
                "Total earnings",

            completed_rides:
                "Completed rides",

            rider_profile:
                "Rider Profile",


            /* History */

            ride_history:
                "Ride History",

            no_rides:
                "No rides found",

            past_rides:
                "Past rides",

            completed:
                "Completed",

            cancelled:
                "Cancelled",

            pending:
                "Pending",

            accepted:
                "Accepted",

            searching:
                "Searching",

            ongoing:
                "On trip",

            details:
                "Details",


            /* Wallet */

            available_balance:
                "Available balance",

            add_money:
                "Add money",

            withdraw:
                "Withdraw",

            transactions:
                "Transactions",

            transaction_history:
                "Transaction history",

            recharge:
                "Recharge",

            refund:
                "Refund",


            /* Profile */

            personal_information:
                "Personal information",

            full_name:
                "Full name",

            phone_number:
                "Phone number",

            email:
                "Email",

            language:
                "Language",

            english:
                "English",

            hindi:
                "Hindi",

            change_language:
                "Change language",


            /* Notifications */

            no_notifications:
                "No notifications",

            mark_all_read:
                "Mark all as read",

            new_notification:
                "New notification",


            /* Settings */

            account:
                "Account",

            privacy:
                "Privacy",

            security:
                "Security",

            dark_mode:
                "Dark mode",

            location:
                "Location",

            permissions:
                "Permissions",

            app_settings:
                "App settings",


            /* Authentication */

            login:
                "Login",

            register:
                "Register",

            create_account:
                "Create account",

            phone_login:
                "Login with phone",

            email_login:
                "Login with email",

            enter_phone:
                "Enter phone number",

            enter_otp:
                "Enter OTP",

            verify_otp:
                "Verify OTP",

            send_otp:
                "Send OTP",

            resend_otp:
                "Resend OTP",

            password:
                "Password",

            forgot_password:
                "Forgot password?",

            welcome:
                "Welcome to RiderX",


            /* Admin */

            admin_dashboard:
                "Admin Dashboard",

            customers:
                "Customers",

            riders:
                "Riders",

            rider_approval:
                "Rider Approval",

            reports:
                "Reports",

            pricing:
                "Pricing",

            fare_settings:
                "Fare Settings",

            service_settings:
                "Service Settings",

            coupons:
                "Coupons",

            commission:
                "Commission",

            admin_notifications:
                "Notifications",

            users:
                "Users",

            supports:
                "Supports",

            admin_settings:
                "Admin Settings",


            /* Errors */

            something_wrong:
                "Something went wrong.",

            network_error:
                "Network error. Please try again.",

            location_error:
                "Unable to get your location.",

            login_required:
                "Please login to continue.",

            permission_denied:
                "Permission denied.",

            ride_not_found:
                "Ride not found.",


            /* Messages */

            changes_saved:
                "Changes saved successfully.",

            ride_booked:
                "Your ride has been booked.",

            ride_cancel_confirm:
                "Are you sure you want to cancel this ride?",

            logout_confirm:
                "Are you sure you want to logout?",

            welcome_back:
                "Welcome back",

            good_morning:
                "Good morning",

            good_afternoon:
                "Good afternoon",

            good_evening:
                "Good evening",

            good_night:
                "Good night"
        },


        /* ====================================================
           HINDI
           ==================================================== */

        hi: {

            /* General */

            app_name:
                "RiderX",

            home:
                "होम",

            menu:
                "मेन्यू",

            back:
                "वापस",

            next:
                "आगे",

            continue:
                "जारी रखें",

            cancel:
                "रद्द करें",

            confirm:
                "पुष्टि करें",

            save:
                "सेव करें",

            update:
                "अपडेट करें",

            edit:
                "एडिट करें",

            delete:
                "डिलीट करें",

            close:
                "बंद करें",

            done:
                "हो गया",

            retry:
                "फिर कोशिश करें",

            search:
                "खोजें",

            submit:
                "सबमिट करें",

            loading:
                "लोड हो रहा है...",

            yes:
                "हाँ",

            no:
                "नहीं",

            ok:
                "ठीक है",


            /* Navigation */

            profile:
                "प्रोफाइल",

            settings:
                "सेटिंग्स",

            notifications:
                "नोटिफिकेशन",

            wallet:
                "वॉलेट",

            history:
                "हिस्ट्री",

            support:
                "सपोर्ट",

            rides:
                "राइड्स",

            payments:
                "पेमेंट्स",

            offers:
                "ऑफर्स",

            logout:
                "लॉग आउट",


            /* Customer */

            where_to:
                "कहाँ जाना है?",

            pickup_location:
                "पिकअप लोकेशन",

            destination:
                "डेस्टिनेशन",

            choose_destination:
                "अपना डेस्टिनेशन चुनें",

            set_pickup:
                "पिकअप लोकेशन सेट करें",

            current_location:
                "वर्तमान लोकेशन",

            choose_ride:
                "राइड चुनें",

            book_ride:
                "राइड बुक करें",

            confirm_ride:
                "राइड कन्फर्म करें",

            searching_for_rider:
                "राइडर खोज रहे हैं...",

            rider_found:
                "राइडर मिल गया",

            ride_accepted:
                "राइड स्वीकार कर ली गई",

            rider_arriving:
                "राइडर आ रहा है",

            trip_started:
                "ट्रिप शुरू हो गई",

            trip_completed:
                "ट्रिप पूरी हो गई",

            ride_cancelled:
                "राइड रद्द कर दी गई",

            ride_details:
                "राइड की जानकारी",

            fare:
                "किराया",

            estimated_fare:
                "अनुमानित किराया",

            distance:
                "दूरी",

            duration:
                "समय",

            payment:
                "पेमेंट",

            cash:
                "कैश",

            online:
                "ऑनलाइन",

            upi:
                "UPI",

            card:
                "कार्ड",

            wallet_payment:
                "वॉलेट",

            rate_your_ride:
                "अपनी राइड को रेट करें",

            how_was_your_ride:
                "आपकी राइड कैसी रही?",

            submit_rating:
                "रेटिंग सबमिट करें",


            /* Services */

            bike_taxi:
                "बाइक टैक्सी",

            cab:
                "कैब",

            parcel:
                "पार्सल",

            food_delivery:
                "फूड डिलीवरी",

            fast_affordable:
                "तेज़ और किफायती",

            comfortable_rides:
                "आरामदायक राइड",

            send_anything:
                "कुछ भी भेजें",

            quick_delivery:
                "तेज़ डिलीवरी",


            /* Rider */

            rider_dashboard:
                "राइडर डैशबोर्ड",

            go_online:
                "ऑनलाइन जाएँ",

            go_offline:
                "ऑफलाइन जाएँ",

            online_status:
                "आप ऑनलाइन हैं",

            offline_status:
                "आप ऑफलाइन हैं",

            new_ride_request:
                "नई राइड रिक्वेस्ट",

            accept_ride:
                "राइड स्वीकार करें",

            decline_ride:
                "मना करें",

            pickup:
                "पिकअप",

            drop:
                "ड्रॉप",

            navigate:
                "नेविगेट करें",

            arrive:
                "पहुँच गया",

            start_ride:
                "राइड शुरू करें",

            complete_ride:
                "राइड पूरी करें",

            earnings:
                "कमाई",

            today_earnings:
                "आज की कमाई",

            total_earnings:
                "कुल कमाई",

            completed_rides:
                "पूरी हुई राइड्स",

            rider_profile:
                "राइडर प्रोफाइल",


            /* History */

            ride_history:
                "राइड हिस्ट्री",

            no_rides:
                "कोई राइड नहीं मिली",

            past_rides:
                "पिछली राइड्स",

            completed:
                "पूरी हुई",

            cancelled:
                "रद्द",

            pending:
                "पेंडिंग",

            accepted:
                "स्वीकार की गई",

            searching:
                "खोज रहे हैं",

            ongoing:
                "राइड चल रही है",

            details:
                "जानकारी",


            /* Wallet */

            available_balance:
                "उपलब्ध बैलेंस",

            add_money:
                "पैसे जोड़ें",

            withdraw:
                "पैसे निकालें",

            transactions:
                "लेन-देन",

            transaction_history:
                "लेन-देन की हिस्ट्री",

            recharge:
                "रिचार्ज",

            refund:
                "रिफंड",


            /* Profile */

            personal_information:
                "व्यक्तिगत जानकारी",

            full_name:
                "पूरा नाम",

            phone_number:
                "फोन नंबर",

            email:
                "ईमेल",

            language:
                "भाषा",

            english:
                "English",

            hindi:
                "हिंदी",

            change_language:
                "भाषा बदलें",


            /* Notifications */

            no_notifications:
                "कोई नोटिफिकेशन नहीं",

            mark_all_read:
                "सभी को पढ़ा हुआ करें",

            new_notification:
                "नया नोटिफिकेशन",


            /* Settings */

            account:
                "अकाउंट",

            privacy:
                "प्राइवेसी",

            security:
                "सिक्योरिटी",

            dark_mode:
                "डार्क मोड",

            location:
                "लोकेशन",

            permissions:
                "परमिशन",

            app_settings:
                "ऐप सेटिंग्स",


            /* Authentication */

            login:
                "लॉगिन",

            register:
                "रजिस्टर",

            create_account:
                "अकाउंट बनाएँ",

            phone_login:
                "फोन से लॉगिन",

            email_login:
                "ईमेल से लॉगिन",

            enter_phone:
                "फोन नंबर दर्ज करें",

            enter_otp:
                "OTP दर्ज करें",

            verify_otp:
                "OTP वेरीफाई करें",

            send_otp:
                "OTP भेजें",

            resend_otp:
                "OTP दोबारा भेजें",

            password:
                "पासवर्ड",

            forgot_password:
                "पासवर्ड भूल गए?",

            welcome:
                "RiderX में आपका स्वागत है",


            /* Admin */

            admin_dashboard:
                "एडमिन डैशबोर्ड",

            customers:
                "कस्टमर्स",

            riders:
                "राइडर्स",

            rider_approval:
                "राइडर अप्रूवल",

            reports:
                "रिपोर्ट्स",

            pricing:
                "प्राइसिंग",

            fare_settings:
                "फेयर सेटिंग्स",

            service_settings:
                "सर्विस सेटिंग्स",

            coupons:
                "कूपन्स",

            commission:
                "कमीशन",

            admin_notifications:
                "नोटिफिकेशन",

            users:
                "यूज़र्स",

            supports:
                "सपोर्ट्स",

            admin_settings:
                "एडमिन सेटिंग्स",


            /* Errors */

            something_wrong:
                "कुछ गलत हो गया।",

            network_error:
                "नेटवर्क एरर। कृपया फिर कोशिश करें।",

            location_error:
                "आपकी लोकेशन प्राप्त नहीं हो सकी।",

            login_required:
                "जारी रखने के लिए लॉगिन करें।",

            permission_denied:
                "परमिशन नहीं है।",

            ride_not_found:
                "राइड नहीं मिली।",


            /* Messages */

            changes_saved:
                "बदलाव सफलतापूर्वक सेव हो गए।",

            ride_booked:
                "आपकी राइड बुक हो गई है।",

            ride_cancel_confirm:
                "क्या आप वाकई इस राइड को रद्द करना चाहते हैं?",

            logout_confirm:
                "क्या आप वाकई लॉग आउट करना चाहते हैं?",

            welcome_back:
                "वापसी पर स्वागत है",

            good_morning:
                "सुप्रभात",

            good_afternoon:
                "नमस्कार",

            good_evening:
                "शुभ संध्या",

            good_night:
                "शुभ रात्रि"
        }
    };


    /* ========================================================
       LANGUAGE VALIDATION
       ======================================================== */

    Language.isSupported =
        function (
            language
        ) {

            return Language.config
                .supportedLanguages
                .includes(
                    language
                );
        };


    Language.normalize =
        function (
            language
        ) {

            language =
                String(
                    language ||
                    ""
                )
                .toLowerCase()
                .trim();


            if (
                language.startsWith(
                    "hi"
                )
            ) {

                return "hi";
            }


            if (
                language.startsWith(
                    "en"
                )
            ) {

                return "en";
            }


            return Language.config
                .defaultLanguage;
        };


    /* ========================================================
       GET LANGUAGE
       ======================================================== */

    Language.get =
        function () {

            return Language.state.current;
        };


    /* ========================================================
       LOAD SAVED LANGUAGE
       ======================================================== */

    Language.load =
        function () {

            let language =
                null;


            try {

                language =
                    localStorage.getItem(
                        Language.config
                            .storageKey
                    );

            } catch (error) {}


            if (
                !language
            ) {

                /*
                 * Detect browser language.
                 */

                language =
                    navigator
                        .language ||
                    "en";
            }


            Language.state.current =
                Language.normalize(
                    language
                );


            return Language.state.current;
        };


    /* ========================================================
       SAVE LANGUAGE
       ======================================================== */

    Language.save =
        function (
            language
        ) {

            try {

                localStorage.setItem(
                    Language.config
                        .storageKey,
                    language
                );

            } catch (error) {}
        };


    /* ========================================================
       TRANSLATE
       ======================================================== */

    Language.t =
        function (
            key,
            fallback
        ) {

            if (
                !key
            ) {

                return (
                    fallback ||
                    ""
                );
            }


            const language =
                Language.state.current;


            const dictionary =
                Language.translations[
                    language
                ] || {};


            /*
             * Direct key.
             */

            if (
                dictionary[key] !==
                undefined
            ) {

                return dictionary[key];
            }


            /*
             * Dot notation support:
             * customer.home.title
             */

            const parts =
                String(
                    key
                )
                .split(".");


            let value =
                dictionary;


            for (
                const part of parts
            ) {

                if (
                    value &&
                    value[part] !==
                    undefined
                ) {

                    value =
                        value[part];

                } else {

                    value =
                        undefined;

                    break;
                }
            }


            if (
                value !== undefined
            ) {

                return value;
            }


            /*
             * Try English fallback.
             */

            const english =
                Language.translations.en;


            if (
                english[key] !==
                undefined
            ) {

                return english[key];
            }


            return (
                fallback ||
                key
            );
        };


    /* ========================================================
       SET LANGUAGE
       ======================================================== */

    Language.set =
        function (
            language,
            options
        ) {

            options =
                options || {};


            language =
                Language.normalize(
                    language
                );


            if (
                !Language.isSupported(
                    language
                )
            ) {

                return false;
            }


            const previous =
                Language.state.current;


            Language.state.current =
                language;


            Language.save(
                language
            );


            /*
             * Update document language.
             */

            try {

                document.documentElement
                    .setAttribute(
                        "lang",
                        language === "hi"
                            ? "hi"
                            : "en"
                    );

            } catch (error) {}


            /*
             * Apply translations.
             */

            if (
                options.apply !==
                false
            ) {

                Language.apply();
            }


            Language.emit(
                "changed",
                {

                    language:
                        language,

                    previous:
                        previous
                }
            );


            return language;
        };


    /* ========================================================
       TOGGLE
       ======================================================== */

    Language.toggle =
        function () {

            const next =
                Language.state.current ===
                "en"
                    ? "hi"
                    : "en";


            return Language.set(
                next
            );
        };


    /* ========================================================
       APPLY ELEMENT TRANSLATION
       ======================================================== */

    Language.translateElement =
        function (
            element
        ) {

            if (
                !element
            ) {
                return;
            }


            /*
             * Text content.
             */

            if (
                element.hasAttribute(
                    "data-i18n"
                )
            ) {

                const key =
                    element.getAttribute(
                        "data-i18n"
                    );


                element.textContent =
                    Language.t(
                        key
                    );
            }


            /*
             * HTML content.
             */

            if (
                element.hasAttribute(
                    "data-i18n-html"
                )
            ) {

                const key =
                    element.getAttribute(
                        "data-i18n-html"
                    );


                element.innerHTML =
                    Language.t(
                        key
                    );
            }


            /*
             * Placeholder.
             */

            if (
                element.hasAttribute(
                    "data-i18n-placeholder"
                )
            ) {

                const key =
                    element.getAttribute(
                        "data-i18n-placeholder"
                    );


                element.setAttribute(
                    "placeholder",
                    Language.t(
                        key
                    )
                );
            }


            /*
             * Title.
             */

            if (
                element.hasAttribute(
                    "data-i18n-title"
                )
            ) {

                const key =
                    element.getAttribute(
                        "data-i18n-title"
                    );


                element.setAttribute(
                    "title",
                    Language.t(
                        key
                    )
                );
            }


            /*
             * Aria label.
             */

            if (
                element.hasAttribute(
                    "data-i18n-aria"
                )
            ) {

                const key =
                    element.getAttribute(
                        "data-i18n-aria"
                    );


                element.setAttribute(
                    "aria-label",
                    Language.t(
                        key
                    )
                );
            }


            /*
             * Value.
             */

            if (
                element.hasAttribute(
                    "data-i18n-value"
                )
            ) {

                const key =
                    element.getAttribute(
                        "data-i18n-value"
                    );


                element.value =
                    Language.t(
                        key
                    );
            }
        };


    /* ========================================================
       APPLY ALL TRANSLATIONS
       ======================================================== */

    Language.apply =
        function (
            root
        ) {

            root =
                root ||
                document;


            /*
             * Translate root itself.
             */

            if (
                root !== document
            ) {

                Language.translateElement(
                    root
                );
            }


            /*
             * Translate all children.
             */

            root
                .querySelectorAll(
                    [
                        "[data-i18n]",
                        "[data-i18n-html]",
                        "[data-i18n-placeholder]",
                        "[data-i18n-title]",
                        "[data-i18n-aria]",
                        "[data-i18n-value]"
                    ]
                    .join(",")
                )
                .forEach(
                    function (
                        element
                    ) {

                        Language
                            .translateElement(
                                element
                            );
                    }
                );


            /*
             * Update language selectors.
             */

            document
                .querySelectorAll(
                    "[data-language-value]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.value =
                            Language.state
                                .current;
                    }
                );


            document
                .querySelectorAll(
                    "[data-language]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        const value =
                            element.getAttribute(
                                "data-language"
                            );


                        element.classList.toggle(
                            "active",
                            value ===
                            Language.state.current
                        );
                    }
                );


            Language.emit(
                "applied",
                {
                    language:
                        Language.state.current
                }
            );


            return true;
        };


    /* ========================================================
       LANGUAGE SELECTOR
       ======================================================== */

    Language.bindSelectors =
        function () {

            /*
             * Buttons:
             *
             * <button data-language="hi">
             * Hindi
             * </button>
             */

            document
                .querySelectorAll(
                    "[data-language]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.addEventListener(
                            "click",
                            function () {

                                const language =
                                    element
                                        .getAttribute(
                                            "data-language"
                                        );


                                Language.set(
                                    language
                                );
                            }
                        );
                    }
                );


            /*
             * Select:
             *
             * <select data-language-value>
             */

            document
                .querySelectorAll(
                    "[data-language-value]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.value =
                            Language.state
                                .current;


                        element.addEventListener(
                            "change",
                            function () {

                                Language.set(
                                    element.value
                                );
                            }
                        );
                    }
                );
        };


    /* ========================================================
       GET ALL LANGUAGES
       ======================================================== */

    Language.getSupported =
        function () {

            return [
                {
                    code:
                        "en",

                    name:
                        "English",

                    nativeName:
                        "English"
                },

                {
                    code:
                        "hi",

                    name:
                        "Hindi",

                    nativeName:
                        "हिंदी"
                }
            ];
        };


    /* ========================================================
       LANGUAGE NAME
       ======================================================== */

    Language.name =
        function (
            language
        ) {

            language =
                Language.normalize(
                    language
                );


            const item =
                Language.getSupported()
                    .find(
                        function (
                            lang
                        ) {

                            return (
                                lang.code ===
                                language
                            );
                        }
                    );


            return (
                item?.nativeName ||
                language
            );
        };


    /* ========================================================
       USER LANGUAGE
       ======================================================== */

    Language.getUserLanguage =
        function () {

            try {

                const user =
                    RX.auth?.currentUser;


                if (
                    user?.language
                ) {

                    return Language.normalize(
                        user.language
                    );
                }


                const saved =
                    localStorage.getItem(
                        "riderx_user"
                    );


                if (
                    saved
                ) {

                    const data =
                        JSON.parse(
                            saved
                        );


                    if (
                        data.language
                    ) {

                        return Language.normalize(
                            data.language
                        );
                    }
                }

            } catch (error) {}


            return null;
        };


    /* ========================================================
       SAVE USER LANGUAGE
       ======================================================== */

    Language.saveUserLanguage =
        async function (
            language
        ) {

            language =
                Language.normalize(
                    language
                );


            /*
             * Update local user.
             */

            try {

                const saved =
                    localStorage.getItem(
                        "riderx_user"
                    );


                if (
                    saved
                ) {

                    const user =
                        JSON.parse(
                            saved
                        );


                    user.language =
                        language;


                    localStorage.setItem(
                        "riderx_user",
                        JSON.stringify(
                            user
                        )
                    );
                }

            } catch (error) {}


            /*
             * Update Firebase user profile
             * when available.
             */

            try {

                const db =
                    RX.firebase?.firestore ||
                    (
                        window.firebase &&
                        typeof firebase.firestore ===
                        "function"
                            ? firebase.firestore()
                            : null
                    );


                const uid =
                    RX.auth?.currentUser?.uid ||
                    (
                        window.firebase &&
                        firebase.auth &&
                        firebase.auth()
                            .currentUser?.uid
                    );


                if (
                    db &&
                    uid
                ) {

                    await db
                        .collection(
                            "users"
                        )
                        .doc(
                            uid
                        )
                        .set(
                            {
                                language:
                                    language,

                                languageUpdatedAt:
                                    new Date()
                            },
                            {
                                merge:
                                    true
                            }
                        );
                }

            } catch (error) {

                console.warn(
                    "User language sync failed:",
                    error
                );
            }


            return language;
        };


    /* ========================================================
       CHANGE USER LANGUAGE
       ======================================================== */

    Language.changeUserLanguage =
        async function (
            language
        ) {

            const selected =
                Language.set(
                    language
                );


            if (
                !selected
            ) {

                return false;
            }


            await Language
                .saveUserLanguage(
                    selected
                );


            Language.emit(
                "user-language-changed",
                {
                    language:
                        selected
                }
            );


            return selected;
        };


    /* ========================================================
       FORMAT LANGUAGE-AWARE DATE
       ======================================================== */

    Language.formatDate =
        function (
            value,
            options
        ) {

            const date =
                value instanceof Date
                    ? value
                    : new Date(
                        value
                    );


            if (
                isNaN(
                    date.getTime()
                )
            ) {

                return "";
            }


            const locale =
                Language.state.current ===
                "hi"
                    ? "hi-IN"
                    : "en-IN";


            return date.toLocaleDateString(
                locale,
                options || {
                    day:
                        "2-digit",

                    month:
                        "short",

                    year:
                        "numeric"
                }
            );
        };


    /* ========================================================
       FORMAT NUMBER
       ======================================================== */

    Language.formatNumber =
        function (
            value,
            options
        ) {

            const locale =
                Language.state.current ===
                "hi"
                    ? "hi-IN"
                    : "en-IN";


            return Number(
                value || 0
            )
            .toLocaleString(
                locale,
                options || {}
            );
        };


    /* ========================================================
       FORMAT CURRENCY
       ======================================================== */

    Language.formatCurrency =
        function (
            value
        ) {

            const locale =
                Language.state.current ===
                "hi"
                    ? "hi-IN"
                    : "en-IN";


            return Number(
                value || 0
            )
            .toLocaleString(
                locale,
                {
                    style:
                        "currency",

                    currency:
                        "INR",

                    maximumFractionDigits:
                        0
                }
            );
        };


    /* ========================================================
       EVENT SYSTEM
       ======================================================== */

    Language.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-language-" +
                    name,
                    {
                        detail:
                            data || {}
                    }
                )
            );
        };


    Language.on =
        function (
            name,
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {

                return;
            }


            window.addEventListener(
                "riderx-language-" +
                name,
                function (
                    event
                ) {

                    callback(
                        event.detail || {},
                        event
                    );
                }
            );
        };


    /* ========================================================
       INITIALIZATION
       ======================================================== */

    Language.init =
        function () {

            Language.load();


            /*
             * Prefer language saved on
             * logged-in user.
             */

            const userLanguage =
                Language.getUserLanguage();


            if (
                userLanguage &&
                Language.isSupported(
                    userLanguage
                )
            ) {

                Language.state.current =
                    userLanguage;
            }


            try {

                document.documentElement
                    .setAttribute(
                        "lang",
                        Language.state.current
                    );

            } catch (error) {}


            Language.state.ready =
                true;


            /*
             * DOM may already exist.
             */

            if (
                document.readyState !==
                "loading"
            ) {

                Language.apply();

                Language.bindSelectors();
            }


            Language.emit(
                "ready",
                {
                    language:
                        Language.state.current
                }
            );


            return Language.state.current;
        };


    /* ========================================================
       DOM READY
       ======================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        function () {

            Language.init();

        }
    );


    /* ========================================================
       GLOBAL SHORTCUTS
       ======================================================== */

    RX.t =
        Language.t;

    RX.setLanguage =
        Language.set;

    RX.getLanguage =
        Language.get;

    RX.translate =
        Language.apply;


    /* ========================================================
       START
       ======================================================== */

    Language.init();


    console.log(
        "RiderX language.js loaded."
    );

})();

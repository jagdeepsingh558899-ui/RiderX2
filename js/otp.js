/* ============================================================
   RIDERX OTP AUTHENTICATION
   File: js/otp.js

   Handles:
   - Firebase Phone Authentication
   - Send OTP
   - Verify OTP
   - Resend OTP
   - Countdown
   - reCAPTCHA
   - Customer / Rider role
   - Session storage
   - Redirect
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const OTP =
        RX.otp =
        RX.otp || {};


    /* ========================================================
       CONFIG
       ======================================================== */

    OTP.config = {

        otpLength:
            6,

        resendSeconds:
            30,

        verificationTimeout:
            120000,

        authLoginPage:
            "auth/login.html",

        customerHome:
            "customer/home.html",

        riderHome:
            "rider/home.html",

        adminHome:
            "admin/dashboard.html"
    };


    /* ========================================================
       STATE
       ======================================================== */

    OTP.state = {

        initialized:
            false,

        confirmationResult:
            null,

        recaptchaVerifier:
            null,

        recaptchaWidgetId:
            null,

        phone:
            "",

        role:
            "",

        resendTimer:
            null,

        resendRemaining:
            0,

        verificationStarted:
            false,

        verifying:
            false,

        sentAt:
            0
    };


    /* ========================================================
       ELEMENT HELPERS
       ======================================================== */

    OTP.$ =
        function (
            selector
        ) {

            return document.querySelector(
                selector
            );
        };


    OTP.$$ =
        function (
            selector
        ) {

            return Array.from(
                document.querySelectorAll(
                    selector
                )
            );
        };


    OTP.getPhoneInput =
        function () {

            return (
                OTP.$(
                    "#phone"
                ) ||
                OTP.$(
                    "#phoneNumber"
                ) ||
                OTP.$(
                    "[name='phone']"
                ) ||
                OTP.$(
                    "[name='phoneNumber']"
                ) ||
                OTP.$(
                    "[data-phone]"
                )
            );
        };


    OTP.getOtpInput =
        function () {

            return (
                OTP.$(
                    "#otp"
                ) ||
                OTP.$(
                    "#otpCode"
                ) ||
                OTP.$(
                    "[name='otp']"
                ) ||
                OTP.$(
                    "[name='otpCode']"
                ) ||
                OTP.$(
                    "[autocomplete='one-time-code']"
                )
            );
        };


    OTP.getRole =
        function () {

            const roleInput =
                OTP.$(
                    "#role"
                ) ||
                OTP.$(
                    "[name='role']"
                ) ||
                OTP.$(
                    "[data-role]"
                );


            let role =
                roleInput?.value ||
                roleInput?.dataset?.role ||
                localStorage.getItem(
                    "riderx_role"
                ) ||
                "";


            role =
                String(
                    role
                )
                .toLowerCase()
                .trim();


            if (
                role ===
                "driver"
            ) {

                role =
                    "rider";
            }


            if (
                role ===
                "passenger" ||
                role ===
                "user"
            ) {

                role =
                    "customer";
            }


            return role;
        };


    /* ========================================================
       FIREBASE AUTH
       ======================================================== */

    OTP.getAuth =
        function () {

            try {

                if (
                    RX.firebase?.auth
                ) {

                    return RX.firebase.auth;
                }

            } catch (error) {}


            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    return firebase.auth();
                }

            } catch (error) {

                console.error(
                    "Firebase Auth unavailable:",
                    error
                );
            }


            return null;
        };


    /* ========================================================
       NORMALIZE PHONE
       ======================================================== */

    OTP.normalizePhone =
        function (
            value
        ) {

            let phone =
                String(
                    value ||
                    ""
                )
                .trim();


            /*
             * Remove spaces, brackets,
             * hyphens etc.
             */

            phone =
                phone.replace(
                    /[\s()-]/g,
                    ""
                );


            /*
             * Indian 10 digit number.
             */

            if (
                /^[6-9]\d{9}$/
                    .test(
                        phone
                    )
            ) {

                phone =
                    "+91" +
                    phone;
            }


            /*
             * 91XXXXXXXXXX.
             */

            if (
                /^91[6-9]\d{9}$/
                    .test(
                        phone
                    )
            ) {

                phone =
                    "+" +
                    phone;
            }


            return phone;
        };


    /* ========================================================
       PHONE VALIDATION
       ======================================================== */

    OTP.isValidPhone =
        function (
            phone
        ) {

            return /^\+[1-9]\d{7,14}$/
                .test(
                    phone
                );
        };


    /* ========================================================
       OTP VALIDATION
       ======================================================== */

    OTP.isValidCode =
        function (
            code
        ) {

            return new RegExp(
                "^\\d{" +
                OTP.config.otpLength +
                "}$"
            )
            .test(
                String(
                    code ||
                    ""
                )
                .trim()
            );
        };


    /* ========================================================
       MESSAGE UI
       ======================================================== */

    OTP.showMessage =
        function (
            message,
            type
        ) {

            type =
                type ||
                "info";


            const elements =
                OTP.$$(
                    "[data-otp-message], #otpMessage, .otp-message"
                );


            if (
                !elements.length
            ) {

                console.log(
                    "RiderX OTP:",
                    message
                );

                return;
            }


            elements.forEach(
                function (
                    element
                ) {

                    element.textContent =
                        message;


                    element.classList.remove(
                        "success",
                        "error",
                        "warning",
                        "info"
                    );


                    element.classList.add(
                        type
                    );
                }
            );
        };


    /* ========================================================
       LOADING
       ======================================================== */

    OTP.setLoading =
        function (
            loading
        ) {

            OTP.$$(
                "[data-otp-send], #sendOtpBtn, #sendOTP, .send-otp-btn"
            )
            .forEach(
                function (
                    button
                ) {

                    button.disabled =
                        loading;


                    button.classList.toggle(
                        "loading",
                        loading
                    );


                    if (
                        loading
                    ) {

                        button.dataset
                            .originalText =
                            button.textContent;


                        button.textContent =
                            "Sending...";

                    } else if (
                        button.dataset
                            .originalText
                    ) {

                        button.textContent =
                            button.dataset
                                .originalText;
                    }
                }
            );


            OTP.$$(
                "[data-otp-verify], #verifyOtpBtn, #verifyOTP, .verify-otp-btn"
            )
            .forEach(
                function (
                    button
                ) {

                    button.disabled =
                        loading;
                }
            );
        };


    /* ========================================================
       RECAPTCHA
       ======================================================== */

    OTP.setupRecaptcha =
        function () {

            if (
                OTP.state
                    .recaptchaVerifier
            ) {

                return OTP.state
                    .recaptchaVerifier;
            }


            const auth =
                OTP.getAuth();


            if (
                !auth
            ) {

                throw new Error(
                    "Firebase Authentication is not available."
                );
            }


            if (
                !window.firebase?.auth
            ) {

                return null;
            }


            /*
             * Find/create recaptcha
             * container.
             */

            let container =
                document.querySelector(
                    "#recaptcha-container"
                );


            if (
                !container
            ) {

                container =
                    document.createElement(
                        "div"
                    );


                container.id =
                    "recaptcha-container";


                container.style
                    .marginTop =
                    "10px";


                /*
                 * Keep it hidden until
                 * Firebase requires it.
                 */

                document.body.appendChild(
                    container
                );
            }


            try {

                OTP.state
                    .recaptchaVerifier =
                    new firebase.auth
                        .RecaptchaVerifier(
                            "recaptcha-container",
                            {
                                size:
                                    "invisible",

                                callback:
                                    function () {

                                        OTP.showMessage(
                                            "Verification started.",
                                            "info"
                                        );
                                    },

                                "expired-callback":
                                    function () {

                                        OTP.showMessage(
                                            "Security verification expired. Please try again.",
                                            "warning"
                                        );


                                        OTP.clearRecaptcha();
                                    }
                            },
                            auth
                        );


                return OTP.state
                    .recaptchaVerifier;

            } catch (error) {

                console.error(
                    "reCAPTCHA setup error:",
                    error
                );


                throw error;
            }
        };


    /* ========================================================
       CLEAR RECAPTCHA
       ======================================================== */

    OTP.clearRecaptcha =
        function () {

            try {

                if (
                    OTP.state
                        .recaptchaVerifier
                ) {

                    OTP.state
                        .recaptchaVerifier
                        .clear();
                }

            } catch (error) {}


            OTP.state
                .recaptchaVerifier =
                null;


            OTP.state
                .recaptchaWidgetId =
                null;
        };


    /* ========================================================
       SEND OTP
       ======================================================== */

    OTP.send =
        async function (
            phone,
            role
        ) {

            try {

                OTP.setLoading(
                    true
                );


                phone =
                    OTP.normalizePhone(
                        phone ||
                        OTP.getPhoneInput()
                            ?.value
                    );


                role =
                    String(
                        role ||
                        OTP.getRole() ||
                        "customer"
                    )
                    .toLowerCase();


                if (
                    !OTP.isValidPhone(
                        phone
                    )
                ) {

                    throw new Error(
                        "Please enter a valid mobile number."
                    );
                }


                if (
                    ![
                        "customer",
                        "rider",
                        "admin"
                    ]
                    .includes(
                        role
                    )
                ) {

                    role =
                        "customer";
                }


                const auth =
                    OTP.getAuth();


                if (
                    !auth
                ) {

                    throw new Error(
                        "Firebase Authentication is not configured."
                    );
                }


                OTP.state.phone =
                    phone;


                OTP.state.role =
                    role;


                OTP.state.sentAt =
                    Date.now();


                OTP.state
                    .verificationStarted =
                    true;


                /*
                 * Save selected role.
                 */

                localStorage.setItem(
                    "riderx_role",
                    role
                );


                localStorage.setItem(
                    "riderx_phone",
                    phone
                );


                const verifier =
                    OTP.setupRecaptcha();


                OTP.state
                    .confirmationResult =
                    await auth
                        .signInWithPhoneNumber(
                            phone,
                            verifier
                        );


                OTP.showMessage(
                    "OTP sent successfully to " +
                    OTP.maskPhone(
                        phone
                    ),
                    "success"
                );


                OTP.showOtpSection();

                OTP.startTimer();

                OTP.focusOtp();


                OTP.emit(
                    "sent",
                    {
                        phone:
                            phone,

                        role:
                            role
                    }
                );


                return {

                    success:
                        true,

                    phone:
                        phone,

                    role:
                        role
                };

            } catch (error) {

                console.error(
                    "OTP send error:",
                    error
                );


                OTP.handleFirebaseError(
                    error
                );


                OTP.clearRecaptcha();


                return {

                    success:
                        false,

                    error:
                        error
                };

            } finally {

                OTP.setLoading(
                    false
                );
            }
        };


    /* ========================================================
       VERIFY OTP
       ======================================================== */

    OTP.verify =
        async function (
            code
        ) {

            if (
                OTP.state.verifying
            ) {

                return false;
            }


            try {

                OTP.state.verifying =
                    true;


                code =
                    String(
                        code ||
                        OTP.getOtpInput()
                            ?.value ||
                        ""
                    )
                    .replace(
                        /\D/g,
                        ""
                    );


                if (
                    !OTP.isValidCode(
                        code
                    )
                ) {

                    throw new Error(
                        "Please enter the complete 6-digit OTP."
                    );
                }


                if (
                    !OTP.state
                        .confirmationResult
                ) {

                    throw new Error(
                        "Please request a new OTP first."
                    );
                }


                /*
                 * OTP timeout.
                 */

                if (
                    OTP.state.sentAt &&
                    Date.now() -
                    OTP.state.sentAt >
                    OTP.config
                        .verificationTimeout
                ) {

                    OTP.state
                        .confirmationResult =
                        null;


                    throw new Error(
                        "This OTP has expired. Please request a new OTP."
                    );
                }


                OTP.showMessage(
                    "Verifying OTP...",
                    "info"
                );


                const result =
                    await OTP.state
                        .confirmationResult
                        .confirm(
                            code
                        );


                const user =
                    result.user;


                if (
                    !user
                ) {

                    throw new Error(
                        "Authentication failed."
                    );
                }


                /*
                 * Build RiderX session.
                 */

                const session = {

                    uid:
                        user.uid,

                    phone:
                        user.phoneNumber ||
                        OTP.state.phone,

                    role:
                        OTP.state.role ||
                        "customer",

                    displayName:
                        user.displayName ||
                        "",

                    email:
                        user.email ||
                        "",

                    photoURL:
                        user.photoURL ||
                        "",

                    authenticated:
                        true,

                    loginMethod:
                        "phone",

                    loginAt:
                        Date.now()
                };


                /*
                 * Save session.
                 */

                localStorage.setItem(
                    "riderx_uid",
                    session.uid
                );


                localStorage.setItem(
                    "riderx_role",
                    session.role
                );


                localStorage.setItem(
                    "riderx_phone",
                    session.phone
                );


                localStorage.setItem(
                    "riderx_user",
                    JSON.stringify(
                        session
                    )
                );


                /*
                 * Update Firebase
                 * auth helper if available.
                 */

                if (
                    RX.auth &&
                    typeof RX.auth.setSession ===
                    "function"
                ) {

                    try {

                        RX.auth.setSession(
                            session
                        );

                    } catch (error) {}
                }


                OTP.stopTimer();


                OTP.state
                    .confirmationResult =
                    null;


                OTP.state
                    .verificationStarted =
                    false;


                OTP.showMessage(
                    "OTP verified successfully.",
                    "success"
                );


                OTP.emit(
                    "verified",
                    {
                        user:
                            user,

                        session:
                            session
                    }
                );


                /*
                 * Small delay gives UI time
                 * to show success.
                 */

                setTimeout(
                    function () {

                        OTP.redirect(
                            session.role
                        );

                    },
                    350
                );


                return {

                    success:
                        true,

                    user:
                        user,

                    session:
                        session
                };

            } catch (error) {

                console.error(
                    "OTP verification error:",
                    error
                );


                OTP.handleFirebaseError(
                    error
                );


                return {

                    success:
                        false,

                    error:
                        error
                };

            } finally {

                OTP.state.verifying =
                    false;
            }
        };


    /* ========================================================
       RESEND OTP
       ======================================================== */

    OTP.resend =
        async function () {

            if (
                OTP.state
                    .resendRemaining >
                0
            ) {

                OTP.showMessage(
                    "Please wait " +
                    OTP.state
                        .resendRemaining +
                    " seconds before requesting another OTP.",
                    "warning"
                );


                return false;
            }


            if (
                !OTP.state.phone
            ) {

                const phoneInput =
                    OTP.getPhoneInput();


                if (
                    phoneInput
                ) {

                    OTP.state.phone =
                        OTP.normalizePhone(
                            phoneInput.value
                        );
                }
            }


            if (
                !OTP.state.phone
            ) {

                OTP.showMessage(
                    "Please enter your mobile number.",
                    "error"
                );


                return false;
            }


            OTP.clearRecaptcha();


            return OTP.send(
                OTP.state.phone,
                OTP.state.role
            );
        };


    /* ========================================================
       TIMER
       ======================================================== */

    OTP.startTimer =
        function () {

            OTP.stopTimer();


            OTP.state
                .resendRemaining =
                OTP.config
                    .resendSeconds;


            OTP.updateTimerUI();


            OTP.state.resendTimer =
                setInterval(
                    function () {

                        OTP.state
                            .resendRemaining--;


                        OTP.updateTimerUI();


                        if (
                            OTP.state
                                .resendRemaining <=
                            0
                        ) {

                            OTP.stopTimer();
                        }

                    },
                    1000
                );
        };


    OTP.stopTimer =
        function () {

            if (
                OTP.state.resendTimer
            ) {

                clearInterval(
                    OTP.state.resendTimer
                );
            }


            OTP.state.resendTimer =
                null;


            OTP.state
                .resendRemaining =
                0;


            OTP.updateTimerUI();
        };


    /* ========================================================
       TIMER UI
       ======================================================== */

    OTP.updateTimerUI =
        function () {

            const remaining =
                OTP.state
                    .resendRemaining;


            OTP.$$(
                "[data-otp-timer], #otpTimer, .otp-timer"
            )
            .forEach(
                function (
                    element
                ) {

                    if (
                        remaining > 0
                    ) {

                        element.textContent =
                            "Resend OTP in " +
                            remaining +
                            "s";

                    } else {

                        element.textContent =
                            "Resend OTP";
                    }
                }
            );


            OTP.$$(
                "[data-otp-resend], #resendOtpBtn, #resendOTP, .resend-otp-btn"
            )
            .forEach(
                function (
                    button
                ) {

                    button.disabled =
                        remaining > 0;

                    button.classList.toggle(
                        "disabled",
                        remaining > 0
                    );
                }
            );
        };


    /* ========================================================
       SHOW OTP SECTION
       ======================================================== */

    OTP.showOtpSection =
        function () {

            OTP.$$(
                "[data-otp-section], #otpSection, .otp-section"
            )
            .forEach(
                function (
                    section
                ) {

                    section.classList.add(
                        "active"
                    );

                    section.hidden =
                        false;
                }
            );


            OTP.$$(
                "[data-phone-section], #phoneSection, .phone-section"
            )
            .forEach(
                function (
                    section
                ) {

                    section.classList.add(
                        "otp-sent"
                    );
                }
            );
        };


    /* ========================================================
       FOCUS OTP
       ======================================================== */

    OTP.focusOtp =
        function () {

            const input =
                OTP.getOtpInput();


            if (
                !input
            ) {

                return;
            }


            setTimeout(
                function () {

                    input.focus();

                },
                100
            );
        };


    /* ========================================================
       MASK PHONE
       ======================================================== */

    OTP.maskPhone =
        function (
            phone
        ) {

            phone =
                String(
                    phone ||
                    ""
                );


            if (
                phone.length < 7
            ) {

                return phone;
            }


            return (
                phone.slice(
                    0,
                    3
                ) +
                "****" +
                phone.slice(
                    -3
                )
            );
        };


    /* ========================================================
       REDIRECT
       ======================================================== */

    OTP.redirect =
        function (
            role
        ) {

            role =
                String(
                    role ||
                    "customer"
                )
                .toLowerCase();


            let destination =
                OTP.config
                    .customerHome;


            if (
                role ===
                "rider"
            ) {

                destination =
                    OTP.config
                        .riderHome;
            }


            if (
                role ===
                "admin"
            ) {

                destination =
                    OTP.config
                        .adminHome;
            }


            window.location.href =
                destination;
        };


    /* ========================================================
       FIREBASE ERROR HANDLER
       ======================================================== */

    OTP.handleFirebaseError =
        function (
            error
        ) {

            const code =
                error?.code ||
                "";


            let message =
                "Something went wrong. Please try again.";


            switch (
                code
            ) {

                case
                    "auth/invalid-phone-number":

                    message =
                        "Please enter a valid mobile number.";

                    break;


                case
                    "auth/missing-phone-number":

                    message =
                        "Please enter your mobile number.";

                    break;


                case
                    "auth/quota-exceeded":

                    message =
                        "OTP limit reached. Please try again later.";

                    break;


                case
                    "auth/too-many-requests":

                    message =
                        "Too many attempts. Please wait and try again.";

                    break;


                case
                    "auth/invalid-verification-code":

                    message =
                        "Incorrect OTP. Please check and try again.";

                    break;


                case
                    "auth/code-expired":

                    message =
                        "OTP expired. Please request a new OTP.";

                    break;


                case
                    "auth/session-expired":

                    message =
                        "Verification session expired. Please request a new OTP.";

                    break;


                case
                    "auth/captcha-check-failed":

                    message =
                        "Security verification failed. Please try again.";

                    break;


                case
                    "auth/app-not-authorized":

                    message =
                        "This app is not authorized for Firebase Phone Authentication.";

                    break;


                case
                    "auth/operation-not-allowed":

                    message =
                        "Phone authentication is not enabled in Firebase.";

                    break;


                case
                    "auth/network-request-failed":

                    message =
                        "Network error. Please check your internet connection.";

                    break;


                case
                    "auth/user-disabled":

                    message =
                        "This account has been disabled.";

                    break;


                default:

                    if (
                        error?.message
                    ) {

                        message =
                            error.message;
                    }
            }


            OTP.showMessage(
                message,
                "error"
            );


            OTP.emit(
                "error",
                {
                    code:
                        code,

                    message:
                        message,

                    error:
                        error
                }
            );
        };


    /* ========================================================
       AUTO OTP INPUT
       ======================================================== */

    OTP.setupOtpInput =
        function () {

            const input =
                OTP.getOtpInput();


            if (
                !input
            ) {

                return;
            }


            input.setAttribute(
                "inputmode",
                "numeric"
            );


            input.setAttribute(
                "autocomplete",
                "one-time-code"
            );


            input.setAttribute(
                "maxlength",
                String(
                    OTP.config
                        .otpLength
                )
            );


            input.addEventListener(
                "input",
                function () {

                    let value =
                        input.value
                            .replace(
                                /\D/g,
                                ""
                            );


                    if (
                        value.length >
                        OTP.config
                            .otpLength
                    ) {

                        value =
                            value.slice(
                                0,
                                OTP.config
                                    .otpLength
                            );
                    }


                    input.value =
                        value;


                    /*
                     * Auto verify when
                     * 6 digits are entered.
                     */

                    if (
                        value.length ===
                        OTP.config
                            .otpLength
                    ) {

                        OTP.verify(
                            value
                        );
                    }
                }
            );
        };


    /* ========================================================
       BUTTON EVENTS
       ======================================================== */

    OTP.bindEvents =
        function () {

            /*
             * Send OTP.
             */

            OTP.$$(
                "[data-otp-send], #sendOtpBtn, #sendOTP, .send-otp-btn"
            )
            .forEach(
                function (
                    button
                ) {

                    button.addEventListener(
                        "click",
                        function (
                            event
                        ) {

                            event.preventDefault();


                            OTP.send();
                        }
                    );
                }
            );


            /*
             * Verify OTP.
             */

            OTP.$$(
                "[data-otp-verify], #verifyOtpBtn, #verifyOTP, .verify-otp-btn"
            )
            .forEach(
                function (
                    button
                ) {

                    button.addEventListener(
                        "click",
                        function (
                            event
                        ) {

                            event.preventDefault();


                            OTP.verify();
                        }
                    );
                }
            );


            /*
             * Resend.
             */

            OTP.$$(
                "[data-otp-resend], #resendOtpBtn, #resendOTP, .resend-otp-btn"
            )
            .forEach(
                function (
                    button
                ) {

                    button.addEventListener(
                        "click",
                        function (
                            event
                        ) {

                            event.preventDefault();


                            OTP.resend();
                        }
                    );
                }
            );


            /*
             * Enter key.
             */

            const otpInput =
                OTP.getOtpInput();


            if (
                otpInput
            ) {

                otpInput.addEventListener(
                    "keydown",
                    function (
                        event
                    ) {

                        if (
                            event.key ===
                            "Enter"
                        ) {

                            event.preventDefault();

                            OTP.verify();
                        }
                    }
                );
            }


            const phoneInput =
                OTP.getPhoneInput();


            if (
                phoneInput
            ) {

                phoneInput.addEventListener(
                    "keydown",
                    function (
                        event
                    ) {

                        if (
                            event.key ===
                            "Enter"
                        ) {

                            event.preventDefault();

                            OTP.send();
                        }
                    }
                );
            }
        };


    /* ========================================================
       EVENTS
       ======================================================== */

    OTP.emit =
        function (
            name,
            data
        ) {

            window.dispatchEvent(
                new CustomEvent(
                    "riderx-otp-" +
                    name,
                    {
                        detail:
                            data || {}
                    }
                )
            );
        };


    OTP.on =
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
                "riderx-otp-" +
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
       INIT
       ======================================================== */

    OTP.init =
        function () {

            if (
                OTP.state
                    .initialized
            ) {

                return;
            }


            OTP.state
                .initialized =
                true;


            OTP.setupOtpInput();

            OTP.bindEvents();

            OTP.updateTimerUI();


            /*
             * Restore phone/role.
             */

            try {

                const phone =
                    localStorage.getItem(
                        "riderx_phone"
                    );


                if (
                    phone &&
                    OTP.getPhoneInput()
                ) {

                    OTP.getPhoneInput()
                        .value =
                        phone;
                }

            } catch (error) {}


            console.log(
                "RiderX otp.js loaded."
            );
        };


    /* ========================================================
       GLOBAL API
       ======================================================== */

    RX.sendOTP =
        OTP.send;

    RX.verifyOTP =
        OTP.verify;

    RX.resendOTP =
        OTP.resend;


    /* ========================================================
       START
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            OTP.init
        );

    } else {

        OTP.init();
    }


})();

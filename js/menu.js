/* ============================================================
   RIDERX MENU & NAVIGATION
   File: js/menu.js

   Handles:
   - Customer menu
   - Rider menu
   - Admin menu
   - Mobile drawer
   - Active navigation
   - Role based navigation
   - Logout
   - Firebase/Auth compatible logout
   - User profile display
   - Safe root-relative navigation
   - Rider home = rider/home.html
   - Customer home = customer/home.html
   - No dependency on rider/home.html
   ============================================================ */

(function () {

    "use strict";


    /* ========================================================
       GLOBAL NAMESPACE
    ======================================================== */

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Menu =
        RX.menu =
        RX.menu || {};


    /* ========================================================
       CONFIGURATION
       ========================================================

       IMPORTANT:
       These paths are PROJECT-ROOT paths.

       Navigation is resolved relative to the current project
       root instead of the current HTML folder.

       Rider:
         rider/home.html = canonical rider home

       Customer:
         customer/home.html = canonical customer home

       Admin:
         admin/dashboard.html = admin dashboard

    ======================================================== */

    Menu.config = {

        customer: {

            home:
                "customer/home.html",

            dashboard:
                "customer/dashboard.html",

            booking:
                "customer/booking.html",

            rides:
                "customer/history.html",

            history:
                "customer/history.html",

            wallet:
                "customer/wallet.html",

            notifications:
                "customer/notifications.html",

            profile:
                "customer/profile.html",

            settings:
                "customer/settings.html",

            support:
                "customer/menu.html",

            menu:
                "customer/menu.html"
        },


        rider: {

            home:
                "rider/home.html",

            /*
             * dashboard intentionally points to home.
             *
             * rider/dashboard.html was removed.
             */

            dashboard:
                "rider/home.html",

            rides:
                "rider/rides.html",

            requests:
                "rider/requests.html",

            history:
                "rider/history.html",

            earnings:
                "rider/earnings.html",

            wallet:
                "rider/wallet.html",

            notifications:
                "rider/notifications.html",

            profile:
                "rider/profile.html",

            settings:
                "rider/settings.html",

            support:
                "rider/menu.html",

            menu:
                "rider/menu.html"
        },


        admin: {

            home:
                "admin/dashboard.html",

            dashboard:
                "admin/dashboard.html",

            customers:
                "admin/customers.html",

            riders:
                "admin/riders.html",

            rides:
                "admin/rides.html",

            payments:
                "admin/payments.html",

            reports:
                "admin/reports.html",

            notifications:
                "admin/notifications.html",

            settings:
                "admin/settings.html",

            supports:
                "admin/supports.html",

            menu:
                "admin/menu.html"
        }

    };


    /* ========================================================
       PROJECT ROOT
    ======================================================== */

    Menu.getProjectRoot =
        function () {

            /*
             * Detect project root from the current page.
             *
             * Examples:
             *
             * /RiderX2/rider/home.html
             *       -> /RiderX2/
             *
             * /RiderX2/customer/home.html
             *       -> /RiderX2/
             *
             * /RiderX2/admin/dashboard.html
             *       -> /RiderX2/
             *
             * This avoids:
             *
             * rider/rider/home.html
             * rider/auth/login.html
             * customer/customer/home.html
             */

            const path =
                window.location.pathname;


            const parts =
                path
                    .split("/")
                    .filter(Boolean);


            if (
                parts.length === 0
            ) {

                return "/";

            }


            /*
             * Known project folders.
             */

            const knownFolders = [
                "rider",
                "customer",
                "admin",
                "auth",
                "firebase",
                "js",
                "css"
            ];


            const folderIndex =
                parts.findIndex(
                    function (part) {

                        return knownFolders.includes(
                            part.toLowerCase()
                        );

                    }
                );


            if (
                folderIndex > 0
            ) {

                return (
                    "/" +
                    parts
                        .slice(
                            0,
                            folderIndex
                        )
                        .join("/") +
                    "/"
                );

            }


            /*
             * If no known folder is found,
             * assume current directory is project root.
             */

            if (
                parts.length === 1
            ) {

                return "/";

            }


            return (
                "/" +
                parts
                    .slice(
                        0,
                        parts.length - 1
                    )
                    .join("/") +
                "/"
            );
        };


    /* ========================================================
       USER
    ======================================================== */

    Menu.getUser =
        function () {

            /*
             * RiderX auth module.
             */

            try {

                if (
                    RX.auth &&
                    RX.auth.currentUser
                ) {

                    return RX.auth.currentUser;

                }

            } catch (error) {

                console.warn(
                    "RiderX auth user unavailable:",
                    error
                );

            }


            /*
             * Firebase v8/v9 compatibility.
             */

            try {

                if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    const user =
                        firebase
                            .auth()
                            .currentUser;


                    if (
                        user
                    ) {

                        return user;

                    }

                }

            } catch (error) {

                console.warn(
                    "Firebase auth user unavailable:",
                    error
                );

            }


            /*
             * Local fallback.
             */

            try {

                const saved =
                    localStorage.getItem(
                        "riderx_user"
                    );


                if (
                    saved
                ) {

                    return JSON.parse(
                        saved
                    );

                }

            } catch (error) {

                console.warn(
                    "Unable to read riderx_user:",
                    error
                );

            }


            return null;
        };


    /* ========================================================
       ROLE
    ======================================================== */

    Menu.getRole =
        function () {

            const user =
                Menu.getUser();


            let role =
                user?.role ||
                user?.userRole ||
                user?.accountType ||
                user?.type ||
                localStorage.getItem(
                    "riderx_role"
                );


            role =
                String(
                    role || ""
                )
                .toLowerCase()
                .trim();


            /*
             * Normalize common role names.
             */

            if (
                role === "driver" ||
                role === "delivery_driver" ||
                role === "bike_driver"
            ) {

                role =
                    "rider";

            }


            if (
                role === "passenger" ||
                role === "user" ||
                role === "customer_user"
            ) {

                role =
                    "customer";

            }


            if (
                role === "administrator"
            ) {

                role =
                    "admin";

            }


            return role;
        };


    /* ========================================================
       USER ID
    ======================================================== */

    Menu.getUserId =
        function () {

            const user =
                Menu.getUser();


            return (
                user?.uid ||
                user?.id ||
                user?.userId ||
                localStorage.getItem(
                    "riderx_uid"
                ) ||
                null
            );
        };


    /* ========================================================
       CURRENT PAGE
    ======================================================== */

    Menu.getCurrentPage =
        function () {

            const pathname =
                window.location.pathname;


            const parts =
                pathname
                    .split("/")
                    .filter(Boolean);


            return (
                parts
                    .pop()
                    ?.toLowerCase() ||
                "index.html"
            );
        };


    /* ========================================================
       CURRENT SECTION
    ======================================================== */

    Menu.getCurrentSection =
        function () {

            const pathname =
                window.location.pathname
                    .toLowerCase();


            if (
                pathname.includes(
                    "/rider/"
                )
            ) {

                return "rider";

            }


            if (
                pathname.includes(
                    "/customer/"
                )
            ) {

                return "customer";

            }


            if (
                pathname.includes(
                    "/admin/"
                )
            ) {

                return "admin";

            }


            return null;
        };


    /* ========================================================
       NORMALIZE PAGE
    ======================================================== */

    Menu.normalizePage =
        function (
            page
        ) {

            if (
                !page
            ) {

                return "";

            }


            return String(
                page
            )
            .split("?")[0]
            .split("#")[0]
            .split("/")
            .pop()
            .toLowerCase();
        };


    /* ========================================================
       IS EXTERNAL URL
    ======================================================== */

    Menu.isExternal =
        function (
            url
        ) {

            return /^https?:\/\//i.test(
                String(
                    url || ""
                )
            );

        };


    /* ========================================================
       ROOT PATH
    ======================================================== */

    Menu.toRootPath =
        function (
            destination
        ) {

            if (
                !destination
            ) {

                return null;

            }


            const value =
                String(
                    destination
                ).trim();


            if (
                !value
            ) {

                return null;

            }


            /*
             * External URL.
             */

            if (
                Menu.isExternal(
                    value
                )
            ) {

                return value;

            }


            /*
             * Protocol-relative URL.
             */

            if (
                value.startsWith("//")
            ) {

                return value;

            }


            /*
             * Root absolute URL.
             */

            if (
                value.startsWith("/")
            ) {

                return value;

            }


            const root =
                Menu.getProjectRoot();


            return (
                root +
                value.replace(
                    /^\.?\//,
                    ""
                )
            );
        };


    /* ========================================================
       RESOLVE DESTINATION
    ======================================================== */

    Menu.resolve =
        function (
            destination
        ) {

            if (
                !destination
            ) {

                return null;

            }


            const value =
                String(
                    destination
                ).trim();


            if (
                !value
            ) {

                return null;

            }


            /*
             * Known route alias.
             */

            const role =
                Menu.getRole();


            const routes =
                Menu.config[
                    role
                ];


            if (
                routes &&
                Object.prototype.hasOwnProperty.call(
                    routes,
                    value
                )
            ) {

                return Menu.toRootPath(
                    routes[value]
                );

            }


            /*
             * Explicit project path.
             */

            return Menu.toRootPath(
                value
            );
        };


    /* ========================================================
       NAVIGATE
    ======================================================== */

    Menu.navigate =
        function (
            destination
        ) {

            const url =
                Menu.resolve(
                    destination
                );


            if (
                !url
            ) {

                console.warn(
                    "RiderX navigation: invalid destination",
                    destination
                );

                return false;

            }


            /*
             * External URL.
             */

            if (
                Menu.isExternal(
                    url
                )
            ) {

                window.location.href =
                    url;

                return true;

            }


            /*
             * Same-page protection.
             */

            const current =
                window.location.pathname +
                window.location.search;


            const targetUrl =
                new URL(
                    url,
                    window.location.origin
                );


            const target =
                targetUrl.pathname +
                targetUrl.search;


            if (
                current === target
            ) {

                Menu.close();

                return true;

            }


            Menu.close();


            window.location.href =
                url;


            return true;
        };


    /* ========================================================
       ROLE HOME
    ======================================================== */

    Menu.getHome =
        function (
            role
        ) {

            role =
                role ||
                Menu.getRole();


            return (
                Menu.config[
                    role
                ]?.home ||
                "index.html"
            );
        };


    /* ========================================================
       IS ALLOWED
    ======================================================== */

    Menu.isAllowed =
        function (
            url
        ) {

            const role =
                Menu.getRole();


            if (
                !role
            ) {

                return false;

            }


            const normalized =
                String(
                    url || ""
                )
                .toLowerCase();


            /*
             * Admin.
             */

            if (
                role === "admin"
            ) {

                return normalized.includes(
                    "/admin/"
                );

            }


            /*
             * Rider.
             */

            if (
                role === "rider"
            ) {

                return normalized.includes(
                    "/rider/"
                );

            }


            /*
             * Customer.
             */

            if (
                role === "customer"
            ) {

                return normalized.includes(
                    "/customer/"
                );

            }


            return false;
        };


    /* ========================================================
       PUBLIC PAGE CHECK
    ======================================================== */

    Menu.isPublicPage =
        function () {

            const path =
                window.location.pathname
                    .toLowerCase();


            const current =
                Menu.getCurrentPage();


            const publicPages = [

                "",

                "index.html",

                "login.html",

                "register.html",

                "otp-login.html",

                "verify-otp.html",

                "customer-login.html",

                "rider-login.html",

                "role.html"

            ];


            /*
             * Auth folder pages are public.
             */

            if (
                path.includes(
                    "/auth/"
                )
            ) {

                return true;

            }


            return publicPages.includes(
                current
            );
        };


    /* ========================================================
       ROLE GUARD
    ======================================================== */

    Menu.guardCurrentPage =
        function () {

            /*
             * Public pages do not require role.
             */

            if (
                Menu.isPublicPage()
            ) {

                return true;

            }


            const path =
                window.location.pathname
                    .toLowerCase();


            const role =
                Menu.getRole();


            /*
             * No known protected section.
             */

            const isRider =
                path.includes(
                    "/rider/"
                );


            const isCustomer =
                path.includes(
                    "/customer/"
                );


            const isAdmin =
                path.includes(
                    "/admin/"
                );


            if (
                !isRider &&
                !isCustomer &&
                !isAdmin
            ) {

                return true;

            }


            /*
             * No role/session.
             */

            if (
                !role
            ) {

                Menu.redirectToLogin();

                return false;

            }


            /*
             * Admin.
             */

            if (
                isAdmin &&
                role !== "admin"
            ) {

                Menu.redirectToLogin();

                return false;

            }


            /*
             * Rider.
             */

            if (
                isRider &&
                role !== "rider"
            ) {

                Menu.redirectToLogin();

                return false;

            }


            /*
             * Customer.
             */

            if (
                isCustomer &&
                role !== "customer"
            ) {

                Menu.redirectToLogin();

                return false;

            }


            return true;
        };


    /* ========================================================
       LOGIN REDIRECT
    ======================================================== */

    Menu.redirectToLogin =
        function () {

            const loginUrl =
                Menu.toRootPath(
                    "auth/login.html"
                );


            if (
                loginUrl
            ) {

                window.location.replace(
                    loginUrl
                );

            }
        };


    /* ========================================================
       ACTIVE NAVIGATION
    ======================================================== */

    Menu.setActive =
        function () {

            const current =
                Menu.getCurrentPage();


            const links =
                document.querySelectorAll(
                    "[data-menu], [data-nav], .menu-link, .nav-link"
                );


            links.forEach(
                function (
                    link
                ) {

                    const href =
                        link.getAttribute(
                            "href"
                        );


                    const dataPage =
                        link.getAttribute(
                            "data-menu"
                        ) ||
                        link.getAttribute(
                            "data-nav"
                        );


                    /*
                     * Do not treat "#" as a page.
                     */

                    if (
                        !dataPage &&
                        (
                            !href ||
                            href === "#"
                        )
                    ) {

                        return;

                    }


                    const target =
                        Menu.normalizePage(
                            dataPage ||
                            href
                        );


                    /*
                     * dashboard.html is an alias for
                     * rider/home.html.
                     */

                    let active =
                        target === current;


                    if (
                        Menu.getCurrentSection() ===
                        "rider"
                    ) {

                        if (
                            current ===
                            "home.html" &&
                            target ===
                            "dashboard.html"
                        ) {

                            active = true;

                        }

                    }


                    if (
                        active
                    ) {

                        link.classList.add(
                            "active"
                        );

                        link.setAttribute(
                            "aria-current",
                            "page"
                        );

                    } else {

                        link.classList.remove(
                            "active"
                        );

                        link.removeAttribute(
                            "aria-current"
                        );

                    }
                }
            );
        };


    /* ========================================================
       DRAWER
    ======================================================== */

    Menu.getDrawer =
        function () {

            return (
                document.querySelector(
                    "#sideMenu"
                ) ||
                document.querySelector(
                    "#mobileMenu"
                ) ||
                document.querySelector(
                    ".side-menu"
                ) ||
                document.querySelector(
                    ".mobile-menu"
                ) ||
                document.querySelector(
                    ".menu-drawer"
                )
            );
        };


    /* ========================================================
       OVERLAY
    ======================================================== */

    Menu.getOverlay =
        function () {

            return (
                document.querySelector(
                    "#menuOverlay"
                ) ||
                document.querySelector(
                    ".menu-overlay"
                ) ||
                document.querySelector(
                    ".drawer-overlay"
                )
            );
        };


    /* ========================================================
       OPEN MENU
    ======================================================== */

    Menu.open =
        function () {

            const drawer =
                Menu.getDrawer();


            const overlay =
                Menu.getOverlay();


            if (
                drawer
            ) {

                drawer.classList.add(
                    "open"
                );

                drawer.classList.add(
                    "active"
                );

                drawer.setAttribute(
                    "aria-hidden",
                    "false"
                );

            }


            if (
                overlay
            ) {

                overlay.classList.add(
                    "open"
                );

                overlay.classList.add(
                    "active"
                );

                overlay.setAttribute(
                    "aria-hidden",
                    "false"
                );

            }


            document.body.classList.add(
                "menu-open"
            );


            Menu.emit(
                "opened"
            );
        };


    /* ========================================================
       CLOSE MENU
    ======================================================== */

    Menu.close =
        function () {

            const drawer =
                Menu.getDrawer();


            const overlay =
                Menu.getOverlay();


            if (
                drawer
            ) {

                drawer.classList.remove(
                    "open"
                );

                drawer.classList.remove(
                    "active"
                );

                drawer.setAttribute(
                    "aria-hidden",
                    "true"
                );

            }


            if (
                overlay
            ) {

                overlay.classList.remove(
                    "open"
                );

                overlay.classList.remove(
                    "active"
                );

                overlay.setAttribute(
                    "aria-hidden",
                    "true"
                );

            }


            document.body.classList.remove(
                "menu-open"
            );


            Menu.emit(
                "closed"
            );
        };


    /* ========================================================
       TOGGLE MENU
    ======================================================== */

    Menu.toggle =
        function () {

            const drawer =
                Menu.getDrawer();


            if (
                drawer &&
                (
                    drawer.classList.contains(
                        "open"
                    ) ||
                    drawer.classList.contains(
                        "active"
                    )
                )
            ) {

                Menu.close();

            } else {

                Menu.open();

            }
        };


    /* ========================================================
       PROFILE UPDATE
    ======================================================== */

    Menu.updateProfile =
        function () {

            const user =
                Menu.getUser();


            if (
                !user
            ) {

                return;

            }


            const name =
                user.name ||
                user.displayName ||
                user.fullName ||
                user.riderName ||
                user.customerName ||
                "RiderX User";


            const email =
                user.email ||
                "";


            const phone =
                user.phone ||
                user.phoneNumber ||
                "";


            const photo =
                user.photoURL ||
                user.photo ||
                user.profilePhoto ||
                "";


            document
                .querySelectorAll(
                    "[data-user-name], .user-name"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            name;

                    }
                );


            document
                .querySelectorAll(
                    "[data-user-email], .user-email"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            email;

                    }
                );


            document
                .querySelectorAll(
                    "[data-user-phone], .user-phone"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.textContent =
                            phone;

                    }
                );


            if (
                photo
            ) {

                document
                    .querySelectorAll(
                        "[data-user-photo], .user-photo"
                    )
                    .forEach(
                        function (
                            element
                        ) {

                            if (
                                element.tagName ===
                                "IMG"
                            ) {

                                element.src =
                                    photo;

                                element.alt =
                                    name;

                            }

                        }
                    );
            }
        };


    /* ========================================================
       LOGOUT
    ======================================================== */

    Menu.logout =
        async function () {

            const confirmed =
                window.confirm(
                    "Are you sure you want to logout?"
                );


            if (
                !confirmed
            ) {

                return false;

            }


            Menu.emit(
                "logout-start"
            );


            try {

                /*
                 * RiderX auth module.
                 */

                if (
                    RX.auth &&
                    typeof RX.auth.logout ===
                    "function"
                ) {

                    await RX.auth.logout();

                }

                /*
                 * Firebase v8 fallback.
                 */

                else if (
                    window.firebase &&
                    typeof firebase.auth ===
                    "function"
                ) {

                    await firebase
                        .auth()
                        .signOut();

                }

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

            }


            /*
             * Clear RiderX local session.
             */

            const localKeys = [

                "riderx_user",

                "riderx_uid",

                "riderx_role",

                "riderx_token",

                "riderx_session",

                "riderx_customer",

                "riderx_rider",

                "riderx_admin",

                "riderx_current_ride",

                "riderx_active_ride"

            ];


            localKeys.forEach(
                function (
                    key
                ) {

                    try {

                        localStorage.removeItem(
                            key
                        );

                    } catch (error) {}

                }
            );


            /*
             * Clear session storage.
             */

            try {

                sessionStorage.clear();

            } catch (error) {}


            Menu.emit(
                "logout-complete"
            );


            /*
             * Always use project-root login path.
             */

            Menu.redirectToLogin();


            return true;
        };


    /* ========================================================
       EVENT BINDING
    ======================================================== */

    Menu.bind =
        function () {

            /*
             * Prevent duplicate binding if
             * init() is accidentally called again.
             */

            if (
                Menu._bound
            ) {

                return;

            }


            Menu._bound =
                true;


            /* ==================================================
               MENU TOGGLE
            ================================================== */

            document
                .querySelectorAll(
                    "[data-menu-toggle], .menu-toggle, #menuToggle, #menuButton"
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

                                event.stopPropagation();

                                Menu.toggle();

                            }
                        );

                    }
                );


            /* ==================================================
               MENU CLOSE
            ================================================== */

            document
                .querySelectorAll(
                    "[data-menu-close], .menu-close, #menuClose"
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

                                Menu.close();

                            }
                        );

                    }
                );


            /* ==================================================
               OVERLAY
            ================================================== */

            const overlay =
                Menu.getOverlay();


            if (
                overlay
            ) {

                overlay.addEventListener(
                    "click",
                    function () {

                        Menu.close();

                    }
                );

            }


            /* ==================================================
               LOGOUT
            ================================================== */

            document
                .querySelectorAll(
                    "[data-logout], .logout-btn, #logoutBtn"
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

                                Menu.logout();

                            }
                        );

                    }
                );


            /* ==================================================
               DATA NAVIGATION
            ================================================== */

            document
                .querySelectorAll(
                    "[data-menu], [data-nav]"
                )
                .forEach(
                    function (
                        element
                    ) {

                        element.addEventListener(
                            "click",
                            function (
                                event
                            ) {

                                const target =
                                    element.getAttribute(
                                        "data-menu"
                                    ) ||
                                    element.getAttribute(
                                        "data-nav"
                                    );


                                if (
                                    !target
                                ) {

                                    return;

                                }


                                event.preventDefault();


                                Menu.navigate(
                                    target
                                );

                            }
                        );

                    }
                );


            /* ==================================================
               ESCAPE
            ================================================== */

            document.addEventListener(
                "keydown",
                function (
                    event
                ) {

                    if (
                        event.key ===
                        "Escape"
                    ) {

                        Menu.close();

                    }

                }
            );


            /* ==================================================
               BACK BUTTON
            ================================================== */

            window.addEventListener(
                "popstate",
                function () {

                    Menu.close();

                    Menu.setActive();

                }
            );
        };


    /* ========================================================
       SWIPE MENU
    ======================================================== */

    Menu.enableSwipe =
        function () {

            /*
             * Prevent duplicate swipe binding.
             */

            if (
                Menu._swipeBound
            ) {

                return;

            }


            const drawer =
                Menu.getDrawer();


            if (
                !drawer
            ) {

                return;

            }


            Menu._swipeBound =
                true;


            let startX =
                0;


            let currentX =
                0;


            let touching =
                false;


            drawer.addEventListener(
                "touchstart",
                function (
                    event
                ) {

                    if (
                        !event.touches ||
                        !event.touches.length
                    ) {

                        return;

                    }


                    startX =
                        event.touches[0]
                            .clientX;


                    currentX =
                        startX;


                    touching =
                        true;

                },
                {
                    passive: true
                }
            );


            drawer.addEventListener(
                "touchmove",
                function (
                    event
                ) {

                    if (
                        !touching ||
                        !event.touches ||
                        !event.touches.length
                    ) {

                        return;

                    }


                    currentX =
                        event.touches[0]
                            .clientX;

                },
                {
                    passive: true
                }
            );


            drawer.addEventListener(
                "touchend",
                function () {

                    if (
                        !touching
                    ) {

                        return;

                    }


                    touching =
                        false;


                    const diff =
                        currentX -
                        startX;


                    /*
                     * Swipe left = close.
                     */

                    if (
                        diff < -70
                    ) {

                        Menu.close();

                    }

                }
            );
        };


    /* ========================================================
       EVENTS
    ======================================================== */

    Menu.emit =
        function (
            name,
            data
        ) {

            try {

                window.dispatchEvent(
                    new CustomEvent(
                        "riderx-menu-" +
                        name,
                        {
                            detail:
                                data || {}
                        }
                    )
                );

            } catch (error) {

                console.warn(
                    "RiderX menu event error:",
                    error
                );

            }
        };


    Menu.on =
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
                "riderx-menu-" +
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

    Menu.init =
        function () {

            /*
             * Bind UI.
             */

            Menu.bind();

            Menu.enableSwipe();

            Menu.setActive();

            Menu.updateProfile();


            /*
             * Only guard if a role is already
             * available.
             *
             * Firebase auth.js can perform its
             * own async authentication check.
             */

            const role =
                Menu.getRole();


            if (
                role
            ) {

                Menu.guardCurrentPage();

            }


            /*
             * Emit ready event.
             */

            Menu.emit(
                "ready",
                {
                    role:
                        role,

                    userId:
                        Menu.getUserId()
                }
            );


            console.log(
                "RiderX menu.js loaded.",
                {
                    role:
                        role,

                    page:
                        Menu.getCurrentPage(),

                    section:
                        Menu.getCurrentSection()
                }
            );
        };


    /* ========================================================
       GLOBAL API
    ======================================================== */

    RX.navigate =
        Menu.navigate;


    RX.logout =
        Menu.logout;


    RX.openMenu =
        Menu.open;


    RX.closeMenu =
        Menu.close;


    RX.toggleMenu =
        Menu.toggle;


    /* ========================================================
       START
    ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            Menu.init,
            {
                once: true
            }
        );

    } else {

        Menu.init();

    }


})();

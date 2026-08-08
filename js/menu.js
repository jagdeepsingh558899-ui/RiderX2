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
   - Firebase Auth logout
   - User profile display
   ============================================================ */

(function () {

    "use strict";

    window.RiderX =
        window.RiderX || {};

    const RX =
        window.RiderX;

    const Menu =
        RX.menu =
        RX.menu || {};


    /* ========================================================
       CONFIG
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

            dashboard:
                "rider/dashboard.html",

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
       HELPERS
       ======================================================== */

    Menu.getUser =
        function () {

            try {

                if (
                    RX.auth &&
                    RX.auth.currentUser
                ) {

                    return RX.auth.currentUser;
                }

            } catch (error) {}


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

                        return user;
                    }
                }

            } catch (error) {}


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

            } catch (error) {}


            return null;
        };


    Menu.getRole =
        function () {

            const user =
                Menu.getUser();


            let role =
                user?.role ||
                user?.userRole ||
                user?.accountType ||
                localStorage.getItem(
                    "riderx_role"
                );


            role =
                String(
                    role ||
                    ""
                )
                .toLowerCase()
                .trim();


            if (
                role === "driver"
            ) {

                role =
                    "rider";
            }


            if (
                role === "passenger" ||
                role === "user"
            ) {

                role =
                    "customer";
            }


            return role;
        };


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


    Menu.getCurrentPage =
        function () {

            const path =
                window.location.pathname
                    .split("/")
                    .pop()
                    .toLowerCase();


            return path ||
                "index.html";
        };


    Menu.normalizePage =
        function (
            page
        ) {

            return String(
                page ||
                ""
            )
            .split("/")
            .pop()
            .toLowerCase();
        };


    /* ========================================================
       PATH RESOLUTION
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


            /*
             * Absolute URL.
             */

            if (
                /^https?:\/\//i
                    .test(
                        destination
                    )
            ) {

                return destination;
            }


            /*
             * Root path.
             */

            if (
                destination
                    .startsWith("/")
            ) {

                return destination;
            }


            /*
             * Already contains folder.
             */

            if (
                destination
                    .includes("/")
            ) {

                return destination;
            }


            const role =
                Menu.getRole();


            const routes =
                Menu.config[
                    role
                ];


            if (
                routes &&
                routes[destination]
            ) {

                return routes[
                    destination
                ];
            }


            return destination;
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

                return;
            }


            window.location.href =
                url;
        };


    /* ========================================================
       ROLE BASED HOME
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
       ROLE CHECK
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
                    url ||
                    ""
                )
                .toLowerCase();


            if (
                role === "admin"
            ) {

                return normalized
                    .includes(
                        "/admin/"
                    );
            }


            if (
                role === "rider"
            ) {

                return normalized
                    .includes(
                        "/rider/"
                    );
            }


            if (
                role === "customer"
            ) {

                return normalized
                    .includes(
                        "/customer/"
                    );
            }


            return false;
        };


    /* ========================================================
       ROLE GUARD
       ======================================================== */

    Menu.guardCurrentPage =
        function () {

            const path =
                window.location.pathname
                    .toLowerCase();


            /*
             * Public pages.
             */

            const publicPages = [

                "/",
                "index.html",
                "login.html",
                "register.html",
                "otp-login.html",
                "verify-otp.html",
                "customer-login.html",
                "rider-login.html",
                "role.html"
            ];


            const isPublic =
                publicPages.some(
                    function (
                        page
                    ) {

                        return path
                            .endsWith(
                                page
                            );
                    }
                );


            if (
                isPublic
            ) {

                return true;
            }


            const role =
                Menu.getRole();


            /*
             * Admin.
             */

            if (
                path.includes(
                    "/admin/"
                )
            ) {

                if (
                    role !== "admin"
                ) {

                    Menu.navigate(
                        "auth/login.html"
                    );


                    return false;
                }
            }


            /*
             * Rider.
             */

            if (
                path.includes(
                    "/rider/"
                )
            ) {

                if (
                    role !== "rider"
                ) {

                    Menu.navigate(
                        "auth/login.html"
                    );


                    return false;
                }
            }


            /*
             * Customer.
             */

            if (
                path.includes(
                    "/customer/"
                )
            ) {

                if (
                    role !== "customer"
                ) {

                    Menu.navigate(
                        "auth/login.html"
                    );


                    return false;
                }
            }


            return true;
        };


    /* ========================================================
       ACTIVE MENU
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


                    const target =
                        Menu.normalizePage(
                            dataPage ||
                            href
                        );


                    if (
                        target &&
                        target === current
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
            }


            document.body.classList.add(
                "menu-open"
            );


            Menu.emit(
                "opened"
            );
        };


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
            }


            document.body.classList.remove(
                "menu-open"
            );


            Menu.emit(
                "closed"
            );
        };


    Menu.toggle =
        function () {

            const drawer =
                Menu.getDrawer();


            if (
                drawer?.classList.contains(
                    "open"
                ) ||
                drawer?.classList.contains(
                    "active"
                )
            ) {

                Menu.close();

            } else {

                Menu.open();
            }
        };


    /* ========================================================
       PROFILE DATA
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

            /*
             * Prevent accidental logout.
             */

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

                } else if (
                    window.firebase &&
                    firebase.auth
                ) {

                    await firebase.auth()
                        .signOut();
                }

            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );
            }


            /*
             * Clear local session.
             */

            const keys = [

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


            keys.forEach(
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
             * Session storage.
             */

            try {

                sessionStorage.clear();

            } catch (error) {}


            Menu.emit(
                "logout-complete"
            );


            /*
             * Always go to auth login.
             */

            window.location.href =
                "auth/login.html";


            return true;
        };


    /* ========================================================
       EVENT BINDING
       ======================================================== */

    Menu.bind =
        function () {

            /*
             * Menu buttons.
             */

            document
                .querySelectorAll(
                    "[data-menu-toggle], .menu-toggle, #menuToggle"
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

                                Menu.toggle();
                            }
                        );
                    }
                );


            /*
             * Close buttons.
             */

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


            /*
             * Overlay.
             */

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


            /*
             * Logout buttons.
             */

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


            /*
             * Navigation links.
             */

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
                                    element
                                        .getAttribute(
                                            "data-menu"
                                        ) ||
                                    element
                                        .getAttribute(
                                            "data-nav"
                                        );


                                if (
                                    !target
                                ) {

                                    return;
                                }


                                event.preventDefault();


                                Menu.close();


                                Menu.navigate(
                                    target
                                );
                            }
                        );
                    }
                );


            /*
             * Close menu with Escape.
             */

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
        };


    /* ========================================================
       SWIPE MENU
       ======================================================== */

    Menu.enableSwipe =
        function () {

            const drawer =
                Menu.getDrawer();


            if (
                !drawer
            ) {

                return;
            }


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


                    touching =
                        true;
                },
                {
                    passive:
                        true
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
                    passive:
                        true
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
                     * Swipe left to close.
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

            Menu.bind();

            Menu.enableSwipe();

            Menu.setActive();

            Menu.updateProfile();


            /*
             * Do not enforce guard on
             * pages before auth module
             * has initialized.
             */

            const role =
                Menu.getRole();


            if (
                role
            ) {

                Menu.guardCurrentPage();
            }


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
                "RiderX menu.js loaded."
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
            Menu.init
        );

    } else {

        Menu.init();
    }


})();

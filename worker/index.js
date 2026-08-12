"use strict";

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        /*
         * =====================================================
         * RIDERX API
         * =====================================================
         */

        if (url.pathname === "/api/health") {
            return new Response(
                JSON.stringify({
                    ok: true,
                    service: "RiderX API",
                    status: "online",
                    timestamp: new Date().toISOString()
                }),
                {
                    status: 200,
                    headers: {
                        "content-type": "application/json; charset=UTF-8",
                        "cache-control": "no-store"
                    }
                }
            );
        }

        /*
         * =====================================================
         * STATIC WEBSITE
         * =====================================================
         */

        return env.ASSETS.fetch(request);
    }
};

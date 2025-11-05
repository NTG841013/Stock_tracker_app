// app/api/inngest/route.ts
import {serve} from "inngest/next";
import {inngest} from "@/lib/inngest/client";
import {sendDailyNewsSummary, sendSignUpEmail, checkAlerts} from "@/lib/inngest/functions";


export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        sendSignUpEmail,
        sendDailyNewsSummary,
        checkAlerts,
    ],
});
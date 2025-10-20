import {serve} from "inngest/next";
import {inngest} from "@/lib/inngest/client";
import {sendSignUpEmail} from "@/lib/inngest/functions";

// Ensure Node.js runtime for SMTP compatibility
export const runtime = 'nodejs';

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail],
});
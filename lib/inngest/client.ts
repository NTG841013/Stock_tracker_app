import { Inngest} from "inngest";

export const inngest = new Inngest({
    id: 'inkomba',
    ai: { gemini: { apiKey: process.env.GEMINI_API_KEY! }}
})
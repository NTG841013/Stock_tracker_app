import { inngest } from "@/lib/inngest/client";
import { NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT } from "@/lib/inngest/prompts";
import { sendNewsSummaryEmail, sendWelcomeEmail, sendPriceAlertEmail } from "@/lib/nodemailer";
import { getAllUsersForNewsEmail } from "@/lib/actions/user.actions";
import { getWatchlistSymbolsByEmail } from "@/lib/actions/watchlist.actions";
import { getNews } from "@/lib/actions/finnhub.actions";
import { getFormattedTodayDate } from "@/lib/utils";
import { connectToDatabase } from '@/database/mongoose';
import { Alert } from '@/database/models/alert.model';
import { getStocksDetails } from '@/lib/actions/finnhub.actions';

type UserForNewsEmail = {
    id: string;
    email: string;
    name: string;
};

type AiTextPart = { text?: string } | Record<string, unknown>;

type AiResponse = {
    candidates?: Array<{
        content?: { parts?: AiTextPart[] };
    }>;
};

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created' },
    async ({ event, step }) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.riskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `;

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile);

        const response = (await step.ai.infer('generate-welcome-intro', {
            model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
            body: {
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: prompt }],
                    },
                ],
            },
        })) as AiResponse;

        await step.run('send-welcome-email', async () => {
            const part = response.candidates?.[0]?.content?.parts?.[0] as AiTextPart | undefined;
            const introText = (part && typeof (part as any).text === 'string' ? (part as any).text : null) ||
                'Thanks for joining Inkomba – your edge in the markets. Track opportunities, stay informed, and make smarter investment moves.';

            const { data: { email, name } } = event as { data: { email: string; name: string } };

            return await sendWelcomeEmail({ email, name, intro: introText });
        });

        return {
            success: true,
            message: 'Welcome email sent successfully',
        };
    }
);

export const sendDailyNewsSummary = inngest.createFunction(
    { id: 'daily-news-summary' },
    [ { event: 'app/send.daily.news' }, { cron: '0 12 * * *' } ],
    async ({ step }) => {
        const users = (await step.run('get-all-users', getAllUsersForNewsEmail)) as UserForNewsEmail[];

        if (!users || users.length === 0) return { success: false, message: 'No users found for news email' };

        const results = (await step.run('fetch-user-news', async () => {
            const perUser: Array<{ user: UserForNewsEmail; articles: MarketNewsArticle[] }> = [];
            for (const user of users as UserForNewsEmail[]) {
                try {
                    const symbols = await getWatchlistSymbolsByEmail(user.email);
                    let articles = await getNews(symbols);
                    articles = (articles || []).slice(0, 6);
                    if (!articles || articles.length === 0) {
                        articles = await getNews();
                        articles = (articles || []).slice(0, 6);
                    }
                    perUser.push({ user, articles });
                } catch (e) {
                    console.error('daily-news: error preparing user news', user.email, e);
                    perUser.push({ user, articles: [] });
                }
            }
            return perUser;
        })) as Array<{ user: UserForNewsEmail; articles: MarketNewsArticle[] }>;

        const userNewsSummaries: { user: UserForNewsEmail; newsContent: string | null }[] = [];

        for (const { user, articles } of results) {
            try {
                const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(articles, null, 2));

                const response = (await step.ai.infer(`summarize-news-${user.email}`, {
                    model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                    body: {
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    },
                })) as AiResponse;

                const part = response.candidates?.[0]?.content?.parts?.[0] as AiTextPart | undefined;
                const newsContent = (part && typeof (part as any).text === 'string' ? (part as any).text : null) || 'No market news.';

                userNewsSummaries.push({ user, newsContent });
            } catch (e) {
                console.error('Failed to summarize news for : ', user.email);
                userNewsSummaries.push({ user, newsContent: null });
            }
        }

        await step.run('send-news-emails', async () => {
            await Promise.all(
                userNewsSummaries.map(async ({ user, newsContent }) => {
                    if (!newsContent) return false;

                    return await sendNewsSummaryEmail({ email: user.email, date: getFormattedTodayDate(), newsContent });
                })
            );
        });

        return { success: true, message: 'Daily news summary emails sent successfully' };
    }
);

export const checkAlerts = inngest.createFunction(
    {
        id: 'check-price-alerts',
        name: 'Check Price Alerts',
        retries: 2
    },
    [
        { event: 'app/check.alerts' },
        { cron: '*/5 * * * *' }
    ],
    async ({ event, step }) => {
        // Step 1: Get all active alerts - SERIALIZE IMMEDIATELY
        const alerts = await step.run('fetch-active-alerts', async () => {
            try {
                const mongoose = await connectToDatabase();
                const activeAlerts = await Alert.find({ isActive: true }).lean();
                console.log(`Found ${activeAlerts.length} active alerts`);

                // ✅ Convert to plain serializable objects
                return activeAlerts.map(alert => ({
                    id: String(alert._id),
                    userId: String(alert.userId),
                    symbol: String(alert.symbol),
                    company: String(alert.company),
                    alertName: String(alert.alertName),
                    currentPrice: Number(alert.currentPrice),
                    alertType: String(alert.alertType) as 'price',
                    condition: String(alert.condition) as 'greater' | 'less',
                    threshold: Number(alert.threshold),
                    isActive: Boolean(alert.isActive),
                    createdAt: alert.createdAt ? new Date(alert.createdAt).toISOString() : new Date().toISOString()
                }));
            } catch (error) {
                console.error('Error fetching alerts:', error);
                return [];
            }
        });

        if (!alerts || alerts.length === 0) {
            return {
                success: true,
                message: 'No active alerts to check',
                alertsChecked: 0,
                alertsTriggered: 0
            };
        }

        // Step 2: Group alerts by symbol
        const alertsBySymbol = alerts.reduce((acc, alert) => {
            if (!acc[alert.symbol]) {
                acc[alert.symbol] = [];
            }
            acc[alert.symbol].push(alert);
            return acc;
        }, {} as Record<string, typeof alerts>);

        console.log(`Checking ${Object.keys(alertsBySymbol).length} unique symbols`);

        // Step 3: Check prices and collect triggered alerts - SERIALIZE OUTPUT
        const triggeredAlerts = await step.run('check-and-trigger-alerts', async () => {
            const triggered: Array<{
                userId: string;
                symbol: string;
                company: string;
                threshold: number;
                condition: 'greater' | 'less';
                alertId: string;
                currentPrice: number;
                changePercent: number;
            }> = [];

            for (const [symbol, symbolAlerts] of Object.entries(alertsBySymbol)) {
                try {
                    console.log(`Checking price for ${symbol}`);
                    const details = await getStocksDetails(symbol);
                    const currentPrice = details.quote?.c;
                    const changePercent = details.quote?.dp || 0;

                    if (!currentPrice) {
                        console.log(`No price data for ${symbol}`);
                        continue;
                    }

                    for (const alert of symbolAlerts) {
                        let shouldTrigger = false;

                        if (alert.alertType === 'price') {
                            if (alert.condition === 'greater' && currentPrice >= alert.threshold) {
                                shouldTrigger = true;
                            } else if (alert.condition === 'less' && currentPrice <= alert.threshold) {
                                shouldTrigger = true;
                            }
                        }

                        if (shouldTrigger) {
                            console.log(`🔔 Alert triggered for ${symbol}: ${currentPrice} ${alert.condition} ${alert.threshold}`);

                            // ✅ Store only serializable data
                            triggered.push({
                                userId: String(alert.userId),
                                symbol: String(alert.symbol),
                                company: String(alert.company),
                                threshold: Number(alert.threshold),
                                condition: alert.condition,
                                alertId: String(alert.id),
                                currentPrice: Number(currentPrice),
                                changePercent: Number(changePercent)
                            });

                            // Update alert in database
                            await Alert.updateOne(
                                { _id: alert.id },
                                {
                                    $set: {
                                        isActive: false,
                                        triggeredAt: new Date()
                                    }
                                }
                            );
                        }
                    }
                } catch (error) {
                    console.error(`Error checking alerts for ${symbol}:`, error);
                }
            }

            return triggered;
        });

        // Step 4: Send emails - HANDLE ERRORS PROPERLY
        if (triggeredAlerts.length > 0) {
            const emailResults = await step.run('send-alert-emails', async () => {
                const mongoose = await connectToDatabase();
                const db = mongoose.connection.db;
                if (!db) throw new Error('MongoDB connection not found');

                const results: Array<{ symbol: string; email: string; success: boolean; error?: string }> = [];

                // Import ObjectId for MongoDB queries
                const { ObjectId } = require('mongodb');

                for (const alert of triggeredAlerts) {
                    try {
                        console.log(`📧 Looking up user for userId: ${alert.userId}`);

                        // ✅ CRITICAL FIX: Query by _id using ObjectId
                        const user = await db.collection('user').findOne({
                            _id: new ObjectId(alert.userId)
                        });

                        console.log('🔍 User lookup result:', user ? 'Found' : 'Not found');

                        if (user) {
                            console.log('   User email:', user.email);
                        }

                        if (!user?.email) {
                            console.warn(`❌ No email found for userId: ${alert.userId}`);
                            results.push({
                                symbol: alert.symbol,
                                email: 'unknown',
                                success: false,
                                error: 'User email not found'
                            });
                            continue;
                        }

                        console.log(`📧 Sending alert email to ${user.email} for ${alert.symbol}`);

                        const emailResult = await sendPriceAlertEmail({
                            email: String(user.email),
                            symbol: alert.symbol,
                            company: alert.company,
                            alertType: alert.condition,
                            currentPrice: alert.currentPrice,
                            targetPrice: alert.threshold,
                            changePercent: alert.changePercent
                        });

                        results.push({
                            symbol: alert.symbol,
                            email: String(user.email),
                            success: emailResult.success,
                            error: emailResult.error
                        });

                        if (emailResult.success) {
                            console.log(`✅ Email sent successfully to ${user.email} for ${alert.symbol}`);
                        } else {
                            console.error(`❌ Email failed for ${alert.symbol}: ${emailResult.error}`);
                        }
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        console.error(`❌ Error processing alert for ${alert.symbol}:`, errorMessage);
                        results.push({
                            symbol: alert.symbol,
                            email: 'error',
                            success: false,
                            error: errorMessage
                        });
                    }
                }

                return results;
            });

            const successCount = emailResults.filter(r => r.success).length;
            const failCount = emailResults.filter(r => !r.success).length;

            return {
                success: true,
                message: `Checked ${alerts.length} alerts, triggered ${triggeredAlerts.length}, sent ${successCount} emails, ${failCount} failed`,
                alertsChecked: alerts.length,
                alertsTriggered: triggeredAlerts.length,
                emailsSent: successCount,
                emailsFailed: failCount,
                details: emailResults
            };
        }

        return {
            success: true,
            message: `Checked ${alerts.length} alerts, none triggered`,
            alertsChecked: alerts.length,
            alertsTriggered: 0
        };
    }
);
import * as Sentry from "@sentry/node";

import { TwitchPrivateMessage } from "twitch-chat-client/lib/StandardCommands/TwitchPrivateMessage";
import { RefreshableAuthProvider, StaticAuthProvider } from "twitch-auth";
import { ChatClient } from "twitch-chat-client";
import { ApiClient } from "twitch";

import Channels from "./channels";
import MessageHandler from "./handler";
import GraphQL from "./graphql";
import { CLIENT, UPDATE_CLIENT } from "../queries/queries";

import { Client } from "../interfaces/client.interface";

import { Signale } from "signale";

export default class TwitchClient {
    /**
     * Publicly accessible ChatClient instance
     */
    public client?: ChatClient;

    /**
     * Publicly Accessible Auth Provider
     */
    public auth?: RefreshableAuthProvider;

    /**
     * Publicly accessible Twitch API Client Instance
     */
    public api?: ApiClient;

    constructor(private graphql: GraphQL, public channels: Channels, private handler: MessageHandler) {
        (async () => {
            const logger = new Signale().scope("Twitch", "constructor");

            try {
                // Define environment, fall back to "development" if not explicitly set
                const environment = process.env.NODE_ENV || "development";
                if (environment !== "development" && environment !== "production") {
                    logger.error(`Specified environment (\`${environment}\`) has no overlap with \`development\` or \`production\``);
                    throw new Error(`Specified environment (\`${environment}\`) has no overlap with \`development\` or \`production\``);
                }

                logger.await(`Fetching Client for environment \`${environment}\``);

                // Fetch Twitch Client for current environment
                const client: Client = await this.graphql.client
                    .query({
                        query: CLIENT,
                        variables: { environment },
                    })
                    .then((res) => res.data.client);

                // Get configurations for all enabled Channels
                const channels = await this.channels.getConfigurations();

                logger.await("Authenticating Client");

                // Create new Twitch Auth provider
                this.auth = new RefreshableAuthProvider(new StaticAuthProvider(client.clientId, client.accessToken), {
                    clientSecret: client.clientSecret,
                    refreshToken: client.refreshToken,
                    expiry: client.expiresAt ? new Date(client.expiresAt) : null,
                    onRefresh: async ({ accessToken, refreshToken, expiryDate }) => {
                        logger.await(`Storing refreshed Tokens for Client \`${client.name}\``);

                        // Store refreshed Token
                        await this.graphql.client
                            .mutate({
                                mutation: UPDATE_CLIENT,
                                variables: {
                                    id: client.id,
                                    accessToken,
                                    refreshToken,
                                    expiresAt: expiryDate,
                                },
                            })
                            .then(() => {
                                logger.success(`Stored refreshed Tokens for Client \`${client.name}\``);
                            })
                            .catch((error) => {
                                logger.error(`Error storing refreshed Tokens for Client \`${client.name}\``);
                                logger.error(error);
                            });
                    },
                });

                // Create new API Client
                this.api = new ApiClient({ authProvider: this.auth });

                // Create new Chat Client
                this.client = new ChatClient(this.auth, {
                    botLevel: "verified",
                    channels: [client.name, "mr4dams"],
                });

                logger.await("Connecting to Chat");

                // Connect Chat Client
                await this.client.connect();
                logger.success("Successfully connected to Chat");

                logger.await("Waiting 5 seconds before joining Channels");

                // Join Channels after idling for 5 seconds
                setTimeout(async () => {
                    logger.start(`Joining ${channels.length} Channels`);

                    await channels.reduce(async (previous: Promise<any>, next: any) => {
                        await previous;

                        const logger = new Signale().scope("Twitch", "constructor", next);

                        logger.await("Joining Channel");

                        return this.client
                            ?.join(next)
                            .then(() => {
                                logger.success("Joined Channel");
                                this.channels.partOf.push(next);
                            })
                            .catch((error) => {
                                logger.error("Error joining Channel");
                                logger.error(error);

                                // Disable Channel if the bot is banned
                                if (error?.message?.includes("Did not receive a reply to join"))
                                    this.channels.disableChannel(next, "JOIN_BANNED");
                            });
                    }, Promise.resolve());
                }, 5000);

                // Handle `authenticationFailure` events
                this.client.onAuthenticationFailure((msg) => {
                    const logger = new Signale().scope("Twitch", "onAuthenticationFailure");

                    logger.error("Error authenticating Client");
                    logger.error(msg);
                });

                // Handle `message` events
                this.client.onMessage((channel: string, _, message: string, rawMessage: TwitchPrivateMessage) => {
                    this.handler.handle(channel, message, rawMessage.userInfo, this.client as ChatClient);
                });

                // Handle `ban` events
                this.client.onBan((channel: string, user: string) => {
                    channel = channel.toLocaleLowerCase().replace("#", "");
                    const logger = new Signale().scope("Twitch", "onBan", channel);

                    if (user === process.env.TWITCH_BOT_USER) {
                        logger.warn("Bot was banned");

                        logger.await("Disabling Channel");
                        this.channels
                            .disableChannel(channel, "BANNED")
                            .then(() => {
                                logger.success("Disabled Channel");
                            })
                            .catch((error) => {
                                logger.error("Error disabling Channel");
                                logger.error(error);
                            });
                    }
                });

                // Handle `messageRateLimit` events
                this.client.onMessageRatelimit((channel: string) => {
                    channel = channel.toLocaleLowerCase().replace("#", "");
                    const logger = new Signale().scope("Twitch", "onMessageRatelimit", channel);

                    logger.error("Rate limited, could not send message");
                });

                // Handle `onDisconnect` events
                this.client.onDisconnect((manually, reason) => {
                    const logger = new Signale().scope("Twitch", "onDisconnect");

                    logger.error("Client disconnected unexpectedly");
                    logger.error("Details:", { manually, reason });

                    Sentry.captureException(`Client disconnected unexpectedly: ${reason}`);

                    // Exit process if Client was not disconnected manually
                    if (!manually) process.exit(1);
                });

                // Hand over API Client to Handler Class
                this.handler.api = this.api;

                // Hand over Chat Client to Channels Class and start listening for updates and additions
                this.channels.client = this.client;
                this.channels.listen();
            } catch (error) {
                logger.fatal("Unexpected Error during setup");
                logger.fatal(error);

                Sentry.captureException(error);

                throw new Error("Unexpected Error during setup");
            }
        })();
    }
}

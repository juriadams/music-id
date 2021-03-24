import * as Sentry from "@sentry/node";

import { TwitchPrivateMessage } from "twitch-chat-client/lib/StandardCommands/TwitchPrivateMessage";
import { RefreshableAuthProvider, StaticAuthProvider } from "twitch-auth";
import { ChatClient } from "twitch-chat-client";
import signale from "signale";

import Channels from "./channels";
import MessageHandler from "./handler";
import GraphQL from "./graphql";
import { CLIENT, TOKEN, UPDATE_CLIENT } from "../queries/queries";

import { Client } from "../interfaces/client.interface";

export default class TwitchClient {
    /**
     * Publicly accessible ChatClient instance
     */
    public client?: ChatClient;

    constructor(private graphql: GraphQL, public channels: Channels, private handler: MessageHandler) {
        (async () => {
            try {
                // Define environment, fall back to "development" if not explicitly set
                const environment = process.env.NODE_ENV || "development";
                if (environment !== "development" && environment !== "production")
                    throw new Error(
                        `Specified environment (\`${process.env.NODE_ENV}\`) has no overlap with \`development\` or \`production\``,
                    );

                signale.await(`Fetching Client configuration for \`${environment}\``);

                // Fetch Twitch Client for current environment
                const client: Client = await this.graphql.client
                    .query({
                        query: CLIENT,
                        variables: { environment },
                    })
                    .then((res) => res.data.client);

                signale.success("Received Client configuration");

                // Get configurations for all enabled Channels
                const channels = await this.channels.getConfigurations();

                signale.success(`Received Channel configurations (${channels.length} total)`);

                // Create new Twitch Auth provider
                const auth = new RefreshableAuthProvider(new StaticAuthProvider(client.clientId, client.accessToken), {
                    clientSecret: client.clientSecret,
                    refreshToken: client.refreshToken,
                    expiry: client.expiresAt ? new Date(client.expiresAt) : null,
                    onRefresh: async ({ accessToken, refreshToken, expiryDate }) => {
                        signale.await("Storing refreshed Token");

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
                                signale.success(`Stored refreshed Token for Client \`${client.name}\` (${client.environment})`);
                            })
                            .catch((err) => {
                                signale.error(`Error storing refreshed Token for Client \`${client.name}\` (${client.environment})`);
                                signale.error(err);
                            });
                    },
                });

                // Create new Chat Client
                this.client = new ChatClient(auth, {
                    botLevel: "verified",
                    channels: [client.name],
                });

                signale.await("Connecting ChatClient");

                // Connect Chat Client
                await this.client.connect();
                signale.success("ChatClient connected");

                signale.await("Waiting 10 seconds before joining Channels");

                // Join Channels after idling for 10 seconds
                setTimeout(() => {
                    signale.start(`Joining ${channels.length} Channels`);
                    channels.map((channel, index) => {
                        signale.await(`[${index + 1}/${channels.length}] Joining Channel \`${channel}\``);
                        this.client
                            ?.join(channel)
                            .then(() => {
                                signale.success(`Joined Channel \`${channel}\``);
                                this.channels.partOf.push(channel);
                            })
                            .catch((error) => {
                                signale.error(`Error joining Channel \`${channel}\``);
                                signale.error(error);
                            });
                    });
                }, 10000);

                // Handle `authenticationFailure` events
                this.client.onAuthenticationFailure((msg) => {
                    signale.error("Error authenticating ChatClient");
                    signale.error(msg);
                });

                // Handle `message` events
                this.client.onMessage((channel: string, _, message: string, rawMessage: TwitchPrivateMessage) => {
                    this.handler.handle(channel, message, rawMessage.userInfo, this.client as ChatClient);
                });

                // Handle `ban` events
                this.client.onBan((channel: string, user: string) => {
                    channel = channel.toLocaleLowerCase().replace("#", "");

                    if (user === process.env.TWITCH_BOT_USER) {
                        signale.warn(`Bot was banned in Channel \`${channel}\``);
                        this.channels.disable(channel);
                    }
                });

                // Handle `messageRateLimit` events
                this.client.onMessageRatelimit((channel: string) => {
                    channel = channel.toLocaleLowerCase().replace("#", "");

                    signale.error(`Error sending message in Channel \`${channel}\`, likely due to rate limits`);
                });

                // Hand Client over to Channels Class and start listening for updates and additions
                this.channels.client = this.client;
                this.channels.listen();
            } catch (error) {
                Sentry.captureException(error);

                signale.fatal("An unexpected error occurred during the initial setup");
                signale.fatal(error);

                throw new Error("An unexpected error occurred during the initial setup");
            }
        })();
    }
}

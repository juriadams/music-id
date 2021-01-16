import { gql, GraphQLClient } from "graphql-request";

import { Channels } from "./channels";
import { MessageHandler } from "./handler";

import signale from "signale";
import tmi from "tmi.js";

export class TwitchClient {
    /**
     * Twitch client instance
     */
    // @ts-expect-error Client will be initialized after Channels were retrieved
    public client: tmi.Client;

    /**
     * GraphQL Client Instance
     */
    private gql: GraphQLClient = new GraphQLClient(process.env.GQL_URL as string).setHeader(
        "Authorization",
        `Bearer ${process.env.GQL_TOKEN}`,
    );

    constructor(private channels: Channels, private handler: MessageHandler) {
        this.init();
    }

    /**
     * Asynchronous Method called inside the Constructor
     */
    private async init(): Promise<void> {
        signale.info(`\n\n   STARTING MUSIC ID FOR TWITCH\n\n`);

        try {
            // Get the names of all Channels
            const channels = await this.channels.update();

            signale.info("Received Channles");
            signale.debug(channels.join(", "));

            // Create new Twitch Client and join all Channels
            this.client = tmi.Client({
                channels,
                connection: {
                    reconnect: true,
                    secure: true,
                },
                identity: {
                    username: process.env.TWITCH_USERNAME,
                    password: process.env.TWITCH_PASSWORD,
                },
            });

            // Connect Client
            this.client.connect();

            // Handle various Client-Events
            this.client
                .on("connected", () => {
                    signale.success(`Successfully connected Twitch Client`);
                })
                .on("message", (channel: string, tags: any, message: string) => {
                    this.handler.handle(channel, message, tags.username, this.client);
                })
                .on("notice", async (channel: string, notice: string, message: string) => {
                    // Strip leading `#` from Channel name
                    channel = channel.replace("#", "").toLowerCase();

                    // Check for relevant Notices
                    if (["msg_banned", "No response from Twitch."].includes(notice)) {
                        signale.warn(`An Error occurred: ${notice}, ${message}`);

                        // Leave Channel if Bot is banned
                        if (notice === "msg_banned") {
                            signale.scope(channel).error(`Banned from Chat`);
                            this.client.part(channel);

                            await this.gql
                                .request(
                                    gql`
                                        mutation Channel($name: String!, $active: Boolean!) {
                                            updateChannel(channel: { name: $name, active: $active }) {
                                                id
                                                channelName
                                                active
                                            }
                                        }
                                    `,
                                    { name: channel, active: false },
                                )
                                .then((data) => data.updateChannel)
                                .then((channel) =>
                                    signale
                                        .scope(channel)
                                        .success(`Marked Channel \`${channel.channelName}\` as \`inactive\``),
                                )
                                .catch((error) => {
                                    signale.scope(channel).error(`Error marking Channel as \`inactive\``);
                                    signale.scope(channel).error(error);
                                });
                        }
                    }
                });
        } catch (error) {
            signale.fatal(`Error during intial Setup`);
            signale.fatal(error);
            throw new Error(`Error during initial Setup`);
        }
    }
}

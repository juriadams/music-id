import Channels from "./channels";
import MessageHandler from "./handler";

import signale from "signale";
import tmi from "tmi.js";

export default class TwitchClient {
    /**
     * Twitch client instance
     */
    // @ts-expect-error Client will be initialized after Channels were retrieved
    public client: tmi.Client;

    constructor(private channels: Channels, private handler: MessageHandler) {
        this.init();
    }

    /**
     * Asynchronous Method called inside the Constructor
     */
    private async init(): Promise<void> {
        signale.info(`Starting Music ID for Twitch`);

        try {
            // Get the names of all Channels
            const channels = await this.channels.update();

            signale.info(`Received Channels (${channels.length} total)`);
            signale.debug(channels.join(", "));

            // Create new Twitch Client and join all Channels
            this.client = tmi.Client({
                channels: process.env.NODE_ENV === "development" ? ["mr4dams"] : channels,
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

                            // Leave and deactivate Channel
                            this.client.part(channel);
                            this.channels.deactivate(channel);
                        }
                    }
                });

            // Hand Client over to Channels Class and start listening for updates and additions
            this.channels.client = this.client;
            this.channels.listen();
        } catch (error) {
            signale.fatal(`Error during intial Setup`);
            signale.fatal(error);
            throw new Error(`Error during initial Setup`);
        }
    }
}

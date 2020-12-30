import * as tmi from "tmi.js";
import { Channels } from "./channels";
import { Logger } from "./logger";
import { MessageHandler } from "./message-handler";

export class TwitchClient {
    /**
     * Twitch client instance
     */
    // @ts-ignore Client will be initialized asynchronous after the Channels are loaded
    public client: tmi.Client;

    constructor(private logger: Logger, private channels: Channels, private handler: MessageHandler) {
        this.init();
    }

    /**
     * Asynchronous Method called inside the constructor
     */
    private async init(): Promise<void> {
        this.logger.pino.info("\n\nSTARTING TWITCH MUSIC ID\n\n");

        try {
            // Get the names of all Channels
            const channels = await this.channels.updateChannels();

            this.logger.pino.info(`Received Channels: ${channels.join(", ")}`);

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

            // Handle `connected` Event
            this.client.on("connected", () => {
                this.logger.pino.info("Twitch Client connected successfully, joining Channels");
            });

            // Handle `message` Event
            this.client.on("message", (channel: string, tags: any, message: string) => {
                this.handler.handle(channel, message, tags.username, this.client);
            });

            // Catch banned or no response errors
            this.client.on("notice", (channel: string, notice: string, message: string) => {
                if (["msg_banned", "No response from Twitch."].includes(notice)) {
                    this.logger.pino.error(
                        { channel },
                        `An Error occurred in Channel ${channel}: ${notice}, ${message}`,
                    );

                    // Leave Channel if Bot is banned
                    if (notice === "msg_banned") {
                        this.logger.pino.info({ channel }, `Leaving Channel ${channel} because User is banned`);

                        this.client.part(channel);
                    }
                }
            });
        } catch (error) {
            this.logger.pino.fatal({ error }, "An Error occurred during the initial setup, this is fatal");

            // Throw Error (will not be caught and instead handed to Sentry)
            throw new Error("An Error occurred during the initial setup");
        }
    }
}

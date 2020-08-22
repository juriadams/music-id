import { environment } from "../environment";
import { Channels } from "./channels";
import { MessageHandler } from "./message-handler";
import signale from "signale";
import * as tmi from "tmi.js";

export class TwitchClient {
    /**
     * Twitch client instance
     */
    // @ts-ignore Client will be initialized asynchronous after the Channels are loaded
    public client: tmi.Client;

    constructor(private channels: Channels, private handler: MessageHandler) {
        this.init();
    }

    /**
     * Asynchronous Method called inside the constructor
     */
    private async init(): Promise<void> {
        try {
            // Get the names of all Channels
            const channels = await this.channels.updateChannels();

            signale.success("Received the names of all Channels");
            signale.info(channels);

            // Create new Twitch Client and join all Channels
            this.client = tmi.Client({
                channels,
                connection: {
                    reconnect: true,
                    secure: true,
                },
                identity: {
                    username: environment.twitch.username,
                    password: environment.twitch.auth,
                },
            });

            // Connect Client
            this.client.connect();

            // Handle `connected` Event
            this.client.on("connected", () => {
                signale.success("Twitch Client connected");
            });

            // Handle `message` Event
            this.client.on("message", (channel: string, tags: any, message: string) => {
                this.handler.handle(channel, message, tags.username, this.client);
            });
        } catch (error) {
            signale.error("An error occurred during initial setup");
            signale.error(error);

            // Throw Error (will not be caught and instead handed to Sentry)
            throw new Error("An error occurred during initial setup");
        }
    }
}

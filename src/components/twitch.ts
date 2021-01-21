import Channels from "./channels";
import MessageHandler from "./handler";

import signale from "signale";

import { ChatClient } from "twitch-chat-client";
import { RefreshableAuthProvider, StaticAuthProvider } from "twitch-auth";

export default class TwitchClient {
    /**
     * Twitch client instance
     */
    public client: any;

    constructor(public channels: Channels, private handler: MessageHandler) {
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

            signale.success(`Received Channels (${channels.length} total)`);
            signale.debug(channels.join(", "));

            // Create new Refreshable Auth Provider
            const auth = new RefreshableAuthProvider(
                new StaticAuthProvider(
                    process.env.TWITCH_CLIENT_ID as string,
                    process.env.TWITCH_ACCESS_TOKEN as string,
                ),
                {
                    clientSecret: process.env.TWITCH_CLIENT_SECRET as string,
                    refreshToken: process.env.TWITCH_REFRESH_TOKEN as string,
                },
            );

            // Create new Chat Client
            this.client = new ChatClient(auth, {
                botLevel: process.env.TWITCH_BOT_LEVEL as "none" | "known" | "verified",
                channels: process.env.NODE_ENV === "development" ? ["mr4dams"] : channels,
            });

            // Set `onConnect` Property
            this.client.onConnect = () => {
                signale.success("Connected to Twitch");
            };

            // Set `onDisconnect` Property
            this.client.onDisconnect = () => {
                signale.error("Disconnected from Twitch");
            };

            // Connect Chat Client
            await this.client.connect();
            signale.success("Connected to Twitch");

            // Handle Messages
            this.client.onMessage((channel: string, user: string, message: string) => {
                this.handler.handle(channel, message, user, this.client);
            });

            // Handle Joins
            this.client.onJoin((channel: string, user: string) => {
                if (user === process.env.TWITCH_BOT_USER) {
                    signale.info(`Joined \`${channel.replace("#", "")}\``);
                    this.channels.channels.push(channel.replace("#", ""));
                }
            });

            // Handle Parts
            this.client.onPart((channel: string, user: string) => {
                if (user === process.env.TWITCH_BOT_USER) {
                    signale.info(`Left \`${channel.replace("#", "")}\``);
                    this.channels.channels = this.channels.channels.filter((c) => c !== channel.replace("#", ""));
                }
            });

            // Handle Bans
            this.client.onBan((channel: string, user: string) => {
                if (user === process.env.TWITCH_BOT_USER) {
                    signale.warn(`Bot was banned in Channel \`${channel.replace("#", "")}\``);
                    this.channels.deactivate(channel.replace("#", ""));
                }
            });

            // Handle Rate Limits
            this.client.onMessageRatelimit((channel: string) => {
                signale.error(`Error sending message in \`${channel.replace("#", "")}\` since we are rate limited`);
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

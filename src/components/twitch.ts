import { environment } from "../environment";
import { Firestore } from "./firestore";
import { Channels } from "./channels";
import { MessageHandler } from "./message-handler";
import signale from "signale";
import * as tmi from "tmi.js";
import { Identifier } from "./identifier";

export class TwitchClient {
    /**
     * Twitch client instance
     */
    // @ts-ignore
    public client: tmi.Client;

    constructor(private firestore: Firestore, private channels: Channels, private handler: MessageHandler) {
        // Connect to Firestore
        this.firestore
            .init()
            .then(() => {
                // Get list of channels to join
                this.channels
                    .getChannels()
                    .then((channels) => {
                        signale.debug("Creating new Twitch client");
                        signale.debug(channels);

                        // Create new Twitch client joining all found channels
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

                        // Connect client
                        this.client.connect();

                        // Handle `connected` event
                        this.client.on("connected", () => {
                            signale.success("Successfully connected to Twitch");
                        });

                        // Handle `message` event
                        this.client.on("message", (channel: string, tags: any, message: string) => {
                            this.handler.handle(channel, message, tags.username, this.client);
                        });
                    })
                    .catch((error) => {
                        signale.fatal("Error getting initial channel list, exiting");
                        signale.fatal(error);
                    });
            })
            .catch((error) => {
                signale.fatal("Error making initial Firestore connection, exiting");
                signale.fatal(error);
            });
    }
}

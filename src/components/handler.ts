import Channels from "./channels";
import MessageComposer from "./composer";
import Identifier from "./identifier";

import signale from "signale";
import tmi from "tmi.js";

import { MENTION } from "../queries/queries";
import GraphQL from "./graphql";

export default class MessageHandler {
    constructor(
        private graphql: GraphQL,
        private channels: Channels,
        private composer: MessageComposer,
        private identifier: Identifier,
    ) {}

    /**
     * Main Message Handler which processes every Chat Message
     * @param channel Name of the Channel the Message was sent in
     * @param message Raw Chat Message which was received
     * @param sender User who sent the Message
     * @param client Twitch client instance
     */
    public handle(channel: string, message: string, sender: string, client: tmi.Client) {
        // Strip leading `#` from Channel names
        channel = channel.replace("#", "").toLowerCase();
        message = message.toLowerCase();

        // Handle Messages which contain `MENTION_TRIGGERS`
        if (process.env.MENTION_TRIGGERS?.split(",").some((trigger) => message.toLowerCase().includes(trigger))) {
            this.mention(channel, message, sender);
        }

        // Handle Messages which were sent by `BOT_VIPS`
        if (process.env.BOT_VIP?.split(",").includes(sender.toLowerCase())) {
            if (message.toLowerCase().startsWith("!sing")) return client.say(channel, `@${sender} FeelsWeirdMan 👉 🚪`);
        }

        // Handle Messages from Channels with missing Configuration
        if (!this.channels.store[channel]) {
            return signale
                .scope(channel)
                .fatal(`Received Message from Channel \`${channel}\` which has no Configuration`);
        }

        // Handle Identifications
        if (this.channels.store[channel].triggers.some((trigger) => message.includes(trigger.keyword))) {
            this.identify(channel, sender, message, client);
        }
    }

    /**
     * Handle mentions of the bot or any other keywords specified in environment
     * @param channel Channel the bot was mentioned in
     * @param message Message including the keyword
     * @param sender Name of the message sender
     */
    public async mention(channel: string, message: string, sender: string): Promise<void> {
        signale.scope(channel).info(`Bot was mentioned → \`${sender}: ${message}\``);

        // Create new Mention Entity in Database
        await this.graphql.client
            .mutate({
                mutation: MENTION,
                variables: {
                    channel,
                    message,
                    sender,
                },
            })
            .catch((error) => {
                signale.scope(channel).error(`Error saving Mention`);
                signale.scope(channel).error(error);
            });
    }

    /**
     * Handle Song identification Requests
     * @param channelName Name of the Channel currently playing Songs were requested for
     * @param requester Name of the Person who requested the Songs
     * @param client Twitch Client instance used to reply with
     */
    public async identify(channel: string, requester: string, message: string, client: tmi.Client): Promise<void> {
        signale.scope(channel).start(`Song Identification requested`);

        // Check if Identification is already in progress in Channel
        if (this.channels.store[channel].pending)
            return signale.scope(channel).warn(`Identification is already in progress`);

        // Check if Identification is currently on Cooldown
        const cooldown = await this.channels.isOnCooldown(channel);

        // Check if Identification is currently on Cooldown
        if (cooldown.onCooldown) {
            // Check if Cooldown Message was already sent
            if (this.channels.store[channel].cooldownSent)
                return signale.scope(channel).warn(`Cooldown Message was already sent`);

            signale.scope(channel).info(`Sending Cooldown Message`);
            this.channels.store[channel].cooldownSent = true;

            const message = this.composer.COOLDOWN(
                channel,
                requester,
                cooldown.untilNext || 0,
                cooldown.identification,
            );

            this.channels.store[channel].useAction ? client.action(channel, message) : client.say(channel, message);
        }

        if (!cooldown.onCooldown) {
            // Mark Channel as `pending`
            this.channels.store[channel].pending = true;

            try {
                // Identify currently playing Songs
                const songs = await this.identifier.nowPlaying(channel, requester, message);

                songs?.length > 0
                    ? signale.scope(channel).success(`Identified ${songs.length} Songs`)
                    : signale.scope(channel).warn(`No Songs found`);

                // Unmark Channel as `pending` and `cooldownSent`
                this.channels.store[channel].pending = false;
                this.channels.store[channel].cooldownSent = false;

                // Send Message with found Songs in Chat
                const response: string =
                    songs?.length > 0
                        ? this.composer.SUCCESS(channel, requester, songs[0])
                        : this.composer.ERROR(channel, requester, "No Songs found");
                this.channels.store[channel].useAction
                    ? client.action(channel, response)
                    : client.say(channel, response);
            } catch (error) {
                signale.scope(channel).error(`Error identifying Songs`);
                signale.scope(channel).error(error);

                const response = this.composer.ERROR(channel, requester, "Error identifying Songs");
                this.channels.store[channel].useAction
                    ? client.action(channel, response)
                    : client.say(channel, response);
            }
        }
    }
}

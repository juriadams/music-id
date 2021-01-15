import { gql, GraphQLClient } from "graphql-request";
import * as tmi from "tmi.js";
import { Channels } from "./channels";
import { MessageComposer } from "./composer";
import { Identifier } from "./identifier";
import { Logger } from "./logger";

export class MessageHandler {
    /**
     * GraphQL Client Instance
     */
    private gql: GraphQLClient;

    constructor(
        private logger: Logger,
        private channels: Channels,
        private composer: MessageComposer,
        private identifier: Identifier,
    ) {
        // @ts-expect-error Initialize new GraphQL Client
        this.gql = new GraphQLClient(process.env.GQL_URL).setHeader("Authorization", `Bearer ${process.env.GQL_TOKEN}`);
    }

    /**
     * Helper function to remove command name and split message into arguments
     * @param message Message we split into arguments
     */
    public getArgs(message: string): string[] {
        return message.split(" ").slice(1);
    }

    /**
     * Main message handler
     * @param channel Name of the channel the message was sent in
     * @param message Actual message
     * @param sender Name of the message sender
     * @param client Twitch client instance
     */
    public handle(channelName: string, message: string, sender: string, client: tmi.Client) {
        // Fix Channel name and make message lowercase
        channelName = channelName.replace("#", "").toLowerCase();
        message = message.toLowerCase();

        // @ts-expect-error Handle Mentions
        if (message.includes(process.env.MENTION_TRIGGER)) {
            this.handleMention(channelName, message, sender);
        }

        // Messages by Admins
        if (
            process.env.BOT_ADMIN?.split(",").includes(channelName) &&
            process.env.BOT_ADMIN?.split(",").includes(sender.toLowerCase())
        ) {
            if (message.startsWith("!join")) {
                const target = message.split(" ")[1];
                if (!target) return client.action(channelName, "⚠️ Missing argument `channel`");

                client.join(target);
                client.say(channelName, `✅ Successfully joined Channel ${target}`);
            }

            if (message.startsWith("!leave") || message.startsWith("!part")) {
                const target = message.split(" ")[1];
                if (!target) return client.action(channelName, "⚠️ Missing argument `channel`");

                client.part(target);
                client.say(channelName, `✅ Successfully left Channel ${target}`);
            }
        }

        // Handle messages by VIPs
        if (process.env.BOT_VIP?.split(",").includes(sender.toLowerCase())) {
            if (message.toLowerCase().startsWith("!sing"))
                return client.say(channelName, `@${sender} FeelsWeirdMan 👉 🚪`);
        }

        if (!this.channels.channels[channelName]) {
            // Handle messages from channels with missing Configuration
            return this.logger.pino.fatal(
                { channel: channelName, channels: this.channels.channels },
                `Triggers missing for Channel ${channelName}`,
            );
        }

        // Handle Identification requests
        if (this.channels.channels[channelName].triggers.some((trigger) => message.includes(trigger.keyword))) {
            this.handleSongIdentification(channelName, sender, message, client);
        }
    }

    /**
     * Handle mentions of the bot or any other keywords specified in environment
     * @param channel Channel the bot was mentioned in
     * @param message Message including the keyword
     * @param sender Name of the message sender
     */
    public async handleMention(channelName: string, message: string, sender: string): Promise<void> {
        // GraphQL Query to get Id of the Channel
        const query = gql`
            query {
                channel(name: "${channelName}") {
                    id
                }
            }
        `;

        // Perform Query to get Id of the Channel
        const channel = await this.gql.request(query);

        // GraphQL Query to insert the Mention
        const mutation = gql`
            mutation {
                createMention(
                    mention: {
                        channelId: ${channel.channel.id}
                        message: "${message}"
                        sender: "${sender}"
                        timestamp: "${new Date()}"
                    }
                ) {
                    channelId
                    message
                    sender
                    timestamp
                }
            }
        `;

        this.logger.pino.info({ channel: channelName }, `Mention Trigger hit by ${sender} in Channel ${channelName}`);

        // Perform Query to insert Mention
        await this.gql.request(mutation);
    }

    /**
     * Handle Song identification Requests
     * @param channelName Name of the Channel currently playing Songs were requested for
     * @param requester Name of the Person who requested the Songs
     * @param client Twitch Client instance used to reply with
     */
    public async handleSongIdentification(
        channelName: string,
        requester: string,
        message: string,
        client: tmi.Client,
    ): Promise<void> {
        // Check if Channel already has an Idenfiticaion pending
        if (this.channels.pendingChannels.includes(channelName)) {
            return this.logger.pino.info(
                { channel: channelName },
                `Song identification for Channel ${channelName} is already in progress`,
            );
        }

        // Check if Channel is currently on cooldown
        const cooldown = await this.channels.isOnCooldown(channelName);

        if (cooldown.onCooldown) {
            // Check if cooldown message was already sent
            if (this.channels.cooldownMessageSent.includes(channelName)) {
                this.logger.pino.info(
                    { channel: channelName },
                    `Cooldown message was already sent in Channel ${channelName}`,
                );
            } else {
                this.logger.pino.info({ channel: channelName }, `Sending cooldown message in Channel ${channelName}`);
                this.channels.cooldownMessageSent.push(channelName);

                const message = this.composer.cooldown(
                    channelName,
                    requester,
                    cooldown.untilNext || 0,
                    cooldown.identification,
                );

                this.logger.pino.info({ channel: channelName, chatMessage: message }, `Sending Message: ${message}`);

                // Send message the normal way or as action, depending on Channel preferences
                this.channels.channels[channelName].useAction
                    ? client.action(channelName, message)
                    : client.say(channelName, message);
            }
        } else {
            // Add Channel to currently pending Channels
            this.channels.pendingChannels.push(channelName);

            // Get Songs playing in Channel
            const songs = await this.identifier.nowPlaying(channelName, requester, message);

            // Remove Channel from pending and cooldownMessageSent Channels
            this.channels.pendingChannels = this.channels.pendingChannels.filter((channel) => channel !== channelName);
            this.channels.cooldownMessageSent = this.channels.cooldownMessageSent.filter(
                (channel) => channel !== channelName,
            );

            // Send response in Twitch chat
            if (songs.length > 0) {
                // Compose Succes message
                const message = this.composer.success(channelName, requester, songs[0]);

                this.logger.pino.info({ channel: channelName, chatMessage: message }, `Sending Message: ${message}`);

                // Send message the normal way or as action, depending on Channel preferences
                this.channels.channels[channelName].useAction
                    ? client.action(channelName, message)
                    : client.say(channelName, message);
            } else {
                // Compose Error message
                const message = this.composer.error(channelName, requester, "No Songs found");

                this.logger.pino.info({ channel: channelName, chatMessage: message }, `Sending Message: ${message}`);

                // Send message the normal way or as action, depending on Channel preferences
                this.channels.channels[channelName].useAction
                    ? client.action(channelName, message)
                    : client.say(channelName, message);
            }
        }
    }
}

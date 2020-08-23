import { gql, GraphQLClient } from "graphql-request";
import signale from "signale";
import * as tmi from "tmi.js";
import { environment } from "../environment";
import { Channels } from "./channels";
import { MessageComposer } from "./composer";
import { Identifier } from "./identifier";

export class MessageHandler {
    /**
     * GraphQL Client Instance
     */
    private gql: GraphQLClient;

    constructor(private channels: Channels, private composer: MessageComposer, private identifier: Identifier) {
        // Initialize new GraphQL Client
        this.gql = new GraphQLClient(environment.gql.url).setHeader("Authorization", `Bearer ${environment.gql.token}`);
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
        channelName = channelName.replace("#", "");
        message = message.toLowerCase();

        // Handle Mentions
        if (environment.mentionTriggers.some((trigger) => message.includes(trigger))) {
            this.handleMention(channelName, message, sender);
        }

        // FIXME: Handle not found Channels, needs investigation
        if (!this.channels.channels[channelName]) {
            return signale.fatal(`Could not find Triggers for Channel ${channelName}`);
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
                channel(channelName: "${channelName}") {
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
            return signale.debug(`Itendification for Channel ${channelName} already in progress`);
        }

        // Check if Channel is currently on cooldown
        const cooldown = await this.channels.isOnCooldown(channelName);

        if (cooldown.onCooldown) {
            // Check if cooldown message was already sent
            if (this.channels.cooldownMessageSent.includes(channelName)) {
                signale.info(`Cooldown message was already sent in Channel ${channelName}`);
            } else {
                signale.info(`Sending cooldown message in Channel ${channelName}`);
                this.channels.cooldownMessageSent.push(channelName);

                signale.info(
                    this.composer.cooldown(channelName, requester, cooldown.untilNext || 0, cooldown.identification),
                );

                // signale.info(
                //     "Sending message:",
                //     this.composer.cooldown(channelName, requester, cooldown.untilNext || 0, cooldown.identification),
                // );
                client.say(
                    channelName,
                    this.composer.cooldown(channelName, requester, cooldown.untilNext || 0, cooldown.identification),
                );
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
                // signale.info("Sending message:", this.composer.success(channelName, requester, songs[0]));
                client.say(channelName, this.composer.success(channelName, requester, songs[0]));
            } else {
                // signale.info("Sending message:", this.composer.error(channelName, requester, "No Songs were found"));
                client.say(channelName, this.composer.error(channelName, requester, "No Songs were found"));
            }
        }
    }
}

import * as Sentry from "@sentry/node";

import { ChatClient, ChatUser } from "twitch-chat-client/lib";

import MessageComposer from "./composer";
import Identifier from "./identifier";
import Channels from "./channels";
import { ApiClient } from "twitch/lib";
import { LATEST_IDENTIFICATION } from "../queries/queries";
import { Identification } from "../interfaces/identification.interface";
import GraphQL from "./graphql";

import { Signale } from "signale";

export default class MessageHandler {
    /**
     * Twitch ApiClient Instance
     */
    public api?: ApiClient;

    constructor(private graphql: GraphQL, private channels: Channels, private composer: MessageComposer, private identifier: Identifier) {}

    /**
     * Message Handler processing every Message the Bot receives
     * @param channel Name of the Channel the Message was received in
     * @param message String containing the received Message
     * @param user ChatUser containing User details of the sender
     * @param client ChatClient which received the Message
     * @returns Promise resolving once the Message was processed
     */
    public async handle(channel: string, message: string, user: ChatUser, client: ChatClient): Promise<void> {
        // Strip leading `#` from Channel name
        channel = channel.toLowerCase().replace("#", "");

        const logger = new Signale().scope("Handler", channel, "handle");

        const isHostChannel = channel === this.channels.client?.currentNick?.toLowerCase();
        const command = message.toLowerCase().split(" ")[0];
        const target = message.toLowerCase().split(" ")[1];

        // Handle identification requests from host channels
        if (isHostChannel) {
            // Abort if message does not contain one of these commands
            if (!["!song", "!id", "!identify"].includes(command))
                return client.action(
                    channel,
                    `Want to know what song is playing in a channel? Type !song <channel> – Want me in your chat? → https://adams.sh/id`,
                );

            // Check if a `target` was specified
            if (!target) {
                logger.warn("No target specified");
                return client.action(channel, `Please provide a channel name! Command usage: ${command} <channel>`);
            }

            // Check if target Channel is live
            const stream = await this.api?.helix?.streams?.getStreamByUserName(target);
            if (!stream) {
                logger.warn("Channel is offline");
                return client.action(channel, `${target} seems to be offline. Please try again with a live channel.`);
            }

            return this.identify(channel, target, user, message, client);
        }

        // Get Configuration for current Channel
        const config = this.channels.configurations.get(channel);

        // Check if configuration exists for Channel
        if (!config) {
            logger.error("Could not find Channel configuration");
            Sentry.captureException(new Error(`Received Message from Channel \`${channel}\` which has no configuration`));
            return;
        }

        // Check if user is ignored in Channel
        if (config.ignored?.some((name) => name.toLowerCase() === user.userName.toLowerCase())) {
            logger.warn(`Ignoring message from \`${user.userName}\``);
            return;
        }

        // Handle Identifications
        if (config.triggers.some((trigger) => message.toLowerCase().includes(trigger.keyword))) {
            // Check if Channel is live
            const stream = await this.api?.helix?.streams?.getStreamByUserName(channel);
            if (!stream)
                return this.composer.send(client, config, `${channel} seems to be offline. Please try again when the channel is live.`);

            this.identify(channel, channel, user, message, client);
        }
    }

    /**
     * Identify Songs playing in a Channel
     * @param host Channel the command was sent in
     * @param target Target Channel to identify Song in
     * @param user ChatUser containing requester details
     * @param message Message which triggered the identification process
     * @param client ChatClient to respond with
     * @returns Promise resolving once the Identification finished
     */
    public async identify(host: string, target: string, user: ChatUser, message: string, client: ChatClient): Promise<void> {
        const logger = new Signale().scope("Handler", target, "identify");

        logger.start(`Identification requested by ${user.userName}`);

        // If identification was requested for the Channel the command was sent in
        if (host === target) {
            try {
                // Get Channel configuration
                const config = this.channels.configurations.get(target);
                if (!config) {
                    logger.error("Could not find Channel configuration");
                    throw new Error("Could not find Channel configuration");
                }

                // Check if Identification is already in progress in Channel
                if (this.channels.pending.get(config.id)) return logger.warn("Identification is already in progress");

                // Get the latest Identification for the Channel
                const latest: Identification = await this.graphql.client
                    .query({
                        query: LATEST_IDENTIFICATION,
                        variables: { id: config.id },
                    })
                    .then((res) => res.data.identifications[0]);

                // Check if the Channel is currently on cooldown
                if (latest && config.cooldown > latest.since) {
                    // Check if the cooldown notice was already sent in Channel
                    if (this.channels.cooldownNotice.get(config.id)) return logger.warn("Cooldown notice was already sent");

                    this.channels.cooldownNotice.set(config.id, true);

                    const response = this.composer.COOLDOWN(config, user, config.cooldown - latest.since, latest);

                    return this.composer.send(client, config, response).then(() => {
                        logger.scope(host).success("Sent cooldown notice");
                    });
                }

                // Mark Channel as `pending`
                this.channels.pending.set(config.id, true);

                logger.await("Analyzing...");

                // Forcefully reset Channels `pending` and `cooldownNotice` state after 10 seconds
                setTimeout(() => {
                    this.channels.pending.set(config.id, false);
                    this.channels.cooldownNotice.set(config.id, false);
                }, 10000);

                // Identify Songs
                const identification = await this.identifier.identify(target, user.userName, message);
                const { songs } = identification;

                songs.length > 0 ? logger.success(`Identified ${songs.length} songs`) : logger.warn("No result");

                // Reset Channel
                this.channels.pending.set(config.id, false);
                this.channels.cooldownNotice.set(config.id, false);

                // Respond with identified Songs
                const response =
                    songs.length > 0
                        ? this.composer.SUCCESS(config, user, identification)
                        : this.composer.ERROR(config, user, "No result, we didn't quite catch that.");

                await this.composer.send(client, config, response);
                logger.success("Sent response");
            } catch (error) {
                logger.error("Error identifying songs");
                logger.error(error);

                Sentry.captureException(error);

                // Get Channel configuration
                const config = this.channels.configurations.get(target);
                if (!config) {
                    logger.error("Could not find Channel configuration");
                    throw new Error("Could not find Channel configuration");
                }

                // Reset Channel
                this.channels.pending.set(config.id, false);
                this.channels.cooldownNotice.set(config.id, false);

                // Respond with error message
                await this.composer.send(client, config, `@${user.displayName} → Something went wrong! ${error.message}`);
                logger.success("Sent error response");
            }
        }

        // If identification was requested for a different Channel
        if (host !== target) {
            try {
                logger.await("Analyzing...");

                // Identify Songs for targetChannel
                const identification = await this.identifier.identify(target, user.userName, message);
                const { songs } = identification;

                songs.length > 0 ? logger.success(`Identified ${songs.length} songs`) : logger.warn("No result");

                await (songs.length > 0
                    ? client.action(
                          host,
                          `${target} is currently playing "${songs[0].title}" by ${this.composer.getArtists(
                              songs[0].artists,
                          )} → https://id.adams.sh/id/${identification.id}`,
                      )
                    : client.action(host, `No results in channel ${target}`));

                logger.scope(host).success("Sent response");
            } catch (error) {
                logger.error("Error identifying songs");
                logger.error(error);

                Sentry.captureException(error);

                await client.action(host, `Something went wrong! ${error.message}`);
                logger.scope(host).success("Sent error response");
            }
        }
    }
}

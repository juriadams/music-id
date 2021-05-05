import * as Sentry from "@sentry/node";

import { ChatClient, ChatUser } from "twitch-chat-client/lib";
import signale from "signale";

import MessageComposer from "./composer";
import Identifier from "./identifier";
import Channels from "./channels";
import { ApiClient } from "twitch/lib";
import { LATEST_IDENTIFICATION } from "../queries/queries";
import { Identification } from "../interfaces/identification.interface";
import GraphQL from "./graphql";

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
            if (!target) return client.action(channel, `Please provide a channel name! Command usage: ${command} <channel>`);

            // Check if target Channel is live
            const stream = await this.api?.helix?.streams?.getStreamByUserName(target);
            if (!stream) return client.action(channel, `${target} seems to be offline. Please try again with a live channel.`);

            return this.identify(channel, target, user, message, client);
        }

        // Get Configuration for current Channel
        const config = this.channels.configurations.get(channel);

        // Check if configuration exists for Channel
        if (!config) {
            signale.error(`Received Message from Channel \`${channel}\` which has no configuration`);
            Sentry.captureException(new Error(`Received Message from Channel \`${channel}\` which has no configuration`));
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
        signale.scope(host).start(`Song identification requested for Channel \`${target}\` by \`${user.userName}\``);

        // If identification was requested for the Channel the command was sent in
        if (host === target) {
            try {
                signale.scope(host).await("Fetching Channel configuration");

                // Get Channel configuration
                const config = this.channels.configurations.get(target);
                if (!config) throw new Error(`Could not find Channel configuration`);

                // Check if Identification is already in progress in Channel
                if (this.channels.pending.get(config.id)) return signale.scope(host).warn("Identification is already in progress");

                // Get the latest Identification for the Channel
                const latest: Identification = await this.graphql.client
                    .query({
                        query: LATEST_IDENTIFICATION,
                        variables: { id: config.id },
                    })
                    .then((res) => res.data.identifications[0]);

                // Check if the Channel is currently on cooldown
                if (config.cooldown > latest.since) {
                    // Check if the cooldown notice was already sent in Channel
                    if (this.channels.cooldownNotice.get(config.id)) return signale.scope(host).warn("Cooldown notice was already sent");

                    signale.scope(host).await("Sending cooldown notice");
                    this.channels.cooldownNotice.set(config.id, true);

                    const response = this.composer.COOLDOWN(config, user, config.cooldown - latest.since, latest);

                    return this.composer.send(client, config, response).then(() => {
                        signale.scope(host).success("Sent cooldown notice");
                    });
                }

                // Mark Channel as `pending`
                this.channels.pending.set(config.id, true);

                signale.scope(host).await("Listening...");

                // Forcefully reset Channels `pending` and `cooldownNotice` state after 10 seconds
                setTimeout(() => {
                    this.channels.pending.set(config.id, false);
                    this.channels.cooldownNotice.set(config.id, false);
                }, 10000);

                // Identify Songs
                const identification = await this.identifier.identify(target, user.userName, message);
                const { songs } = identification;

                songs.length > 0 ? signale.scope(host).success(`Identified ${songs.length} Songs`) : signale.scope(host).warn("No result");

                // Reset Channel
                this.channels.pending.set(config.id, false);
                this.channels.cooldownNotice.set(config.id, false);

                // Respond with identified Songs
                const response =
                    songs.length > 0
                        ? this.composer.SUCCESS(config, user, songs[0])
                        : this.composer.ERROR(config, user, "No result, we didn't quite catch that.");

                await this.composer.send(client, config, response);
                signale.scope(host).success("Sent response");
            } catch (error) {
                Sentry.captureException(error);

                signale.scope(host).error("Something went wrong while identifying Songs");
                signale.scope(host).error(error);

                // Get Channel configuration
                const config = this.channels.configurations.get(target);
                if (!config) throw new Error(`Could not find Channel configuration`);

                // Reset Channel
                this.channels.pending.set(config.id, false);
                this.channels.cooldownNotice.set(config.id, false);

                // Respond with error message
                await this.composer.send(client, config, `@${user.displayName} → Something went wrong! ${error.message}`);
                signale.scope(host).success("Sent error message");
            }
        }

        // If identification was requested for a different Channel
        if (host !== target) {
            try {
                signale.scope(host).await("Listening...");

                // Identify Songs for targetChannel
                const identification = await this.identifier.identify(target, user.userName, message);
                const { songs } = identification;

                songs.length > 0 ? signale.scope(host).success(`Identified ${songs.length} Songs`) : signale.scope(host).warn("No result");

                await (songs.length > 0
                    ? client.action(
                          host,
                          `${target} is currently playing "${songs[0].title}" by ${this.composer.getArtists(
                              songs[0].artists,
                          )} → Stream it here: ${songs[0].url}`,
                      )
                    : client.action(host, ""));

                signale.scope(host).success("Sent response");
            } catch (error) {
                signale.scope(host).error("Something went wrong while identifying Songs");
                signale.scope(host).error(error);

                Sentry.captureException(error);

                await client.action(host, `Something went wrong! ${error.message}`);
                signale.scope(host).success("Sent error message");
            }
        }
    }
}

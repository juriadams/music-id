import * as Sentry from "@sentry/node";

import { ChatClient, ChatUser } from "twitch-chat-client/lib";
import signale from "signale";

import MessageComposer from "./composer";
import Identifier from "./identifier";
import Channels from "./channels";
import { ApiClient } from "twitch/lib";

export default class MessageHandler {
    /**
     * Twitch API Client Instance
     */
    public api?: ApiClient;

    constructor(private channels: Channels, private composer: MessageComposer, private identifier: Identifier) {}

    /**
     * Main Message Handler which processes every Chat Message
     * @param channel Name of the Channel the Message was sent in
     * @param message Raw Chat Message which was received
     * @param sender User who sent the Message
     * @param client Twitch client instance
     */
    public async handle(channel: string, message: string, user: ChatUser, client: ChatClient): Promise<void> {
        channel = channel.toLowerCase().replace("#", "");

        const isHostChannel = ["mr4dams", "twitchmusicid", this.channels.client?.currentNick].includes(channel);
        const command = message.toLowerCase().split(" ")[0];
        const target = message.toLowerCase().split(" ")[1];

        // Handle identifications for different Channels
        if (isHostChannel && ["!song", "!id", "!identify"].includes(command)) {
            if (!target) return client.action(channel, `Please provide a channel name! Command usage: ${command} <channel>`);

            // Check if Channel is live
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
                return config.actions
                    ? client.action(channel, `${channel} seems to be offline. Please try again with a live channel.`)
                    : client.say(channel, `${channel} seems to be offline. Please try again with a live channel.`);

            this.identify(channel, channel, user, message, client);
        }
    }

    /**
     * Identify Songs playing in a Channel
     * @param host Channel the bot will respond in
     * @param target Channel to identify Songs in
     * @param user ChatUser who requested identification
     * @param message Message used to start identification
     * @param client ChatClient to respond with
     * @returns A Promise resolving nothing
     */
    public async identify(host: string, target: string, user: ChatUser, message: string, client: ChatClient): Promise<void> {
        signale.start(`Song identification requested for Channel \`${target}\` by \`${user.userName}\``);

        // If identification was requested for the Channel the command was sent in
        if (host === target) {
            try {
                signale.await(`Fetching configuration for Channel \`${target}\``);

                // Get Channel configuration
                const config = this.channels.configurations.get(target);
                if (!config) {
                    signale.error(`Could not find configuration for target Channel \`${target}\``);
                    throw new Error(`Could not find configuration for target Channel \`${target}\``);
                }

                // Check if Identification is already in progress in Channel
                if (this.channels.pending.get(config.id))
                    return signale.warn(`Song identification is already in Progress in target Channel \`${target}\``);

                // Check if Identifications are currently on cooldown for this Channel
                const cooldown = await this.channels.onCooldown(config);
                if (cooldown.onCooldown) {
                    // Check if the cooldown notice was already sent in Channel
                    if (this.channels.cooldownNotice.get(config.id))
                        return signale.warn(`Cooldown notice was already sent in target Channel \`${target}\``);

                    signale.await(`Sending cooldown notice`);
                    this.channels.cooldownNotice.set(config.id, true);

                    const response = this.composer.COOLDOWN(config, user, cooldown.remaining || 0, cooldown.identification);

                    return this.composer.send(config, user, response, client).then(() => {
                        signale.success(`Sent cooldown notice in Channel \`${target}\``);
                    });
                }

                // Mark Channel as `pending`
                this.channels.pending.set(config.id, true);

                signale.await("Waiting for results");

                // Identify Songs for targetChannel
                const identification = await this.identifier.identify(target, user.userName, message);
                const { songs } = identification;

                songs.length > 0
                    ? signale.success(`Identified ${songs.length} Songs for target Channel \`${target}\``)
                    : signale.warn(`Could not identify any Songs for target Channel \`${target}\``);

                // Reset Channel
                this.channels.pending.set(config.id, false);
                this.channels.cooldownNotice.set(config.id, false);

                // Respond with identified Songs
                const response =
                    songs.length > 0
                        ? this.composer.SUCCESS(config, user, songs[0])
                        : this.composer.ERROR(config, user, "Could not identify any Songs");

                return this.composer.send(config, user, response, client).then(() => {
                    signale.success(`Sent response in Channel \`${host}\``);
                });
            } catch (error) {
                Sentry.captureException(error);

                signale.error(`Unexpected error while identifying Songs in target Channel \`${target}\``);
                signale.error(error);

                const config = this.channels.configurations.get(target);
                if (!config) {
                    signale.error(`Could not find configuration for target Channel \`${target}\``);
                    throw new Error(`Could not find configuration for target Channel \`${target}\``);
                }

                // Reset Channel
                this.channels.pending.set(config.id, false);
                this.channels.cooldownNotice.set(config.id, false);

                // Respond with error message
                return this.composer.send(config, user, `@${user.displayName} → Unexpected error: ${error.message}`, client).then(() => {
                    signale.success(`Sent error message in Channel \`${host}\``);
                });
            }
        }

        // If identification was requested for a different Channel
        if (host !== target) {
            try {
                signale.await("Waiting for results");

                // Identify Songs for targetChannel
                const identification = await this.identifier.identify(target, user.userName, message);
                const { songs } = identification;

                songs.length > 0
                    ? signale.success(`Identified ${songs.length} Songs for target Channel \`${target}\``)
                    : signale.warn(`Could not identify any Songs for target Channel \`${target}\``);

                return songs.length > 0
                    ? client.action(host, `@${user.displayName} → Detected "${songs[0].title}" by ${songs[0].artists}`).then(() => {
                          signale.success(`Sent response in Channel \`${host}\``);
                      })
                    : client.action(host, `@${user.displayName} → Could not identify any Songs`).then(() => {
                          signale.success(`Sent response in Channel \`${host}\``);
                      });
            } catch (error) {
                Sentry.captureException(error);

                signale.error(`Unexpected error while identifying Songs in target Channel \`${target}\``);
                signale.error(error);

                client.action(host, `@${user.displayName} → Unexpected error: ${error.message}`).then(() => {
                    signale.success(`Sent error message in Channel \`${host}\``);
                });
            }
        }
    }
}

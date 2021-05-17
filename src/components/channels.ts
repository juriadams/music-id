import * as Sentry from "@sentry/node";

import { ChatClient } from "twitch-chat-client/lib";

import { Channel } from "../interfaces/channel.interface";

import GraphQL from "./graphql";
import { CHANNEL, CHANNELS, CHANNEL_ADDED, CHANNEL_DELETED, CHANNEL_UPDATED, UPDATE_CHANNEL } from "../queries/queries";

import { Signale } from "signale";

export default class Channels {
    /**
     * Map containing all Channel configurations
     * @key Name of the Channel, lowercase and without leading `#`
     * @value Value is the Channel configuration
     */
    public configurations = new Map<string, Channel>();

    /**
     * Map containing all Channels which were pending at some point
     * @key Name of the Channel, lowercase and without leading `#`
     * @value Boolean if the Channel is currently "pending"
     */
    public pending = new Map<string, boolean>();

    /**
     * Map containing all Channels in which a cooldown notice was sent at some point
     * @key Name of the Channel, lowercase and without leading `#`
     * @value Boolean if the cooldown notice was previously sent
     */
    public cooldownNotice = new Map<string, boolean>();

    /**
     * Array of Channels the Bot is currently part of, this is a temporary solution
     * for a missing `twitch-chat-client` feature
     */
    public partOf: string[] = [];

    /**
     * ChatClient instance set in the TwitchClient class after initialization
     */
    public client?: ChatClient;

    constructor(private graphql: GraphQL) {}

    /**
     * Fetch the Configuration for a specific Channel
     * @param id The `id` of the Channel to fetch
     * @returns Channel configuration
     */
    public async getChannel(id: string): Promise<Channel> {
        const logger = new Signale().scope("Channels", id, "getChannel");

        logger.await("Fetching Channel configuration");

        return this.graphql.client
            .query({ query: CHANNEL, variables: { id } })
            .then((res) => res.data.channel)
            .catch((error) => {
                logger.error("Error fetching Channel configuration");
                logger.error(error);

                Sentry.captureException(error);

                throw new Error(`Error fetching Channel configuration for \`${id}\``);
            });
    }

    /**
     * Listen to various GraphQL Subscriptions
     */
    public listen(): void {
        // Listen for Channel additions
        this.graphql.client
            .subscribe({
                query: CHANNEL_ADDED,
            })
            .subscribe({
                next: async (res) => {
                    const id = res.data.channelAdded.id;

                    const logger = new Signale().scope("Channels", id, "channelAdded");
                    logger.info("Channel was added");

                    try {
                        logger.await("Fetching Channel configuration");

                        const channel = await this.getChannel(id);
                        logger.info(channel);

                        // Store Channel configuration
                        this.configurations.set(channel.name, channel);
                        this.pending.set(channel.name, false);
                        this.cooldownNotice.set(channel.name, false);

                        this.client
                            ?.join(channel.name)
                            .then(() => {
                                logger.success(`Joined Channel ${channel.name}`);
                                this.partOf.push(channel.name);
                            })
                            .catch((error) => {
                                logger.error(`Error joining Channel ${channel.name}`);
                                logger.error(error);
                            });
                    } catch (error) {
                        logger.error("Error fettching Channel configuration");
                        logger.error(error);

                        Sentry.captureException(error);

                        throw new Error(`Error fettching Channel configuration for \`${id}\``);
                    }
                },
                error: (error) => {
                    const logger = new Signale().scope("Channels", "channelAdded");

                    logger.error("Error processing `channelAdded` event");
                    logger.error(error);

                    Sentry.captureException(error);
                },
            });

        // Listen for Channel updates
        this.graphql.client
            .subscribe({
                query: CHANNEL_UPDATED,
            })
            .subscribe({
                next: async (res) => {
                    const id = res.data.channelUpdated.id;

                    const logger = new Signale().scope("Channels", id, "channelUpdated");
                    logger.info("Channel was updated");

                    try {
                        logger.await("Fetching Channel configuration");

                        const channel = await this.getChannel(id);
                        logger.info(channel);

                        // Store Channel configuration
                        this.configurations.set(channel.name, channel);
                        this.pending.set(channel.name, false);
                        this.cooldownNotice.set(channel.name, false);

                        if (this.partOf.includes(channel.name) && !channel.enabled) {
                            logger.info(`Leaving Channel \`${channel.name}\` since it was deactivated`);
                            this.partOf = this.partOf.filter((c) => c !== channel.name);
                            this.client?.part(channel.name);
                        }

                        if (!this.partOf.includes(channel.name) && channel.enabled) {
                            logger.info(`Joining Channel \`${channel.name}\` since it was activated`);
                            this.client
                                ?.join(channel.name)
                                .then(() => {
                                    logger.success(`Joined Channel \`${channel.name}\``);
                                    this.partOf.push(channel.name);
                                })
                                .catch((error) => {
                                    logger.error(`Error joining Channel ${channel.name}`);
                                    logger.error(error);
                                });
                        }
                    } catch (error) {
                        logger.error("Error fettching Channel configuration");
                        logger.error(error);

                        Sentry.captureException(error);

                        throw new Error(`Error fettching Channel configuration for \`${id}\``);
                    }
                },
                error: (error) => {
                    const logger = new Signale().scope("Channels", "channelUpdated");

                    logger.error("Error processing `channelUpdated` event");
                    logger.error(error);

                    Sentry.captureException(error);
                },
            });

        // Listen for Channel deletions
        this.graphql.client
            .subscribe({
                query: CHANNEL_DELETED,
            })
            .subscribe({
                next: async (res) => {
                    const id = res.data.channelDeleted.id;

                    const logger = new Signale().scope("Channels", id, "channelDeleted");
                    logger.info("Channel was deleted");

                    try {
                        logger.await("Fetching Channel configuration");

                        const channel = this.configurations.get(id);
                        if (!channel) {
                            logger.error("No such Channel inside memory storage");
                            return;
                        }

                        logger.info(channel);

                        // Delete Channel configuration from memory
                        this.configurations.delete(id);
                        this.client?.part(channel.name);
                        this.partOf = this.partOf.filter((c) => c !== channel.name);
                    } catch (error) {
                        logger.error("Error fettching Channel configuration");
                        logger.error(error);

                        Sentry.captureException(error);

                        throw new Error(`Error fettching Channel configuration for \`${id}\``);
                    }
                },
                error: (error) => {
                    const logger = new Signale().scope("Channels", "channelDeleted");

                    logger.error("Error processing `channelDeleted` event");
                    logger.error(error);

                    Sentry.captureException(error);
                },
            });
    }

    /**
     * Update the Configuration for a Channel
     * @param id The `id` of the Channel to update
     * @returns Updated Channel Configuration
     */
    public async updateChannel(id: string): Promise<Channel> {
        const logger = new Signale().scope("Channels", id, "updateChannel");
        logger.await("Updating Channel configuration");

        try {
            const channel = await this.graphql.client
                .query({
                    query: CHANNEL,
                    variables: { id },
                })
                .then((res) => res.data.channel);

            // Store the updated Configuration
            this.configurations.set(channel.name, channel);
            this.pending.set(channel.name, false);
            this.cooldownNotice.set(channel.name, false);

            logger.success("Updated Channel configuration");

            return channel;
        } catch (error) {
            logger.error("Error updating Channel configuration");
            logger.error(error);

            Sentry.captureException(error);

            throw new Error(`Error updating Channel configuration for \`${id}\``);
        }
    }

    /**
     * Fetch all Channel configurations
     * @returns Array of Channel names
     */
    public async getConfigurations(): Promise<string[]> {
        const logger = new Signale().scope("Channels", "getConfigurations");
        logger.await("Fetching Channel configurations");

        try {
            let channels = await this.graphql.client
                .query({
                    query: CHANNELS,
                })
                .then((res) => res.data.channels);

            if (process.env.NODE_ENV !== "production") channels = [channels[0]];

            logger.success(`Received ${channels.length} configurations`);

            return channels.map((channel: Channel) => {
                // Store Channel configurations
                this.configurations.set(channel.name, channel);
                this.pending.set(channel.name, false);
                this.cooldownNotice.set(channel.name, false);

                // Return only the name of the Channel
                return channel.name;
            });
        } catch (error) {
            logger.error("Error fetching Channel configurations");
            logger.error(error);

            Sentry.captureException(error);

            throw new Error("Error fetching Channel configurations");
        }
    }

    /**
     * Disable a specific Channel
     * @param channel `name` of the Channel to disable
     * @param reason Reason why the channel was disabled
     * @returns Updated (disabled) Channel configuration
     */
    public async disableChannel(channel: string, reason: string): Promise<Channel> {
        const logger = new Signale().scope("Channels", channel, "disableChannel");
        logger.await("Disabling Channel");
        logger.info("Reason:", reason);

        // Get Channel configuration from memory store
        const config = this.configurations.get(channel);

        if (!config) {
            logger.error("No such Channel inside memory storage");
            throw new Error("No such Channel inside memory storage");
        }

        return this.graphql.client
            .mutate({
                mutation: UPDATE_CHANNEL,
                variables: { id: config.id, enabled: false, reason },
            })
            .then((res) => {
                logger.success("Disabled Channel");
                return res.data.updateChannel;
            })
            .catch((error) => {
                logger.error("Error disabling Channel");
                logger.error(error);

                Sentry.captureException(error);

                throw new Error(`Error disabling Channel \`${channel}\``);
            });
    }
}

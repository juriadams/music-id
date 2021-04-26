import * as Sentry from "@sentry/node";

import { ChatClient } from "twitch-chat-client/lib";
import signale from "signale";

import { Channel } from "../interfaces/channel.interface";
import { Identification } from "../interfaces/identification.interface";

import GraphQL from "./graphql";
import {
    CHANNEL,
    CHANNELS,
    CHANNEL_ADDED,
    CHANNEL_DELETED,
    CHANNEL_UPDATED,
    LATEST_IDENTIFICATION,
    UPDATE_CHANNEL,
} from "../queries/queries";

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
     * Get a full Channel configuration by its Id
     * @param id Id of the Channel configuration to get
     */
    public async getChannel(id: string): Promise<Channel> {
        return this.graphql.client
            .query({ query: CHANNEL, variables: { id } })
            .then((res) => res.data.channel)
            .catch((error) => {
                Sentry.captureException(error);

                signale.error(`Unexpected error while fetching configuration for Channel \`${id}\``);
                signale.error(error);
                throw new Error(`Unexpected error while fetching configuration for Channel \`${id}\``);
            });
    }

    /**
     * Start listening for Channel additions, updates and deletions
     */
    public listen(): void {
        signale.await("Listening for Channel changes");

        // Listen for Channel additions
        this.graphql.client
            .subscribe({
                query: CHANNEL_ADDED,
            })
            .subscribe({
                next: async (res) => {
                    const id = res.data.channelAdded.id;

                    try {
                        const channel = await this.getChannel(id);

                        signale.scope(channel.name).info(`New Channel \`${channel.name}\` was added`);

                        // Store Channel configuration
                        this.configurations.set(channel.name, channel);
                        this.pending.set(channel.name, false);
                        this.cooldownNotice.set(channel.name, false);

                        this.client
                            ?.join(channel.name)
                            .then(() => {
                                signale.success(`Joined Channel \`${channel.name}\``);
                                this.partOf.push(channel.name);
                            })
                            .catch((error) => {
                                signale.error(`Error joining Channel \`${channel.name}\``);
                                signale.error(error);
                            });
                    } catch (error) {
                        Sentry.captureException(error);

                        signale.error(`Error fetching configuration for Channel with Id \`${id}\``);
                        throw new Error(`Error fetching configuration for Channel with Id \`${id}\``);
                    }
                },
                error: (error) => {
                    Sentry.captureException(error);

                    signale.error("An error occurred while processing a `channelAdded` event");
                    signale.error(error);
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

                    try {
                        const channel = await this.getChannel(id);

                        signale.info(`Configuration for Channel \`${channel.name}\` was updated`);
                        signale.info(channel);

                        // Store Channel configuration
                        this.configurations.set(channel.name, channel);
                        this.pending.set(channel.name, false);
                        this.cooldownNotice.set(channel.name, false);

                        if (this.partOf.includes(channel.name) && !channel.enabled) {
                            signale.info(`Leaving Channel \`${channel.name}\` because it is no longer \`enabled\``);
                            this.partOf = this.partOf.filter((c) => c !== channel.name);
                            this.client?.part(channel.name);
                        }

                        if (!this.partOf.includes(channel.name) && channel.enabled) {
                            signale.scope(channel.name).info(`Joining Channel because it was \`enabled\` again`);
                            this.client
                                ?.join(channel.name)
                                .then(() => {
                                    signale.success(`Joined Channel \`${channel.name}\``);
                                    this.partOf.push(channel.name);
                                })
                                .catch((error) => {
                                    signale.error(`Error joining Channel \`${channel}\``);
                                    signale.error(error);
                                });
                        }
                    } catch (error) {
                        Sentry.captureException(error);

                        signale.error(`Error fetching configuration for Channel with Id \`${id}\``);
                        throw new Error(`Error fetching configuration for Channel with Id \`${id}\``);
                    }
                },
                error: (error) => {
                    Sentry.captureException(error);

                    signale.error("An error occurred while processing a `channelUpdated` event");
                    signale.error(error);
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
                    const channel = this.configurations.get(id);

                    if (!channel)
                        return signale.warn(`Could not find configuration for Channel with Id \`${id}\`, hence nothing to unlink`);

                    signale.info(`Configuration for Channel \`${channel.name}\` was deleted`);

                    this.configurations.delete(id);
                    this.partOf = this.partOf.filter((c) => c !== channel.name);
                    this.client?.part(channel.name);
                },
                error: (error) => {
                    Sentry.captureException(error);

                    signale.error("An error occurred while processing a `channelDeleted` event");
                    signale.error(error);
                },
            });
    }

    /**
     * Update the configuration for a specific Channel
     * @returns Configuration object for the Channel
     */
    public async updateChannel(id: string): Promise<Channel> {
        try {
            const channel = await this.graphql.client
                .query({
                    query: CHANNEL,
                    variables: { id },
                })
                .then((res) => res.data.channel);

            this.configurations.set(channel.name, channel);
            this.pending.set(channel.name, false);
            this.cooldownNotice.set(channel.name, false);

            return channel;
        } catch (error) {
            Sentry.captureException(error);

            signale.fatal(`An unexpected error occurred while fetching the Channel configuration for ${id}`);
            signale.fatal(error);

            throw new Error(`An unexpected error occurred while fetching the Channel configuration for ${id}`);
        }
    }

    /**
     * Get Channel configurations for all enabled Channels
     * @returns Array of Channel names
     */
    public async getConfigurations(): Promise<string[]> {
        try {
            let channels = await this.graphql.client
                .query({
                    query: CHANNELS,
                })
                .then((res) => res.data.channels);

            if (process.env.NODE_ENV !== "production") {
                channels = [channels[0]];
            }

            return channels.map((channel: Channel) => {
                // Store Channel configurations
                this.configurations.set(channel.name, channel);
                this.pending.set(channel.name, false);
                this.cooldownNotice.set(channel.name, false);

                // Return only the name of the Channel
                return channel.name;
            });
        } catch (error) {
            Sentry.captureException(error);

            signale.fatal(`An unexpected error occurred while fetching all Channel configurations`);
            signale.fatal(error);

            throw new Error(`An unexpected error occurred while fetching all Channel configurations`);
        }
    }

    /**
     * Check if Song identifications are currently on cooldown for a Channel
     * @param channel Channel configuration object containing the `name` and `id` for the Channel
     */
    public async onCooldown(
        channel: Channel,
    ): Promise<{ onCooldown: boolean; since?: number; remaining?: number; identification?: Identification }> {
        try {
            // Get the latest Identification for a Channel
            const identification: Identification = await this.graphql.client
                .query({
                    query: LATEST_IDENTIFICATION,
                    variables: { id: channel.id },
                })
                .then((res) => res.data.channel.identifications[0]);

            // Return if no Identification was found
            if (!identification) {
                signale.warn(`Found no previous Identification for Channel \`${channel.name}\``);
                return {
                    onCooldown: false,
                    since: undefined,
                    remaining: undefined,
                    identification: undefined,
                };
            }

            // Calculate seconds left until next Identification may be attempted
            const since = Math.round(Math.abs((new Date().getTime() - new Date(identification.date).getTime()) / 1000));
            const remaining = channel.cooldown - since;

            // Check if Channel is on cooldown
            const onCooldown = since > 0 && since < channel.cooldown;

            signale.info(`${since}s passed since last Identification in Channel \`${channel.name}\``);

            return {
                onCooldown,
                since,
                remaining,
                identification,
            };
        } catch (error) {
            Sentry.captureException(error);

            signale.scope(channel.name).error(`Unexpected error checking Cooldown for Channel \`${channel.name}\``);
            signale.scope(channel.name).error(error);

            throw new Error(`Unexpected error checking Cooldown for Channel \`${channel.name}\``);
        }
    }

    /**
     * Disable a specific Channel
     * @param channel Name of the Channel to disable
     */
    public async disable(channel: string): Promise<Channel> {
        signale.await(`Disabling Channel \`${channel}\``);

        // Get Channel configuration from Store
        const config = this.configurations.get(channel);

        if (!config) {
            signale.error(`Could not find Channel configuration for Channel \`${channel}\``);
            throw Error(`Could not find Channel configuration for Channel \`${channel}\``);
        }

        return this.graphql.client
            .mutate({
                mutation: UPDATE_CHANNEL,
                variables: { id: config.id, enabled: false },
            })
            .then((res) => {
                signale.success(`Disabled Channel \`${config.name}\``);
                return res.data.updateChannel;
            })
            .catch((error) => {
                Sentry.captureException(error);

                signale.error(`Error disabling Channel \`${config.name}\``);
                signale.error(error);
            });
    }
}

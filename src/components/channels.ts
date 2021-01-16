import { Channel } from "../interfaces/channel.interface";
import { Identification } from "../interfaces/identification.interface";

import moment from "moment";
import signale from "signale";
import tmi from "tmi.js";

import GraphQL from "./graphql";
import { CHANNELS, CHANNEL_ADDED, CHANNEL_UPDATED, LATEST_IDENTIFICATION, UPDATE_CHANNEL } from "../queries/queries";

export default class Channels {
    /**
     * Channel `Store` containing Configurations for all Channels
     */
    public store: {
        [key: string]: Channel;
    } = {};

    /**
     * Twitch Client instance set by TwitchClient-Class after Channels were initially received
     */
    public client: tmi.Client | undefined;

    constructor(private graphql: GraphQL) {}

    /**
     * Start listening to Channel Configuration additions and updates
     */
    public listen(): void {
        // Listen for Channel additions
        this.graphql.client
            .subscribe({
                query: CHANNEL_ADDED,
            })
            .subscribe({
                next: (res) => {
                    const channel = res.data.channelAdded;
                    signale.scope(channel.channelName).info(`New Channel \`${channel.channelName}\` was added`);
                    signale.scope(channel.channelName).info(channel);

                    // Store and join added Channel
                    this.store[channel.channelName] = { pending: false, cooldownSent: false, ...channel };
                    this.client?.join(channel.channelName);
                },
                error: (error) => {
                    signale.error(`Error receiving Configuration Update`);
                    signale.error(error);
                },
            });

        // Listen for Channel updates
        this.graphql.client
            .subscribe({
                query: CHANNEL_UPDATED,
            })
            .subscribe({
                next: (res) => {
                    const channel = res.data.channelUpdated;
                    signale
                        .scope(channel.channelName)
                        .info(`Configuration for Channel \`${channel.channelName}\` was updated`);
                    signale.scope(channel.channelName).info(channel);

                    // Store updated Channel
                    const pending = this.store[channel.channelName].pending;
                    const cooldownSent = this.store[channel.channelName].cooldownSent;
                    this.store[channel.channelName] = { pending, cooldownSent, ...channel };

                    // Join or leave Channel depending if we are currently in it and the new Channel `active` status
                    const channels = this.client
                        ?.getChannels()
                        ?.map((channel) => channel.replace("#", "").toLowerCase());

                    if (channels?.includes(channel.channelName) && !channel.active) {
                        signale
                            .scope(channel.channelName)
                            .info(`Leaving Channel because it is no longer marked \`active\``);
                        this.client?.part(channel.channelName);
                    }

                    if (!channels?.includes(channel.channelName) && channel.active) {
                        signale.scope(channel.channelName).info(`Joining Channel it was marked \`active\` again`);
                        this.client?.join(channel.channelName);
                    }
                },
                error: (error) => {
                    signale.error(`Error receiving Configuration Update`);
                    signale.error(error);
                },
            });
    }

    /**
     * Get an Array of available Channels
     */
    public async update(): Promise<string[]> {
        try {
            // Request Channels
            const channels = await this.graphql.client
                .query({
                    query: CHANNELS,
                })
                .then((res) => res.data.channels);

            // Add Channels to Channel Store
            return channels.map((channel: Channel) => {
                // Abort if Channel is not marked `active`
                if (!channel.active) return;

                // Store Channel in Channel Store
                this.store[channel.channelName.toLowerCase()] = channel;

                // Return only the Channel Name
                return channel.channelName.toLowerCase();
            });
        } catch (error) {
            signale.fatal(`An Error occurred getting Channels, this is fatal`);
            signale.fatal(error);
            throw new Error(`An Error occurred getting Channels, this is fatal`);
        }
    }

    /**
     * Check if a Channel is on cooldown
     * @param channel Name of the Channel to check
     */
    public async isOnCooldown(
        channel: string,
    ): Promise<{ onCooldown: boolean; since?: number; remaining?: number; identification?: Identification }> {
        signale.scope(channel).info(`Checking Cooldown`);

        try {
            // Get latest Identification for Channel
            const identification = await this.graphql.client
                .query({
                    query: LATEST_IDENTIFICATION,
                    variables: { name: channel },
                })
                .then((res) => res.data.channel.latestIdentification);

            // Return if no Identification was found
            if (!identification) {
                signale.warn(`No Identification found for Channel \`${channel}\``);
                return {
                    onCooldown: false,
                    since: undefined,
                    remaining: undefined,
                    identification: undefined,
                };
            }

            // Calculate seconds left until next possible Identification
            const remaining = this.store[channel].cooldown - identification.since;

            // Check if Channel is on cooldown
            const onCooldown = identification.since > 0 && identification.since < this.store[channel].cooldown;

            signale.scope(channel).info(`${identification.since} seconds passed since last attempted Identification`);

            return {
                onCooldown,
                since: identification.since,
                remaining,
                identification,
            };
        } catch (error) {
            signale.scope(channel).error(`Error checking Cooldown`);
            signale.scope(channel).error(error);
            throw new Error(`Error checking Cooldown for Channel \`${channel}\``);
        }
    }

    /**
     * Mark a specific Channel as `inactive`
     * @param name Name of the Channel to deactivate
     */
    public async deactivate(name: string): Promise<Channel> {
        return await this.graphql.client
            .mutate({
                mutation: UPDATE_CHANNEL,
                variables: { name, active: false },
            })
            .then((res) => {
                signale.scope(name).success(`Marked Channel \`${name}\` as \`inactive\``);
                return res.data.updateChannel;
            })
            .catch((error) => {
                signale.scope(name).error(`Error marking Channel as \`inactive\``);
                signale.scope(name).error(error);
            });
    }
}

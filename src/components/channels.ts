import { Identification } from "../interfaces/identification.interface";
import { Channel } from "../interfaces/channel.interface";

import { gql, GraphQLClient } from "graphql-request";

import signale from "signale";
import moment from "moment";

export class Channels {
    /**
     * Channel `Store` containing Configurations for all Channels
     */
    public store: {
        [key: string]: Channel;
    } = {};

    /**
     * GraphQL Client Instance
     */
    private gql: GraphQLClient = new GraphQLClient(process.env.GQL_URL as string).setHeader(
        "Authorization",
        `Bearer ${process.env.GQL_TOKEN}`,
    );

    /**
     * Get an Array of available Channels
     */
    public async update(): Promise<string[]> {
        try {
            // Request Channels
            const channels = await this.gql
                .request(
                    gql`
                        query Channels {
                            channels {
                                id
                                cooldown
                                channelName
                                active
                                useAction
                                enableLinks
                                messageTemplates {
                                    type
                                    template
                                }
                                triggers {
                                    keyword
                                }
                            }
                        }
                    `,
                )
                .then((data) => data.channels);

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
    ): Promise<{ onCooldown: boolean; sinceLast?: number; untilNext?: number; identification?: Identification }> {
        signale.scope(channel).info(`Checking Cooldown`);

        try {
            // Get latest Identification for Channel
            const identification = await this.gql
                .request(
                    gql`
                        query Identification($name: String!) {
                            channel(name: $name) {
                                latestIdentification {
                                    timestamp
                                    songs {
                                        title
                                        artist
                                        timecode
                                    }
                                }
                            }
                        }
                    `,
                    { name: channel },
                )
                .then((data) => data.channel.latestIdentification);

            // Return if no Identification was found
            if (!identification) {
                signale.warn(`No Identification found for Channel \`${channel}\``);
                return {
                    onCooldown: false,
                    sinceLast: undefined,
                    untilNext: undefined,
                    identification: undefined,
                };
            }

            // Calculate seconds passed since last Identification
            const sinceLast = moment().diff(moment(Number(identification.timestamp)), "seconds");

            // Calculate seconds left until next possible Identification
            const untilNext = this.store[channel].cooldown - sinceLast;

            // Check if Channel is on cooldown
            const onCooldown = sinceLast > 0 && sinceLast < this.store[channel].cooldown;

            signale.scope(channel).info(`${sinceLast} seconds passed since last Identification`);

            return {
                onCooldown,
                sinceLast,
                untilNext,
                identification,
            };
        } catch (error) {
            signale.scope(channel).error(`Error checking Cooldown`);
            signale.scope(channel).error(error);
            throw new Error(`Error checking Cooldown for Channel \`${channel}\``);
        }
    }
}

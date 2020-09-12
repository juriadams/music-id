import { Channel } from "../interfaces/channel.interface";
import { Identification } from "../interfaces/identification.interface";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { Logger } from "./logger";

export class Channels {
    /**
     * Object containing all currently loaded channels
     */
    public channels: {
        [key: string]: Channel;
    } = {};

    /**
     * Array of channel names which currently have song identification requests pending
     */
    public pendingChannels: string[] = [];

    /**
     * Array of channels which are on cooldown and where a cooldown warning message was already sent in
     */
    public cooldownMessageSent: string[] = [];

    /**
     * GraphQL Client Instance
     */
    private gql: GraphQLClient;

    constructor(private logger: Logger) {
        // @ts-expect-error Initialize new GraphQL Client
        this.gql = new GraphQLClient(process.env.GQL_URL).setHeader("Authorization", `Bearer ${process.env.GQL_TOKEN}`);
    }

    /**
     * Get list of all available channels
     */
    public async updateChannels(): Promise<string[]> {
        // Channels GraphQL Query
        const query = gql`
            query {
                channels {
                    id
                    cooldown
                    channelName
                    active
                    messageTemplates {
                        type
                        template
                    }
                    triggers {
                        keyword
                    }
                }
            }
        `;

        try {
            // Query Channels
            const response = await this.gql.request(query);

            // Map Channels down to their names
            return response.channels.map((channel: Channel) => {
                // Store Channel in memory
                this.channels[channel.channelName] = channel;

                // Return channelName
                return channel.channelName;
            });
        } catch (error) {
            this.logger.signale.error("Error getting Channels");
            this.logger.signale.error(error);

            // Throw Error
            throw new Error("Error getting Channels");
        }
    }

    /**
     * Check if a Channel is on cooldown
     * @param channelName Name of the channel to check
     */
    public async isOnCooldown(
        channelName: string,
    ): Promise<{ onCooldown: boolean; sinceLast?: number; untilNext?: number; identification?: Identification }> {
        // Specific Channel GraphQL Query
        const query = gql`
            query {
                channel(channelName: "${channelName}") {
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
        `;

        try {
            // Perform Query and get its response
            const response = await this.gql.request(query);

            if (response.channel.latestIdentification) {
                // Calculate seconds since last Identification
                const sinceLast = moment().diff(
                    moment(Number(response.channel.latestIdentification.timestamp)),
                    "seconds",
                );

                // Calculate seconds remaining until next possible Identification
                const untilNext = this.channels[channelName].cooldown - sinceLast;

                // Check if Channel is on cooldown
                const onCooldown = sinceLast > 0 && sinceLast < this.channels[channelName].cooldown;

                this.logger.signale.info(
                    `${sinceLast} seconds passed since last Identification in Channel ${channelName} (${
                        onCooldown ? "on cooldown" : "not on cooldown"
                    })`,
                );

                return {
                    onCooldown,
                    sinceLast,
                    untilNext,
                    identification: response.channel.latestIdentification,
                };
            } else {
                this.logger.signale.warn(
                    "No `latestIdentification` found for requested Channel, returning `onCooldown = false`",
                );
                return {
                    onCooldown: false,
                    sinceLast: undefined,
                    untilNext: undefined,
                    identification: undefined,
                };
            }
        } catch (error) {
            this.logger.signale.error(`Error getting latestIdentification for Channel ${channelName}`);
            this.logger.signale.error(error);

            // Throw Error
            throw new Error(`Error getting latestIdentification for Channel ${channelName}`);
        }
    }
}

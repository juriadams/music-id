import { Song } from "../interfaces/song.interface";
import { environment } from "../environment";
import { GraphQLClient, gql } from "graphql-request";
import { Logger } from "./logger";

export class Identifier {
    private gql: GraphQLClient;

    constructor(private logger: Logger) {
        // Initialize new GraphQL Client
        this.gql = new GraphQLClient(environment.gql.url).setHeader("Authorization", `Bearer ${environment.gql.token}`);
    }

    /**
     * Request song identification for given channel
     * @param channel Name of the channel to request song identification for
     */
    public async nowPlaying(channelName: string, requester: string, message: string): Promise<Song[]> {
        // GraphQL Query to get currently playing Songs for Channel
        const query = gql`
            query {
                nowPlaying(request: { channelName: "${channelName}", requester: "${requester}", message: "${message.replace(
            '"',
            "_",
        )}" }) {
                    title
                    artist
                    album
                    label
                    timecode
                    urls {
                        spotify
                        deezer
                        youtube
                    }
                }
            }
        `;

        try {
            // Perform Query
            const response = await this.gql.request(query);

            this.logger.signale.info(`Found ${response.nowPlaying.length} Songs playing in Channel ${channelName}`);

            // Return found Songs
            return response.nowPlaying || [];
        } catch (error) {
            this.logger.signale.error(`Error getting Songs for Channel ${channelName}`);
            this.logger.signale.error(error);

            // Do not throw an Exception, instead, return an empty Array for no found Songs
            // throw new Error(`Error gettings Songs for Channel ${channelName}`);

            return [];
        }
    }
}

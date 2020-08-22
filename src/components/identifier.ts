import { Song } from "../interfaces/song.interface";
import { environment } from "../environment";
import signale from "signale";
import { GraphQLClient, gql } from "graphql-request";

export class Identifier {
    private gql: GraphQLClient;

    constructor() {
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

            signale.info(`Found ${response.nowPlaying.length} Songs playing in Channel ${channelName}`);

            // Return found Songs
            return response.nowPlaying || [];
        } catch (error) {
            signale.error(`Error getting Songs for Channel ${channelName}`);
            signale.error(error);

            // Throw Error
            throw new Error(`Error gettings Songs for Channel ${channelName}`);
        }
    }
}

import { Song } from "../interfaces/song.interface";
import { GraphQLClient, gql } from "graphql-request";
import { Logger } from "./logger";

export class Identifier {
    private gql: GraphQLClient;

    constructor(private logger: Logger) {
        // @ts-expect-error Initialize new GraphQL Client
        this.gql = new GraphQLClient(process.env.GQL_URL).setHeader("Authorization", `Bearer ${process.env.GQL_TOKEN}`);
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
                    url
                }
            }
        `;

        try {
            // Perform Query
            const response = await this.gql.request(query);

            this.logger.pino.info(
                { channel: channelName },
                `Found ${response.nowPlaying?.length || 0} Songs playing in Channel ${channelName}`,
            );

            // Return found Songs
            return response.nowPlaying || [];
        } catch (error) {
            this.logger.pino.error(
                { error, channel: channelName },
                `An Error occurred getting Songs for Channel ${channelName}`,
            );

            // Do not throw an Exception, instead, return an empty Array for no found Songs
            // throw new Error(`Error gettings Songs for Channel ${channelName}`);

            return [];
        }
    }
}

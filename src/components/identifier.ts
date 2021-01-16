import { Song } from "../interfaces/song.interface";
import { GraphQLClient, gql } from "graphql-request";
import signale from "signale";

export class Identifier {
    /**
     * GraphQL Client Instance
     */
    private gql: GraphQLClient = new GraphQLClient(process.env.GQL_URL as string).setHeader(
        "Authorization",
        `Bearer ${process.env.GQL_TOKEN}`,
    );

    /**
     * Identify currently playing Songs in a live stream
     * @param channel Name of the Channel to analyze
     * @param requester User who requested the Song Identification
     * @param message Message which was used to request Song Identification
     */
    public async nowPlaying(channel: string, requester: string, message: string): Promise<Song[]> {
        try {
            // Identify currently playing Songs
            const songs = this.gql
                .request(
                    gql`
                        query Songs($channel: String!, $requester: String!, $message: String!) {
                            nowPlaying(channel: $channel, requester: $requester, message: $message) {
                                title
                                artist
                                album
                                label
                                timecode
                                url
                            }
                        }
                    `,
                    { channel, requester, message },
                )
                .then((data) => data.nowPlaying);

            // Return identified Songs
            return songs || [];
        } catch (error) {
            signale.error(`Error identifying Songs`);
            signale.error(error);

            return [];
        }
    }
}

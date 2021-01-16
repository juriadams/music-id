import { Song } from "../interfaces/song.interface";

import signale from "signale";

import { SONGS } from "../queries/queries";
import GraphQL from "./graphql";

export default class Identifier {
    constructor(private graphql: GraphQL) {}

    /**
     * Identify currently playing Songs in a live stream
     * @param channel Name of the Channel to analyze
     * @param requester User who requested the Song Identification
     * @param message Message which was used to request Song Identification
     */
    public async nowPlaying(channel: string, requester: string, message: string): Promise<Song[]> {
        try {
            // Identify currently playing Songs
            const songs = this.graphql.client
                .query({
                    query: SONGS,
                    variables: { channel, requester, message },
                })
                .then((res) => res.data.nowPlaying);

            // Return identified Songs
            return songs || [];
        } catch (error) {
            signale.error(`Error identifying Songs`);
            signale.error(error);

            return [];
        }
    }
}

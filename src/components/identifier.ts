import { Identification } from "../interfaces/identification.interface";

import GraphQL from "./graphql";
import { IDENTIFY } from "../queries/queries";

export default class Identifier {
    constructor(private graphql: GraphQL) {}

    /**
     * Identify currently playing Songs in a live stream
     * @param channel Name of the Channel to analyze
     * @param requester User who requested the Song Identification
     * @param message Message which was used to request Song Identification
     * @param provider Optional provider parameter
     */
    public async identify(channel: string, requester: string, message: string, provider?: string): Promise<Identification> {
        return this.graphql.client
            .query({
                query: IDENTIFY,
                variables: { channel, requester, message, provider },
            })
            .then((res) => {
                const identification: Identification = res.data.identify;

                return {
                    ...identification,
                    songs: identification.songs.map((song) => {
                        return {
                            ...song,
                            artists: (song.artists as string[]).reduce((acc, current, index) => {
                                return index === 0
                                    ? `${current}`
                                    : index === (song.artists as string[]).length - 1
                                    ? `${acc} and ${current}`
                                    : `${acc}, ${current}`;
                            }, ""),
                        };
                    }),
                };
            });
    }
}

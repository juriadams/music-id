import { Identification } from "../interfaces/identification.interface";
import { IDENTIFY } from "../queries/queries";

import GraphQL from "./graphql";

export default class Identifier {
    constructor(private graphql: GraphQL) {}

    /**
     * Identify currently playing Songs in a live stream
     * @param channel Name of the Channel to analyze
     * @param requester User who requested the Song Identification
     * @param message Message which was used to request Song Identification
     * @returns Identifications
     */
    public async identify(channel: string, requester: string, message: string): Promise<Identification> {
        return this.graphql.client
            .query({
                query: IDENTIFY,
                variables: { channel, requester, message },
            })
            .then((res) => res.data.identify);
    }
}

import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink, split } from "@apollo/client/core";
import { getMainDefinition } from "@apollo/client/utilities";
import { WebSocketLink } from "@apollo/link-ws";
import WebSocket from "ws";

import fetch from "cross-fetch";

export default class GraphQL {
    public client: ApolloClient<any>;

    private cache: InMemoryCache = new InMemoryCache({ resultCaching: false });
    private link: ApolloLink = split(
        ({ query }) => {
            const def = getMainDefinition(query);
            return def.kind === "OperationDefinition" && def.operation === "subscription";
        },
        new WebSocketLink({
            uri: process.env.GQL_WS as string,
            options: {
                reconnect: true,
            },
            webSocketImpl: WebSocket,
        }),
        createHttpLink({
            fetch,
            uri: process.env.GQL_HTTP as string,
            headers: {
                Authorization: `Bearer ${process.env.GQL_TOKEN as string}`,
            },
        }),
    );

    constructor() {
        this.client = new ApolloClient({
            cache: this.cache,
            link: this.link,
            defaultOptions: {
                watchQuery: {
                    fetchPolicy: "no-cache",
                },
                query: {
                    fetchPolicy: "no-cache",
                },
            },
        });
    }
}

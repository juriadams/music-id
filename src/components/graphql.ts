import { ApolloClient, InMemoryCache, createHttpLink, split } from "@apollo/client/core";
import { getMainDefinition } from "@apollo/client/utilities";
import { WebSocketLink } from "@apollo/link-ws";
import fetch from "cross-fetch";
import WebSocket from "ws";

export default class GraphQL {
    /**
     * Public ApolloClient instance
     */
    public client: ApolloClient<any> = new ApolloClient({
        cache: new InMemoryCache({ resultCaching: false }),
        link: split(
            ({ query }) => {
                const def = getMainDefinition(query);
                return def.kind === "OperationDefinition" && def.operation === "subscription";
            },
            new WebSocketLink({
                uri: process.env.BOT_GQL_WS as string,
                options: {
                    reconnect: true,
                },
                webSocketImpl: WebSocket,
            }),
            createHttpLink({
                fetch,
                uri: process.env.BOT_GQL_HTTP as string,
                headers: {
                    Authorization: `Secret ${process.env.CLIENT_TOKEN_SECRET}`,
                },
            }),
        ),
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

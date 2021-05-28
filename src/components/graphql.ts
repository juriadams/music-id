import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client/core";

import fetch from "cross-fetch";

export default class GraphQL {
    /**
     * Public ApolloClient instance
     */
    public client: ApolloClient<any> = new ApolloClient({
        cache: new InMemoryCache({ resultCaching: false }),
        link: createHttpLink({
            fetch,
            uri: process.env.BOT_API_HTTP as string,
            headers: {
                Authorization: `Secret ${process.env.SHARED_API_SECRET}`,
            },
        }),
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

import { gql } from "@apollo/client/core";

export const CHANNEL_ADDED = gql`
    subscription Channel {
        channelAdded {
            id
        }
    }
`;

export const CHANNEL_UPDATED = gql`
    subscription Channel {
        channelUpdated {
            id
        }
    }
`;

export const CHANNEL_DELETED = gql`
    subscription Channel {
        channelDeleted {
            id
        }
    }
`;

export const CLIENT = gql`
    query Client($environment: String!) {
        client(environment: $environment) {
            id
            name
            clientId
            clientSecret
            accessToken
            refreshToken
            expiresAt
        }
    }
`;

export const UPDATE_CLIENT = gql`
    mutation Client($id: String!, $accessToken: String!, $refreshToken: String!, $expiresAt: DateTime!) {
        updateClient(id: $id, client: { accessToken: $accessToken, refreshToken: $refreshToken, expiresAt: $expiresAt }) {
            id
            name
            environment
            clientId
            clientSecret
            accessToken
            refreshToken
            expiresAt
        }
    }
`;

export const CHANNELS = gql`
    query Channels {
        channels(enabled: true) {
            id
            name
            enabled
            cooldown
            actions
            links
            dateAdded
            triggers(enabled: true) {
                id
                keyword
            }
            templates {
                success
                cooldown
                previousCooldown
                error
            }
        }
    }
`;

export const CHANNEL = gql`
    query Channel($id: String!) {
        channel(id: $id) {
            id
            name
            enabled
            cooldown
            actions
            links
            dateAdded
            triggers(enabled: true) {
                id
                keyword
            }
            templates {
                success
                cooldown
                previousCooldown
                error
            }
        }
    }
`;

export const LATEST_IDENTIFICATION = gql`
    query Identification($id: String!) {
        identifications(channel: $id, limit: 1) {
            id
            successful
            date
            since
            songs {
                title
                artists {
                    id
                    name
                }
                url
                platforms {
                    spotify
                    apple
                    deezer
                    youtube
                }
            }
        }
    }
`;

export const UPDATE_CHANNEL = gql`
    mutation Channel($id: String!, $enabled: Boolean!) {
        updateChannel(id: $id, channel: { enabled: $enabled }) {
            id
            name
            enabled
        }
    }
`;

export const IDENTIFY = gql`
    query Songs($channel: String!, $requester: String!, $message: String!) {
        identify(channel: $channel, requester: $requester, message: $message) {
            id
            successful
            provider
            songs {
                id
                provider
                providerId
                isrc
                title
                artists {
                    id
                    name
                }
                albums {
                    id
                    name
                }
                label
                releaseDate
                url
                platforms {
                    spotify
                    apple
                    deezer
                    youtube
                }
            }
            triggers {
                id
                keyword
            }
        }
    }
`;

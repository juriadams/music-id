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
            identifications {
                id
            }
            triggers(enabled: true) {
                id
                keyword
            }
            templates {
                type
                template
            }
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
            identifications {
                id
            }
            triggers(enabled: true) {
                id
                keyword
            }
            templates {
                type
                template
            }
        }
    }
`;

export const LATEST_IDENTIFICATION = gql`
    query Identification($id: String!) {
        channel(id: $id) {
            identifications(limit: 1) {
                date
                songs {
                    title
                    artists
                    timecode
                    url
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

export const MENTION = gql`
    mutation Mention($channel: String!, $message: String!, $sender: String!) {
        addMention(mention: { channel: $channel, message: $message, sender: $sender }) {
            id
        }
    }
`;

export const IDENTIFY = gql`
    query Songs($channel: String!, $requester: String!, $message: String!, $provider: String) {
        identify(channel: $channel, requester: $requester, message: $message, provider: $provider) {
            id
            successful
            date
            songs {
                id
                title
                album
                artists
                label
                score
                releaseDate
                url
                duration
                timecode
            }
        }
    }
`;

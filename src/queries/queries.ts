import { gql } from "@apollo/client/core";

export const CHANNEL_ADDED = gql`
    subscription Channel {
        channelAdded {
            id
            cooldown
            channelName
            active
            useAction
            enableLinks
            messageTemplates {
                type
                template
            }
            triggers {
                keyword
                enabled
                deleted
            }
        }
    }
`;

export const CHANNEL_UPDATED = gql`
    subscription Channel {
        channelUpdated {
            id
            cooldown
            channelName
            active
            useAction
            enableLinks
            messageTemplates {
                type
                template
            }
            triggers {
                keyword
                enabled
                deleted
            }
        }
    }
`;

export const CHANNELS = gql`
    query Channels {
        channels(active: true) {
            id
            cooldown
            channelName
            active
            useAction
            enableLinks
            messageTemplates {
                type
                template
            }
            triggers {
                keyword
                enabled
                deleted
            }
        }
    }
`;

export const LATEST_IDENTIFICATION = gql`
    query Identification($name: String!) {
        channel(name: $name) {
            latestIdentification {
                timestamp
                songs {
                    title
                    artist
                    timecode
                    url
                }
            }
        }
    }
`;

export const UPDATE_CHANNEL = gql`
    mutation Channel($name: String!, $active: Boolean!) {
        updateChannel(channel: { name: $name, active: $active }) {
            id
            channelName
            active
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

export const SONGS = gql`
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
`;

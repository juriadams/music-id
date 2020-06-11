import { environment } from "../environment";
import { Firestore } from "./firestore";
import { MessageComposer } from "./composer";
import { Channels } from "./channels";
import { Identifier } from "./identifier";
import signale from "signale";
import moment from "moment";
import * as tmi from "tmi.js";
import got from "got/dist/source";

export class MessageHandler {
    constructor(
        private firestore: Firestore,
        private channels: Channels,
        private composer: MessageComposer,
        private identifier: Identifier,
    ) {}

    /**
     * Helper function to remove command name and split message into arguments
     * @param message Message we split into arguments
     */
    public getArgs(message: string): string[] {
        return message.split(" ").slice(1);
    }

    /**
     * Main message handler
     * @param channel Name of the channel the message was sent in
     * @param message Actual message
     * @param sender Name of the message sender
     * @param client Twitch client instance
     */
    public handle(channel: string, message: string, sender: string, client: tmi.Client) {
        // Remove leading `#` from channel names
        channel = channel.replace("#", "");

        // Transform message into lowerCase
        message = message.toLowerCase();

        // Stats command temporarily disabled due to it generating too much cost
        // if (message.startsWith("!stats")) {
        //     return this.handleStats(channel, message, sender, client);
        // }

        if (environment.mentionTriggers.some((trigger) => message.includes(trigger))) {
            this.handleMention(channel, message, sender);
        }

        if (this.channels.channels[channel].triggers.some((trigger) => message.includes(trigger))) {
            this.handleSongIdentification(channel, message, sender, client);
        }
    }

    /**
     * Handle stats command, replying with stats for either current or given channel
     * @param channel Channel the command was sent in
     * @param message Message including the command
     * @param sender Name of the message sender
     * @param client Twitch client instance
     */
    public handleStats(channel: string, message: string, sender: string, client: tmi.Client): void {
        // Split message into args and get target channel
        const args = this.getArgs(message);
        const target = args[0] ? args[0].replace("@", "") : channel;

        signale.start(`Requested stats for channel "${target}"`);
        got(`https://api.adams.sh/music-id/stats/${target}`, {
            retry: 0,
            responseType: "json",
            resolveBodyOnly: true,
            headers: {
                apikey: environment.apikey,
            },
        })
            .then((response: any) => {
                signale.success(`Received stats for channel "${target}"`);
                signale.info(response);

                // Reply with stats
                client.action(
                    channel,
                    target === "all"
                        ? `@${sender} | ${response.data.successful} out of ${response.data.total} requests successful across all channels. (${response.data.percent}%)`
                        : `@${sender} | ${response.data.successful} out of ${response.data.total} requests successful in channel "${target}". (${response.data.percent}%)`,
                );
            })
            .catch((error) => {
                signale.error(`Error getting Stats for channel "${target}"`);
                signale.error(error);

                // Reply with error message
                client.action(channel, `@${sender} | Error getting channel stats`);
            });
    }

    /**
     * Handle mentions of the bot or any other keywords specified in environment
     * @param channel Channel the bot was mentioned in
     * @param message Message including the keyword
     * @param sender Name of the message sender
     *
     * TODO: Add Discord integration (webhook or bot?)
     */
    public handleMention(channel: string, message: string, sender: string): void {
        // Store mention of the bot inside database
        this.firestore.admin.collection("mentions").add({
            channel,
            message,
            sender,
            timestamp: moment().utc(),
        });
    }

    public handleSongIdentification(channel: string, message: string, sender: string, client: tmi.Client): void {
        // Check if channel already has a pending identification to avoid duplicate requests
        if (this.channels.pendingChannels.includes(channel)) {
            return signale.debug(`Itendification for channel "${channel} already in progress, skipping request..."`);
        }

        // Check if channel is currently on cooldown and continue accordingly
        this.channels
            .isOnCooldown(channel)
            .then((lastAttempt) => {
                // Calculate time since last identification request and transform into `seconds`
                const sinceLastRequest = moment().diff(moment(lastAttempt.timestamp), "seconds");

                // Calculate time until next possible identification request
                const untilNext = this.channels.channels[channel].cooldown - sinceLastRequest;

                signale.debug(
                    `Channel "${channel} is still on cooldown, waiting ${untilNext} seconds before allowing next request`,
                );

                // Check if cooldown message was already sent
                if (this.channels.cooldownMessageSent.includes(channel)) {
                    signale.debug(`Cooldown message was already sent in channel "${channel}", not sending message`);
                } else {
                    signale.debug(`Sending cooldown warning message in channel "${channel}"`);

                    this.channels.cooldownMessageSent.push(channel);
                    client.say(channel, this.composer.cooldown(channel, sender, untilNext, lastAttempt));
                }
            })
            .catch(() => {
                // Mark channel as `pending`
                this.channels.pendingChannels.push(channel);

                // Get array of triggers matched in message, used for analytics
                const triggers = this.channels.channels[channel].triggers.filter((trigger) =>
                    message.toLowerCase().includes(trigger),
                );

                signale.start(`Identifying song in channel "${channel}"...`);

                // Start identifying songs in channel
                this.identifier
                    .identify(channel)
                    .then((songs) => {
                        // Reset `pending` and `cooldownMessageSent` states for channel
                        this.channels.pendingChannels = this.channels.pendingChannels.filter((c) => c !== channel);
                        this.channels.cooldownMessageSent = this.channels.cooldownMessageSent.filter(
                            (c) => c !== channel,
                        );

                        signale.success(`Found ${songs.length} songs playing in channel ${channel}`);

                        // Add Itentification result to database
                        this.firestore.admin.collection("identifications").add({
                            channel,
                            matchedTriggers: triggers,
                            message,
                            requester: sender,
                            response: {
                                code: 200,
                                message: "Found song",
                            },
                            success: true,
                            songs: songs,
                            timestamp: moment().format(),
                        });

                        // Check if songs array is empty
                        if (songs && songs.length > 0) {
                            client.say(channel, this.composer.success(channel, sender, songs[0]));
                        } else {
                            client.say(channel, this.composer.error(channel, sender, "No songs found"));
                        }
                    })
                    .catch((error) => {
                        // Reset `pending` and `cooldownMessageSent` states for channel
                        this.channels.pendingChannels = this.channels.pendingChannels.filter((c) => c !== channel);
                        this.channels.cooldownMessageSent = this.channels.cooldownMessageSent.filter(
                            (c) => c !== channel,
                        );

                        // Add Itentification result to database
                        this.firestore.admin.collection("identifications").add({
                            channel,
                            matchedTriggers: triggers,
                            message,
                            requester: sender,
                            response: {
                                code: 404,
                                message: "No song found",
                            },
                            success: false,
                            songs: null,
                            timestamp: moment().format(),
                        });

                        signale.warn(`Found no songs playing in channel ${channel}`);
                        signale.warn(error);

                        // Send error message in chat
                        client.say(channel, this.composer.error(channel, sender, error));
                    });
            });
    }
}

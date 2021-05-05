import { ChatClient, ChatUser } from "twitch-chat-client/lib";
import moment from "moment";

import { Identification } from "../interfaces/identification.interface";
import { Channel } from "../interfaces/channel.interface";
import { Song } from "../interfaces/song.interface";

export default class MessageComposer {
    /**
     * Helper Function to "humanize" a list of Artists
     * @param artists Array of Object containing the name of the Artist
     * @returns Humanized String of Artists
     */
    public getArtists = (artists: { id: string; name: string }[]) =>
        artists.reduce((acc, current, index) => {
            return index === 0
                ? `${current.name}`
                : index === artists.length - 1
                ? `${acc} and ${current.name}`
                : `${acc}, ${current.name}`;
        }, "");

    /**
     * Compose a successful response
     * @param channel Object containing the Channel configuration
     * @param user ChatUser containing requester details
     * @param song Identified Song object
     * @returns Hydrated Template
     */
    public SUCCESS = (channel: Channel, user: ChatUser, song: Song): string => {
        return channel.templates.success
            .replace("%REQUESTER%", user.userName)
            .replace("%TITLE%", song.title)
            .replace("%ARTIST%", this.getArtists(song.artists))
            .concat(channel.links && song.url ? ` → ${song.url}` : "");
    };

    /**
     * Compose a cooldown response
     * @param channel Object containing the Channel configuration
     * @param user ChatUser containing requester details
     * @param remaining Seconds remaining until next possible Identification attempt
     * @param identification Optional Identification
     * @returns Hydrated Template
     */
    public COOLDOWN = (channel: Channel, user: ChatUser, remaining: number, identification?: Identification): string => {
        // Get Songs from latest Identification
        const song = identification?.songs[0];

        return song
            ? channel.templates.previousCooldown
                  .replace("%REQUESTER%", user.userName)
                  .replace("%TITLE%", song.title)
                  .replace("%ARTIST%", this.getArtists(song.artists))
                  .replace("%TIME%", moment((identification as Identification).date).fromNow())
                  .concat(channel.links && song.url ? ` → ${song.url}` : "")
            : channel.templates.cooldown.replace("%REQUESTER%", user.userName).replace("%REMAINING%", remaining.toString());
    };

    /**
     * Compose an error response
     * @param channel Object containing the Channel configuration
     * @param user ChatUser containing requester details
     * @param errorMessage Optional error message displayed in the response
     * @returns Hydrated Template
     */
    public ERROR = (channel: Channel, user: ChatUser, errorMessage?: string): string => {
        return channel.templates.error.replace("%REQUESTER%", user.userName).replace("%ERROR%", errorMessage || "<unknown error>");
    };

    /**
     * Send a message to a specific Channel
     * @param channel Object containing the Channel configuration
     * @param message Message string to send
     * @param client ChatClient instance to send the message with
     * @returns Promise resolving once the message is sent
     */
    public send = (client: ChatClient, channel: Channel, message: string): Promise<void> =>
        channel.actions ? client.action(channel.name, message) : client.say(channel.name, message);
}

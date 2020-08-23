import { Channels } from "./channels";
import { Song } from "../interfaces/song.interface";
import { Identification } from "../interfaces/identification.interface";
import moment from "moment";

export class MessageComposer {
    constructor(private channels: Channels) {}

    /**
     * Get a specific MessageTemplate for a Channel
     * @param channelName Name of the Channel to get the MessageTemplate for
     * @param type Type of the MessageTemplate to get
     */
    private getMessageTemplate(
        channelName: string,
        type: "SUCCESS" | "COOLDOWN" | "COOLDOWN_WITH_ID" | "ERROR",
    ): string {
        // Get MessageTemplate for specified type
        const template = this.channels.channels[channelName].messageTemplates.find(
            (template) => template.type === type,
        );

        // Return MessageTemplate
        return template ? template.template : "";
    }

    /**
     * Returns success message when a song was successfully identified
     *
     * %REQUESTER% - Person who requested the command
     * %TITLE% - Title of the song
     * %ARTIST% - Artist who made the song
     * %TIMECODE% - Timecode where the sample starts
     * %URL% - URL to the song
     */
    public success(channel: string, requester: string, song: Song): string {
        return this.getMessageTemplate(channel, "SUCCESS")
            .replace("%REQUESTER%", requester)
            .replace("%TITLE%", song.title)
            .replace("%ARTIST%", song.artist)
            .replace("%TIMECODE%", song.timecode)
            .replace("%URL%", ""); // FIXME: Add url back after handling was updated
    }

    /**
     * Returns a message including the last identified song if one was found
     *
     * %REQUESTER% - Person who requested the command
     * %TITLE% - Title of the song
     * %ARTIST% - Artist who made the song
     * %URL% - URL to the song
     * %REMAINING% - Remaining seconds until command can be used again
     */
    public cooldown(
        channel: string,
        requester: string,
        remaining: number,
        latestIdentification?: Identification,
    ): string {
        return latestIdentification && latestIdentification.songs && latestIdentification.songs[0]
            ? this.getMessageTemplate(channel, "COOLDOWN_WITH_ID")
                  .replace("%REQUESTER%", requester)
                  .replace("%TITLE%", latestIdentification.songs[0].title)
                  .replace("%ARTIST%", latestIdentification.songs[0].artist)
                  .replace("%TIME%", moment(latestIdentification.timestamp).fromNow())
                  .replace("%URL%", "") // FIXME: Add url back after handling was updated
            : this.getMessageTemplate(channel, "COOLDOWN")
                  .replace("%REQUESTER%", requester)
                  .replace("%REMAINING%", remaining.toString());
    }

    /**
     * Returns a message when no song could be identified
     *
     * %REQUESTER% - Person who requested the command
     * %ERROR% - Error message why no Song could be identified
     */
    public error(channel: string, requester: string, errorMessage?: string): string {
        return this.getMessageTemplate(channel, "ERROR")
            .replace("%REQUESTER%", requester)
            .replace("%ERROR%", errorMessage || "");
    }
}

import { Channels } from "./channels";
import { Song } from "../interfaces/song.interface";
import { Identification } from "../interfaces/identification.interface";
import moment from "moment";

export class MessageComposer {
    constructor(private channels: Channels) {}

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
        return this.channels.channels[channel].messageTemplates.success
            .replace("%REQUESTER%", requester)
            .replace("%TITLE%", song.title)
            .replace("%ARTIST%", song.artist)
            .replace("%TIMECODE%", song.timecode)
            .replace("%URL%", song.url);
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
    public cooldown(channel: string, requester: string, remaining: number, lastAttempt: Identification): string {
        return lastAttempt.songs[0]
            ? this.channels.channels[channel].messageTemplates.cooldownWithId
                  .replace("%REQUESTER%", requester)
                  .replace("%TITLE%", lastAttempt.songs[0].title)
                  .replace("%ARTIST%", lastAttempt.songs[0].artist)
                  .replace("%TIME%", moment(lastAttempt.timestamp).fromNow())
                  .replace("%URL%", lastAttempt.songs[0].url)
            : this.channels.channels[channel].messageTemplates.cooldown
                  .replace("%REQUESTER%", requester)
                  .replace("%REMAINING%", remaining.toString());
    }

    /**
     * Returns a message when no song could be identified
     *
     * %REQUESTER% - Person who requested the command
     * %ERROR% - Error message why no could be identified
     */
    public error(channel: string, requester: string, errorMessage?: string): string {
        return this.channels.channels[channel].messageTemplates.error
            .replace("%REQUESTER%", requester)
            .replace("%ERROR%", errorMessage || "");
    }
}

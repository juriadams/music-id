import { MESSAGE_TEMPLATE_TYPE } from "../types/template.type";

import { Identification } from "../interfaces/identification.interface";
import { Song } from "../interfaces/song.interface";

import { Channels } from "./channels";

import moment from "moment";

export class MessageComposer {
    constructor(private channels: Channels) {}

    /**
     * Get a specific Template for a Channel
     * @param channel Name of the Channel to get Template for
     * @param type Type of the Template to get
     */
    private getTemplate(channel: string, type: MESSAGE_TEMPLATE_TYPE): string {
        return (
            this.channels.store[channel]?.messageTemplates?.find((template) => template.type === type)?.template || ""
        );
    }

    /**
     * Returns the hydrated `SUCCESS`-Template for a Channel
     * @param channel Name of the Channel
     * @param requester User who requested the Identification
     * @param song Identified Song object
     */
    public SUCCESS(channel: string, requester: string, song: Song): string {
        return this.getTemplate(channel, "SUCCESS")
            .replace("%REQUESTER%", requester)
            .replace("%TITLE%", song.title)
            .replace("%ARTIST%", song.artist)
            .replace("%TIMECODE%", song.timecode)
            .replace("%URL%", song.url)
            .concat(process.env.BOT_VIP?.split(",").includes(requester.toLowerCase()) ? " 🦀 🦀 🦀" : "");
    }

    /**
     * Returns the hydrated `COOLDOWN`-/`COOLDOWN_WITH_ID`-Template for a Channel
     * @param channel Name of the Channel
     * @param requester User who requested the Identification
     * @param remaining Seconds remaining until next possible Identification
     * @param identification Latest Identification (optional)
     */
    public COOLDOWN(channel: string, requester: string, remaining: number, identification?: Identification): string {
        return identification?.songs[0]
            ? this.getTemplate(channel, "COOLDOWN_WITH_ID")
                  .replace("%REQUESTER%", requester)
                  .replace("%TITLE%", identification.songs[0].title)
                  .replace("%ARTIST%", identification.songs[0].artist)
                  .replace("%TIME%", moment(Number(identification.timestamp)).fromNow())
                  .replace("%URL%", identification.songs[0].url)
            : this.getTemplate(channel, "COOLDOWN")
                  .replace("%REQUESTER%", requester)
                  .replace("%REMAINING%", remaining.toString());
    }

    /**
     * Returns the hydrated `ERROR`-Template for a Channel
     * @param channel Name of the Channel
     * @param requester User who requested the Identification
     * @param error Error message (optional)
     */
    public ERROR(channel: string, requester: string, errorMessage?: string): string {
        return this.getTemplate(channel, "ERROR")
            .replace("%REQUESTER%", requester)
            .replace("%ERROR%", errorMessage || "");
    }
}

import { ChatClient, ChatUser } from "twitch-chat-client/lib";
import signale from "signale";
import moment from "moment";

import { Identification } from "../interfaces/identification.interface";
import { Channel } from "../interfaces/channel.interface";
import { Song } from "../interfaces/song.interface";

export default class MessageComposer {
    /**
     * Returns the hydrated `SUCCESS`-Template for a Channel
     * @param channel Name of the Channel
     * @param user ChatUser containing User details
     * @param song Identified Song object
     */
    public SUCCESS = (channel: Channel, user: ChatUser, song: Song): string => {
        const template = channel.templates.find((template) => template.type === "SUCCESS")?.template || null;

        if (!template) {
            signale.error(`Could not find Template of type \`SUCCESS\`  for Channel \`${channel}\``);
            throw new Error(`Could not find Template of type \`SUCCESS\`  for Channel \`${channel}\``);
        }

        return template
            .replace("%REQUESTER%", user.userName)
            .replace("%TITLE%", song.title)
            .replace("%ARTIST%", song.artists as string)
            .replace("%TIMECODE%", song.timecode)
            .concat(channel.links && song.url ? ` → ${song.url}` : "");
    };

    /**
     * Returns the hydrated `COOLDOWN`-/`COOLDOWN_WITH_ID`-Template for a Channel
     * @param channel Name of the Channel
     * @param user ChatUser containing User details
     * @param remaining Seconds remaining until next possible Identification
     * @param identification Latest Identification (optional)
     */
    public COOLDOWN = (channel: Channel, user: ChatUser, remaining: number, identification?: Identification): string => {
        // Get latest identified Song
        const song = identification?.songs[0];

        const template = song
            ? channel.templates.find(({ type }) => type === "COOLDOWN_WITH_ID")?.template || null
            : channel.templates.find(({ type }) => type === "COOLDOWN")?.template || null;

        if (!template) {
            signale.error(`Could not find Template of type \`${song ? "COOLDOWN_WITH_ID" : "COOLDOWN"}\` for Channel \`${channel}\``);
            throw new Error(`Could not find Template of type \`${song ? "COOLDOWN_WITH_ID" : "COOLDOWN"}\` for Channel \`${channel}\``);
        }

        return song
            ? template
                  .replace("%REQUESTER%", user.userName)
                  .replace("%TITLE%", song.title)
                  .replace("%ARTIST%", song.artists as string)
                  .replace("%TIME%", moment((identification as Identification).date).fromNow())
                  .concat(channel.links && song.url ? ` → ${song.url}` : "")
            : template.replace("%REQUESTER%", user.userName).replace("%REMAINING%", remaining.toString());
    };

    /**
     * Returns the hydrated `ERROR`-Template for a Channel
     * @param channel Name of the Channel
     * @param user ChatUser containing User details
     * @param error Error message (optional)
     */
    public ERROR = (channel: Channel, user: ChatUser, errorMessage?: string): string => {
        const template = channel.templates.find((template) => template.type === "ERROR")?.template || null;

        if (!template) {
            signale.error(`Could not find Template of type \`ERROR\`  for Channel \`${channel}\``);
            throw new Error(`Could not find Template of type \`ERROR\`  for Channel \`${channel}\``);
        }

        return template.replace("%REQUESTER%", user.userName).replace("%ERROR%", errorMessage || "<unknown error>");
    };

    /**
     * Send a Chat message in a Channel
     * @param channel Channel configuration object
     * @param user ChatUser object of the person to respond to
     * @param message Chat message to respond with
     * @param client ChatClient to use to respond
     */
    public send = (channel: Channel, user: ChatUser, message: string, client: ChatClient): Promise<void> =>
        channel.actions ? client.action(channel.name, message) : client.say(channel.name, message);
}

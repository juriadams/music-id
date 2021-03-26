import { Channel } from "./channel.interface";
import { Song } from "./song.interface";
import { Trigger } from "./trigger.interface";

export interface Identification {
    id: string;
    channel: Partial<Channel>;
    requester: string;
    successful: boolean;
    date: Date;
    message: string;
    triggers: Partial<Trigger>[];
    songs: Song[];
}

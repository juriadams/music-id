import { Song } from "./song.interface";
import { Trigger } from "./trigger.interface";

export interface Identification {
    id: string;
    successful: boolean;
    date: Date;
    since: number;
    songs: Song[];
    triggers: Partial<Trigger>[];
}

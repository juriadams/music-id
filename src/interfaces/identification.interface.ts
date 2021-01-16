import { Song } from "./song.interface";

export interface Identification {
    channel: string;
    matchedTriggers: string[];
    message: string;
    requester: string;
    response: any;
    songs: Song[];
    success: boolean;
    timestamp: string;
    since?: number;
}

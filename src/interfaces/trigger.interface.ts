import { Channel } from "./channel.interface";
import { Identification } from "./identification.interface";

export interface Trigger {
    id: string;
    channel: Partial<Channel>;
    keyword: string;
    enabled: boolean;
    dateAdded: Date;
    dateUpdated: Date;
    identifications: Partial<Identification>[];
}

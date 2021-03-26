import { TEMPLATE_TYPES } from "../types/template.type";
import { Channel } from "./channel.interface";

export interface Template {
    id: string;
    channel: Partial<Channel>;
    type: TEMPLATE_TYPES;
    template: string;
    dateAdded: Date;
    dateUpdated: Date;
}

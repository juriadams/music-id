import { Identification } from "./identification.interface";
import { Template } from "./template.interface";
import { Trigger } from "./trigger.interface";

export interface Channel {
    id: string;
    name: string;
    enabled: string;
    cooldown: number;
    actions: boolean;
    links: boolean;
    dateAdded: Date;
    identifications: Partial<Identification>[];
    triggers: Trigger[];
    templates: Partial<Template>[];

    pending?: boolean;
    cooldownNotice?: boolean;
}

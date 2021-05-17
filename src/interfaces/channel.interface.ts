import { Identification } from "./identification.interface";
import { Trigger } from "./trigger.interface";

export interface Channel {
    id: string;
    name: string;
    enabled: string;
    cooldown: number;
    actions: boolean;
    links: boolean;
    dateAdded: Date;
    ignored: string[];
    identifications: Partial<Identification>[];
    triggers: Trigger[];
    templates: {
        success: string;
        cooldown: string;
        previousCooldown: string;
        error: string;
    };

    pending?: boolean;
    cooldownNotice?: boolean;
}

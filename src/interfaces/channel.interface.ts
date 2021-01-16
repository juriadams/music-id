export interface RawChannel {
    id: number;
    cooldown: number;
    channelName: string;
    active: boolean;
    useAction: boolean;
    enableLinks: boolean;
    messageTemplates: {
        type: "SUCCESS" | "COOLDOWN" | "COOLDOWN_WITH_ID" | "ERROR";
        template: string;
    }[];
    triggers: {
        keyword: string;
    }[];
}

export interface Channel {
    id: number;
    cooldown: number;
    channelName: string;
    active: boolean;
    useAction: boolean;
    enableLinks: boolean;
    messageTemplates: {
        type: "SUCCESS" | "COOLDOWN" | "COOLDOWN_WITH_ID" | "ERROR";
        template: string;
    }[];
    triggers: {
        keyword: string;
    }[];

    // These Properties are not included in the "raw" Channel but added during runtime
    pending?: boolean;
    cooldownSent?: boolean;
}

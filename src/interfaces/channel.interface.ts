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
    say?: (message: string) => void;
}

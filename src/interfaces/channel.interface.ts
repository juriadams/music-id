export interface Channel {
    channelName: string;
    cooldown: number;
    messageTemplates: {
        cooldown: string;
        cooldownWithId: string;
        error: string;
        success: string;
    };
    triggers: string[];
    enabled?: boolean;
}

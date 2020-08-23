import { Signale } from "signale";

export class Logger {
    /**
     * Public Signale instance
     */
    public signale = new Signale({
        config: {
            displayTimestamp: true,
        },
        types: {
            message: {
                badge: "💬",
                color: "purple",
                label: "message",
            },
        },
    });
}

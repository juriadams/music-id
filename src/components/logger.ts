import fs from "fs";
import pino from "pino";
import { createPinoBrowserSend, createWriteStream } from "pino-logflare";
import * as ms from "pino-multi-stream";

export class Logger {
    /**
     * Public Pino instance
     */
    public pino = pino(
        {
            name: "music-id",
            browser: {
                transmit: {
                    // @ts-expect-error
                    send: createPinoBrowserSend({
                        apiKey: process.env.LOGFLARE_API_KEY as string,
                        sourceToken: process.env.LOGFLARE_SOURCE as string,
                    }),
                },
            },
        },
        ms.multistream([
            {
                stream: createWriteStream({
                    apiKey: process.env.LOGFLARE_API_KEY as string,
                    sourceToken: process.env.LOGFLARE_SOURCE as string,
                }),
            },
            { stream: fs.createWriteStream(process.env.LOGFLARE_PATH as string) },
        ]),
    );
}

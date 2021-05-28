import { io, Socket } from "socket.io-client";

import { Signale } from "signale";

export default class Gateway {
    public socket: Socket;

    public on: (ev: string, ...args: any[]) => Socket;

    constructor() {
        const logger = new Signale().scope("WebSocket", "constructor");

        logger.await("Connecting to Gateway");
        this.socket = io(`ws://gateway:${process.env.GATEWAY_PORT}`, { auth: { secret: process.env.GATEWAY_SECRET } });

        this.socket.on("connect", () => {
            logger.success(`Connected to Gateway as \`${this.socket.id}\``);
        });

        this.on = this.socket.on;
    }
}

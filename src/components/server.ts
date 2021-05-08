import express from "express";

import TwitchClient from "./twitch";

import { Signale } from "signale";

export default class Server {
    /**
     * Basic Expess API responding to various requests
     */
    public express = express()
        .get("/", (_, res) => {
            res.status(200).json({
                status: "💓",
            });
        })
        .get("/channels", (req, res) => {
            const logger = new Signale().scope("Server", "channels");
            logger.await("Fetching current Channels");

            try {
                // Abort if Secret doesn't match
                if (process.env.NODE_ENV !== "development" && req.header("secret") !== process.env.SHARED_API_SECRET)
                    return res.status(403).json({ error: "Wrong Secret" });

                // Return list of Channels the Bot is part of and boolean if the Client is currently connected
                res.status(200).json({
                    isConnected: this.client.client?.isConnected,
                    channels: this.client.channels.partOf,
                });
            } catch (error) {
                logger.error("Error fetching Channels");
                logger.error(error);

                // Handle Errors
                res.status(500).json({ error: "Error getting Channels" });
            }
        })
        .listen(process.env.BOT_PORT || 3001);

    constructor(private client: TwitchClient) {}
}

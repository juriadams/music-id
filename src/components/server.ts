import express from "express";
import signale from "signale";

import TwitchClient from "./twitch";

export default class Server {
    /**
     * Basic Expess API responding to various requests
     */
    public express = express()
        .get("/", (_, res) => {
            if (!this.client.client) {
                return res.status(500).json({ error: "No ChatClient present" });
            }

            res.status(200).json({
                status: "💓",
            });
        })
        .get("/channels", (req, res) => {
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
                signale.error("Error getting Channels");
                signale.error(error);

                // Handle Errors
                res.status(500).json({ error: "Error getting Channels" });
            }
        })
        .get("/moderators", async (req, res) => {
            try {
                // Abort if Secret doesn't match
                if (!req.header("secret") || req.header("secret") !== process.env.SHARED_API_SECRET)
                    return res.status(403).json({ error: "Wrong Secret" });

                // Abort if `channel` is missing
                if (!req.query.channel) return res.status(400).json({ error: "Parameter `channel` missing" });

                if (!this.client.client) return res.status(500).json({ error: "No ChatClient present" });

                const moderators = await this.client.client.getMods(req.query.channel as string);

                // Return list of Moderators for Channel
                res.status(200).json({ moderators });
            } catch (error) {
                signale.error(`Error getting Moderators for \`${req.query.channel}\``);
                signale.error(error);

                // Handle Errors
                res.status(500).json({ error: "Error getting Channels" });
            }
        })
        .listen(process.env.BOT_PORT || 3001);

    constructor(private client: TwitchClient) {}
}

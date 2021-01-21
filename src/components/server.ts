import express from "express";

import TwitchClient from "./twitch";

import signale from "signale";

export default class Server {
    /**
     * Basic Express Server
     */
    public express: any;

    constructor(client: TwitchClient) {
        this.express = express()
            .get("/", (req, res) => {
                res.status(200).send("💓");
            })
            .get("/channels", (req, res) => {
                try {
                    // Abort if Secret doesn't match
                    if (process.env.NODE_ENV !== "development" && req.header("secret") !== process.env.API_SECRET)
                        return res.status(403).json({ error: "Wrong Secret" });

                    // Return list of Channels the Bot is part of
                    res.status(200).json({
                        channels: client.client.getChannels().map((channel: string) => channel.replace("#", "")),
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
                    if (!req.header("secret") || req.header("secret") !== process.env.API_SECRET)
                        return res.status(403).json({ error: "Wrong Secret" });

                    // Abort if `channel` is missing
                    if (!req.query.channel) return res.status(400).json({ error: "Parameter `channel` missing" });

                    const moderators = await client.client.getMods(req.query.channel);

                    // Return list of Moderators for Channel
                    res.status(200).json(moderators);
                } catch (error) {
                    signale.error(`Error getting Moderators for \`${req.query.channel}\``);
                    signale.error(error);

                    // Handle Errors
                    res.status(500).json({ error: "Error getting Channels" });
                }
            })
            .listen(process.env.PORT || 3000);
    }
}

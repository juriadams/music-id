import express from "express";

import TwitchClient from "./twitch";

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
                    res.status(200).json({ channels: client.client.getChannels() });
                } catch (error) {
                    // Handle Errors
                    res.status(500).json({ error: "Error getting Channels" });
                }
            })
            .listen(process.env.PORT || 3000);
    }
}

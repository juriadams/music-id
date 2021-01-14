import * as dotenv from "dotenv";
dotenv.config();

/**
 * Create Sentry daemon used to automatically track errors and crashes
 */
import * as sentry from "@sentry/node";
sentry.init({ dsn: process.env.SENTRY_DSN });

/**
 * Import classes
 */
import { TwitchClient } from "./components/twitch";
import { Channels } from "./components/channels";
import { MessageHandler } from "./components/message-handler";
import { MessageComposer } from "./components/composer";
import { Identifier } from "./components/identifier";
import { Logger } from "./components/logger";

/**
 * Create instances and distribute them
 */
const logger = new Logger();
const channels = new Channels(logger);
const identifier = new Identifier(logger);
const composer = new MessageComposer(logger, channels);
const handler = new MessageHandler(logger, channels, composer, identifier);

/**
 * Create new Twitch Client
 */
const client = new TwitchClient(logger, channels, handler);

/**
 * Create a basic Express App to handle a few HTTP Requests
 */
import express from "express";

express()
    .get("/", (req, res) => {
        // Return Heartbeat
        res.status(200).send("💓");
    })
    .get("/channels", (req, res) => {
        try {
            // Abort if Secret doesn't match
            if (req.header("secret") !== process.env.API_SECRET)
                return res.status(403).json({ error: "Wrong Secret." });

            // Get and return list of Channels
            const channels = client.client.getChannels();
            res.status(200).json({ channels });
        } catch (error) {
            // Handle Errors
            res.status(500).json({ error: "Error getting Channels" });
        }
    })
    .listen(process.env.PORT || 3000);

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, ".env") });

/**
 * Create Sentry daemon used to automatically track errors and crashes
 */
import * as sentry from "@sentry/node";
sentry.init({ dsn: process.env.SENTRY_DSN });

/**
 * Import classes
 */
import { Channels } from "./components/channels";
import { MessageComposer } from "./components/composer";
import { Identifier } from "./components/identifier";
import { Logger } from "./components/logger";
import { MessageHandler } from "./components/message-handler";
import { TwitchClient } from "./components/twitch";

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
 * Create a basic Express App to run monitoring checks against
 */
import express from "express";

express()
    .get("/", (req, res) => {
        logger.pino.info({ ip: req.ip }, `Received status check from ${req.ip}`);
        res.send("I'm alive!");
    })
    .listen(process.env.PORT || 3000);

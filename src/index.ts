import { environment } from "./environment";

/**
 * Create Sentry daemon used to automatically track errors and crashes
 */
import * as sentry from "@sentry/node";
sentry.init({ dsn: environment.sentry.dsn });

/**
 * Import classes
 */
import { TwitchClient } from "./components/twitch";
import { Channels } from "./components/channels";
import { MessageHandler } from "./components/message-handler";
import { MessageComposer } from "./components/composer";
import { Identifier } from "./components/identifier";

/**
 * Create instances and distribute them
 */
const channels = new Channels();
const identifier = new Identifier();
const composer = new MessageComposer(channels);
const handler = new MessageHandler(channels, composer, identifier);

/**
 * Create new Twitch Client
 */
const client = new TwitchClient(channels, handler);

/**
 * Create a basic Express App to run monitoring checks against
 */
import express from "express";

express()
    .get("/", (req, res) => {
        res.send("I'm alive!");
    })
    .listen(3001);

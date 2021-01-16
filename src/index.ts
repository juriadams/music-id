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
import { MessageHandler } from "./components/handler";
import { MessageComposer } from "./components/composer";
import { Identifier } from "./components/identifier";
import { Server } from "./components/server";

/**
 * Create instances and distribute them
 */
const channels = new Channels();
const identifier = new Identifier();
const composer = new MessageComposer(channels);
const handler = new MessageHandler(channels, composer, identifier);
const client = new TwitchClient(channels, handler);

new Server(client);

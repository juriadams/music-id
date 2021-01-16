import * as dotenv from "dotenv";
dotenv.config();

/**
 * Create Sentry Daemon if outside `development` Environment
 */
import * as sentry from "@sentry/node";
if (process.env.NODE_ENV !== "development") sentry.init({ dsn: process.env.SENTRY_DSN });

/**
 * Import Bot Components
 */
import Channels from "./components/channels";
import MessageComposer from "./components/composer";
import GraphQL from "./components/graphql";
import MessageHandler from "./components/handler";
import Identifier from "./components/identifier";
import Server from "./components/server";
import TwitchClient from "./components/twitch";

/**
 * Instanciate Bot Components
 */
const graphql = new GraphQL();
const channels = new Channels(graphql);
const identifier = new Identifier(graphql);
const composer = new MessageComposer(channels);
const handler = new MessageHandler(graphql, channels, composer, identifier);
const client = new TwitchClient(graphql, channels, handler);

new Server(client);

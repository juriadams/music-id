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
import { Firestore } from "./components/firestore";
import { Channels } from "./components/channels";
import { MessageHandler } from "./components/message-handler";
import { MessageComposer } from "./components/composer";
import { Identifier } from "./components/identifier";

/**
 * Create instances and distribute them
 */
const firestore = new Firestore();
const channels = new Channels(firestore);
const identifier = new Identifier(firestore);
const composer = new MessageComposer(channels);
const handler = new MessageHandler(firestore, channels, composer, identifier);

/**
 * Create new Twitch Client
 */
const client = new TwitchClient(firestore, channels, handler);

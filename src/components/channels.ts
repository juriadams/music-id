import { Firestore } from "./firestore";
import { Channel } from "../interfaces/channel.interface";
import { Identification } from "../interfaces/identification.interface";
import signale from "signale";
import moment from "moment";

export class Channels {
    /**
     * Object containing all currently loaded channels
     */
    public channels: {
        [key: string]: Channel;
    } = {};

    /**
     * Array of channel names which currently have song identification requests pending
     */
    public pendingChannels: string[] = [];

    /**
     * Array of channels which are on cooldown and where a cooldown warning message was already sent in
     */
    public cooldownMessageSent: string[] = [];

    constructor(public firestore: Firestore) {}

    /**
     * Get list of all available channels
     */
    public getChannels(): Promise<string[]> {
        return new Promise((resolve, reject) => {
            signale.start("Getting list of channels...");
            this.firestore.admin
                .collection("channels")
                .get()
                .then((snapshot) => {
                    // If snapshot is empty
                    if (snapshot.empty) {
                        signale.error("No channels found, aborting");
                        reject("No channels found, aborting");
                    }

                    // Iterate over channel documents and store them inside this service
                    snapshot.forEach((doc) => {
                        const channel: any = doc.data();
                        this.channels[channel.channelName] = channel;
                    });

                    // Resolve array of channel names, their full data is accessible inside this Class
                    resolve(Object.keys(this.channels));
                })
                .catch((err) => {
                    signale.error("Error getting list of channels");
                    reject("Error getting list of channels");
                });
        });
    }

    /**
     * Check if a channel is on cooldown
     * @param channel Name of the channel to check
     */
    public isOnCooldown(channel: string): Promise<Identification> {
        return new Promise((resolve, reject) => {
            signale.debug(`Checking cooldown for channel ${channel}...`);

            // Query to get last song identification attempt
            const lastAttemptQuery = this.firestore.admin
                .collection("identifications")
                .where("channel", "==", channel)
                .orderBy("timestamp", "desc")
                .limit(1);

            // Get last song identification attempt and calculate remaining seconds
            lastAttemptQuery
                .get()
                .then((snapshot) => {
                    // If no entry was found
                    if (snapshot.empty) {
                        signale.warn(`No song identification requests found for channel "${channel}"`);
                        reject(`No song identification requests found for channel "${channel}"`);
                    }

                    // @ts-ignore
                    const lastAttempt: Identification = snapshot.docs[0].data();

                    // Calculate time since last identification request and transform into `seconds`
                    const sinceLastRequest = moment().diff(moment(lastAttempt.timestamp), "seconds");

                    // Boolean if channel is on cooldown
                    const isOnCooldown = sinceLastRequest < this.channels[channel].cooldown;

                    signale.debug(
                        isOnCooldown
                            ? `Channel "${channel} is on cooldown, ${sinceLastRequest} seconds since last request"`
                            : `Channel "${channel} is NOT on cooldown, ${sinceLastRequest} seconds since last request"`,
                    );

                    // Resolve or reject depending if channel is on cooldown
                    if (isOnCooldown) {
                        resolve(lastAttempt);
                    } else {
                        reject(`Channel "${channel}" is not on cooldown`);
                    }
                })
                .catch((error) => {
                    signale.error("Error getting last identification");
                    signale.error(error);

                    reject("Error getting last identification");
                });
        });
    }
}

import { Song } from "../interfaces/song.interface";
import { Firestore } from "./firestore";
import { environment } from "../environment";
import got from "got";
import signale from "signale";

export class Identifier {
    constructor(public firestore: Firestore) {}

    /**
     * Request song identification for given channel
     * @param channel Name of the channel to request song identification for
     */
    public identify(channel: string): Promise<Song[]> {
        return new Promise((resolve, reject) => {
            got(`https://api.adams.sh/music-id/id/${channel}`, {
                retry: 0,
                responseType: "json",
                resolveBodyOnly: true,
                headers: {
                    apikey: environment.apikey,
                },
            })
                .then((response: any) => {
                    // Reject if any errors occurr
                    if (!response || response.status !== "success") {
                        signale.error(`Error identifying songs`);
                        signale.error(response);

                        reject("Error identifying songs");
                    }

                    // Resolve found songs
                    resolve(response.data);
                })
                .catch((err) => {
                    reject(`Error identifying songs, status code ${err.response.statusCode}`);
                });
        });
    }
}

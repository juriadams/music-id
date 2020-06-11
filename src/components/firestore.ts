import { environment } from "../environment";
import * as admin from "firebase-admin";
import signale from "signale";

export class Firestore {
    /**
     * Firestore admin instance
     */
    // @ts-ignore
    public admin: FirebaseFirestore.Firestore;

    constructor() {}

    public init(): Promise<FirebaseFirestore.Firestore> {
        return new Promise((resolve) => {
            signale.await("Connecting to Firestore");

            // Initialize new firebase instance
            admin.initializeApp({
                // @ts-ignore, some unused params are missing in environment.ts
                credential: admin.credential.cert(environment.google.serviceAccount),
            });

            // Save firestore instance as public class member
            this.admin = admin.firestore();

            // Log success message
            signale.success("Connected to Firestore");

            resolve(this.admin);
        });
    }
}

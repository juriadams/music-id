export interface Client {
    id: string;
    name: string;
    clientId: string;
    clientSecret: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    dateUpdated: Date;
    dateAccessed: Date;
    environment: "development" | "production";
}

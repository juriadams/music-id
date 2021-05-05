export interface Song {
    id: string;
    provider: string;
    providerId: string;
    isrc: string;
    title: string;
    artists: { id: string; name: string }[];
    albums: { id: string; name: string }[];
    label: string;
    releaseDate: Date;
    url: string;
    platforms: {
        spotify?: string;
        apple?: string;
        deezer?: string;
        youtube?: string;
    };
}

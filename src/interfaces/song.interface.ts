export interface Song {
    title: string;
    artist: string;
    album: string;
    label: string;
    timecode: string;
    acrid: string;
    urls: {
        spotify: string;
        deezer: string;
        youtube: string;
    };
    url: string;
}

import { Identification } from "./identification.interface";

export interface Song {
    id: string;
    identification: Identification;
    acrId: string;
    isrc: string;
    upc: string;
    title: string;
    album: string;
    artists: string | string[];
    label: string;
    score: number;
    resultFrom: number;
    releaseDate: Date;
    url: string;
    urls: string | any;
    duration: string;
    timecode: string;
}

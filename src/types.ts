export interface Concert {
  id: number;
  band: string;
  venue: string;
  date: string;
  audioFile: string;
}

export interface ConcertData {
  concerts: Concert[];
}

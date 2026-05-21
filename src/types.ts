export type HtbCertification = {
  name: string;
  code: string;
  date: string;
  verified: boolean;
  svg?: string;
};

export type HtbProfile = {
  avatar: string;
  username: string;
  handle: string;
  country: string;
  level: number;
  xpCurrent: number;
  xpNext: number;
  rank: string;
  grade: string;
  certifications: HtbCertification[];
};

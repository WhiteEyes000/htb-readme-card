export const RANK_SVG_URLS = {
  beginner:
    "https://htb-experience-prod-public-storage.s3.amazonaws.com/assets/ranks/svg/rank_beginner.svg",
  apprentice:
    "https://htb-experience-prod-public-storage.s3.amazonaws.com/assets/ranks/svg/rank_apprentice.svg",
  skilled:
    "https://htb-experience-prod-public-storage.s3.amazonaws.com/assets/ranks/svg/rank_skilled.svg",
  professional:
    "https://htb-experience-prod-public-storage.s3.amazonaws.com/assets/ranks/svg/rank_professional.svg",
  master:
    "https://htb-experience-prod-public-storage.s3.amazonaws.com/assets/ranks/svg/rank_master.svg",
  prodigy:
    "https://htb-experience-prod-public-storage.s3.amazonaws.com/assets/ranks/svg/rank_prodigy.svg",
  grandmaster:
    "https://htb-experience-prod-public-storage.s3.amazonaws.com/assets/ranks/svg/rank_grandmaster.svg",
} as const;

export type HtbRank = keyof typeof RANK_SVG_URLS;

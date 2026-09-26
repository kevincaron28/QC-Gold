-- The recurring recruitment post was removed (roadmap: not needed).
ALTER TABLE "GuildSettings" DROP COLUMN "recruitmentChannelId",
DROP COLUMN "recruitmentMessage",
DROP COLUMN "recruitmentIntervalHours",
DROP COLUMN "recruitmentLastPostedAt";

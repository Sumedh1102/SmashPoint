import type { Permission } from "@/lib/rbac";

/** Top-level folders in the media bucket and who may upload into each. `null` = any signed-in user. */
export const MEDIA_FOLDERS = {
  gallery: "gallery:manage",
  sports: "sports:manage",
  courts: "courts:manage",
  facilities: "facilities:manage",
  coaches: "coaches:manage",
  coaching: "coaching-ads:manage",
  equipment: "equipment:manage",
  "food-beverages": "food:manage",
  events: "events:manage",
  site: "settings:manage",
  students: "students:manage",
  profiles: null,
} as const satisfies Record<string, Permission | null>;

export type MediaFolder = keyof typeof MEDIA_FOLDERS;

export const isMediaFolder = (v: string): v is MediaFolder => Object.hasOwn(MEDIA_FOLDERS, v);

export const MEDIA_BUCKET = "academy-media";
/** Kept below the 4.5 MB request limit of serverless hosts; the uploader downsizes larger photos. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

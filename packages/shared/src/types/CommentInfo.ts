import type { ImageInfo } from "./ImageInfo.js";
import type { Page } from "./Page.js";
import type { ServiceId } from "../enums/ServiceId.js";

/**
  * Comment listing for a stream.
  * Mirrors org.schabi.newpipe.extractor.comments.CommentsInfo.
  */
export interface CommentInfo {
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly items: readonly CommentItem[];
  readonly nextPage: Page | null;
  readonly commentsCount: number | null;
  readonly isCommentsDisabled: boolean;
}

/**
  * A single comment entry.
  * Mirrors org.schabi.newpipe.extractor.comments.CommentsInfoItem.
  */
export interface CommentItem {
  readonly serviceId: ServiceId;
  readonly url: string;
  readonly name: string;
  readonly commentId: string;
  readonly commentText: string;
  readonly uploaderName: string;
  readonly uploaderUrl: string | null;
  readonly uploaderAvatars: readonly ImageInfo[];
  readonly uploaderVerified: boolean;
  readonly textualUploadDate: string | null;
  readonly uploadDate: string | null;
  readonly likeCount: number | null;
  readonly heartedByUploader: boolean;
  readonly pinned: boolean;
  readonly replyCount: number | null;
  readonly replies: Page | null;
  readonly creatorReply: boolean;
}

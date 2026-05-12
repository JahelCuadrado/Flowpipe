import type { Downloader } from "../../../core/types.js";
import type { CommentInfo, CommentItem, ImageInfo, Page } from "@newpipe/shared";
import { ServiceId, ImageResolutionLevel } from "@newpipe/shared";
import {
  buildDesktopContext,
  postToInnerTube,
  getTextFromObject,
  getThumbnailsFromInfoItem,
  getUrlFromNavigationEndpoint,
} from "../YoutubeParsingHelper.js";

// ─── Video ID extraction ────────────────────────────────────────────────────

const VIDEO_ID_REGEX = /(?:v=|\/v\/|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url: string): string {
  const match = VIDEO_ID_REGEX.exec(url);
  return match?.[1] ?? "";
}

// ─── Comments info extraction ───────────────────────────────────────────────

export async function youtubeGetCommentsInfo(
  downloader: Downloader,
  url: string,
  localization = "en",
  country = "US"
): Promise<CommentInfo> {
  const context = await buildDesktopContext(downloader, localization, country);
  const videoId = extractVideoId(url);

  if (!videoId) {
    return {
      serviceId: ServiceId.YouTube,
      url,
      items: [],
      nextPage: null,
      commentsCount: null,
      isCommentsDisabled: true,
    };
  }

  // First, fetch the "next" response to get the continuation token for comments
  const nextBody: Record<string, unknown> = {
    context,
    videoId,
  };

  const nextResponse = await postToInnerTube(downloader, "next", nextBody as never);

  // Find comments section continuation token
  const commentsContinuation = findCommentsContinuation(nextResponse);

  if (!commentsContinuation) {
    return {
      serviceId: ServiceId.YouTube,
      url,
      items: [],
      nextPage: null,
      commentsCount: null,
      isCommentsDisabled: true,
    };
  }

  // Fetch comments using the continuation token
  const commentsBody: Record<string, unknown> = {
    context,
    continuation: commentsContinuation,
  };

  const commentsResponse = await postToInnerTube(downloader, "next", commentsBody as never);

  return parseCommentsResponse(commentsResponse, url);
}

export async function youtubeGetCommentsNextPage(
  downloader: Downloader,
  url: string,
  page: Page,
  localization = "en",
  country = "US"
): Promise<CommentInfo> {
  const context = await buildDesktopContext(downloader, localization, country);

  const body: Record<string, unknown> = {
    context,
    continuation: page.id,
  };

  const response = await postToInnerTube(downloader, "next", body as never);

  return parseCommentsResponse(response, url);
}

// ─── Continuation token finder ──────────────────────────────────────────────

function findCommentsContinuation(data: Record<string, unknown>): string | null {
  const contents = data["contents"] as Record<string, unknown> | undefined;
  const twoColumn = contents?.["twoColumnWatchNextResults"] as Record<string, unknown> | undefined;
  const results = twoColumn?.["results"] as Record<string, unknown> | undefined;
  const resultsRenderer = results?.["results"] as Record<string, unknown> | undefined;
  const resultContents = resultsRenderer?.["contents"] as Array<Record<string, unknown>> | undefined;

  if (!resultContents) {
    return null;
  }

  for (const item of resultContents) {
    const itemSection = item["itemSectionRenderer"] as Record<string, unknown> | undefined;
    if (!itemSection) {
      continue;
    }

    const sectionContents = itemSection["contents"] as Array<Record<string, unknown>> | undefined;
    if (!sectionContents) {
      continue;
    }

    for (const content of sectionContents) {
      const commentSec = content["commentsEntryPointHeaderRenderer"] as Record<string, unknown> | undefined;
      if (commentSec) {
        continue;
      }

      const continuationItem = content["continuationItemRenderer"] as Record<string, unknown> | undefined;
      if (continuationItem) {
        const endpoint = continuationItem["continuationEndpoint"] as Record<string, unknown> | undefined;
        const command = endpoint?.["continuationCommand"] as Record<string, unknown> | undefined;
        const token = command?.["token"] as string | undefined;
        if (token) {
          return token;
        }
      }
    }
  }

  // Try engagement panels
  const engagementPanels = data["engagementPanels"] as Array<Record<string, unknown>> | undefined;
  if (engagementPanels) {
    for (const panel of engagementPanels) {
      const panelRenderer = panel["engagementPanelSectionListRenderer"] as Record<string, unknown> | undefined;
      const panelId = panelRenderer?.["panelIdentifier"] as string | undefined;
      if (panelId === "comment-item-section") {
        const panelHeader = panelRenderer?.["header"] as Record<string, unknown> | undefined;
        const commentHeaderRenderer = panelHeader?.["engagementPanelTitleHeaderRenderer"] as Record<string, unknown> | undefined;
        const menu = commentHeaderRenderer?.["menu"] as Record<string, unknown> | undefined;
        const sortMenu = menu?.["sortFilterSubMenuRenderer"] as Record<string, unknown> | undefined;
        const subMenuItems = sortMenu?.["subMenuItems"] as Array<Record<string, unknown>> | undefined;
        if (subMenuItems?.[0]) {
          const continuation = subMenuItems[0]["serviceEndpoint"] as Record<string, unknown> | undefined;
          const contCommand = continuation?.["continuationCommand"] as Record<string, unknown> | undefined;
          const token = contCommand?.["token"] as string | undefined;
          if (token) {
            return token;
          }
        }

        // Try content continuation
        const panelContent = panelRenderer?.["content"] as Record<string, unknown> | undefined;
        const sectionList = panelContent?.["sectionListRenderer"] as Record<string, unknown> | undefined;
        const panelContents = sectionList?.["contents"] as Array<Record<string, unknown>> | undefined;
        if (panelContents) {
          for (const c of panelContents) {
            const itemSec = c["itemSectionRenderer"] as Record<string, unknown> | undefined;
            const secContents = itemSec?.["contents"] as Array<Record<string, unknown>> | undefined;
            if (secContents) {
              for (const sc of secContents) {
                const contItem = sc["continuationItemRenderer"] as Record<string, unknown> | undefined;
                const ep = contItem?.["continuationEndpoint"] as Record<string, unknown> | undefined;
                const cmd = ep?.["continuationCommand"] as Record<string, unknown> | undefined;
                const tok = cmd?.["token"] as string | undefined;
                if (tok) {
                  return tok;
                }
              }
            }
          }
        }
      }
    }
  }

  return null;
}

// ─── Response parsers ───────────────────────────────────────────────────────

/**
 * Index of entity mutations keyed by entityKey.
 * Used by the new commentViewModel format where comment data is stored
 * in frameworkUpdates.entityBatchUpdate.mutations rather than inline.
 */
type MutationIndex = Map<string, Record<string, unknown>>;

function buildMutationIndex(data: Record<string, unknown>): MutationIndex {
  const index: MutationIndex = new Map();
  const frameworkUpdates = data["frameworkUpdates"] as Record<string, unknown> | undefined;
  const entityBatchUpdate = frameworkUpdates?.["entityBatchUpdate"] as Record<string, unknown> | undefined;
  const mutations = entityBatchUpdate?.["mutations"] as Array<Record<string, unknown>> | undefined;
  if (!mutations) return index;

  for (const mutation of mutations) {
    const key = mutation["entityKey"] as string | undefined;
    const payload = mutation["payload"] as Record<string, unknown> | undefined;
    if (key && payload) {
      // Payload contains a single typed key (e.g. commentEntityPayload)
      // Flatten to the inner object for easier access
      const values = Object.values(payload);
      if (values.length > 0 && typeof values[0] === "object" && values[0] !== null) {
        index.set(key, values[0] as Record<string, unknown>);
      }
    }
  }
  return index;
}

function parseCommentsResponse(data: Record<string, unknown>, url: string): CommentInfo {
  const items: CommentItem[] = [];
  let nextPage: Page | null = null;
  let commentsCount: number | null = null;

  const mutationIndex = buildMutationIndex(data);

  // Try onResponseReceivedEndpoints (initial load)
  const endpoints = data["onResponseReceivedEndpoints"] as Array<Record<string, unknown>> | undefined;

  if (endpoints) {
    for (const endpoint of endpoints) {
      const reloadAction = endpoint["reloadContinuationItemsCommand"] as Record<string, unknown> | undefined;
      const appendAction = endpoint["appendContinuationItemsAction"] as Record<string, unknown> | undefined;
      const target = reloadAction ?? appendAction;

      if (!target) {
        continue;
      }

      const continuationItems = target["continuationItems"] as Array<Record<string, unknown>> | undefined;
      if (!continuationItems) {
        continue;
      }

      for (const item of continuationItems) {
        if (item["commentThreadRenderer"]) {
          const thread = item["commentThreadRenderer"] as Record<string, unknown>;
          const comment = parseCommentThread(thread, url, mutationIndex);
          if (comment) {
            items.push(comment);
          }
        } else if (item["continuationItemRenderer"]) {
          nextPage = extractCommentContinuation(item["continuationItemRenderer"] as Record<string, unknown>);
        } else if (item["commentsHeaderRenderer"]) {
          const headerRenderer = item["commentsHeaderRenderer"] as Record<string, unknown>;
          const countText = getTextFromObject(headerRenderer["countText"] as Record<string, unknown>);
          if (countText) {
            const num = countText.replace(/[^0-9]/g, "");
            if (num) {
              commentsCount = parseInt(num, 10);
            }
          }
        }
      }
    }
  }

  return {
    serviceId: ServiceId.YouTube,
    url,
    items,
    nextPage,
    commentsCount,
    isCommentsDisabled: false,
  };
}

function parseCommentThread(
  thread: Record<string, unknown>,
  videoUrl: string,
  mutationIndex: MutationIndex
): CommentItem | null {
  // ── New format: commentViewModel with mutations ──
  const viewModelWrapper = thread["commentViewModel"] as Record<string, unknown> | undefined;
  const viewModel = viewModelWrapper?.["commentViewModel"] as Record<string, unknown> | undefined;

  if (viewModel) {
    return parseCommentFromViewModel(viewModel, thread, videoUrl, mutationIndex);
  }

  // ── Legacy format: comment.commentRenderer ──
  const commentObj = thread["comment"] as Record<string, unknown> | undefined;
  const renderer = commentObj?.["commentRenderer"] as Record<string, unknown> | undefined;

  if (!renderer) {
    return null;
  }

  return parseCommentFromRenderer(renderer, thread, videoUrl);
}

/**
 * Parses a comment from the new commentViewModel format.
 * Comment data is stored in frameworkUpdates mutations, referenced by keys.
 */
function parseCommentFromViewModel(
  viewModel: Record<string, unknown>,
  thread: Record<string, unknown>,
  videoUrl: string,
  mutationIndex: MutationIndex
): CommentItem | null {
  const commentKey = viewModel["commentKey"] as string | undefined;
  const toolbarStateKey = viewModel["toolbarStateKey"] as string | undefined;
  const commentId = (viewModel["commentId"] as string) ?? "";

  if (!commentKey) return null;

  const entity = mutationIndex.get(commentKey);
  if (!entity) return null;

  // Properties hold content, publishedTime, etc.
  const properties = entity["properties"] as Record<string, unknown> | undefined;
  const contentObj = properties?.["content"] as Record<string, unknown> | undefined;
  const commentText = (contentObj?.["content"] as string) ?? "";
  const textualUploadDate = (properties?.["publishedTime"] as string) ?? null;

  // Author info
  const author = entity["author"] as Record<string, unknown> | undefined;
  const uploaderName = (author?.["displayName"] as string) ?? "";
  const channelId = (author?.["channelId"] as string) ?? null;
  const uploaderUrl = channelId ? `https://www.youtube.com/channel/${channelId}` : null;
  const avatarUrl = (author?.["avatarThumbnailUrl"] as string) ?? null;
  const uploaderVerified = (author?.["isVerified"] as boolean) ?? false;
  const isCreator = (author?.["isCreator"] as boolean) ?? false;

  const uploaderAvatars: ImageInfo[] = avatarUrl
    ? [{ url: avatarUrl, width: 88, height: 88, estimatedResolutionLevel: ImageResolutionLevel.Low }]
    : [];

  // Toolbar holds like count, reply count
  const toolbar = entity["toolbar"] as Record<string, unknown> | undefined;
  const likeCountStr = (toolbar?.["likeCountNotliked"] as string) ?? null;
  let likeCount: number | null = null;
  if (likeCountStr) {
    const num = likeCountStr.replace(/[^0-9]/g, "");
    if (num) likeCount = parseInt(num, 10);
  }

  const replyCountStr = (toolbar?.["replyCount"] as string) ?? null;
  let replyCount: number | null = null;
  if (replyCountStr) {
    const num = replyCountStr.replace(/[^0-9]/g, "");
    if (num) replyCount = parseInt(num, 10);
  }

  // Heart state from toolbar state entity
  let heartedByUploader = false;
  if (toolbarStateKey) {
    const toolbarState = mutationIndex.get(toolbarStateKey);
    heartedByUploader = toolbarState?.["heartState"] === "TOOLBAR_HEART_STATE_HEARTED";
  }

  // Pinned
  const pinnedText = viewModel["pinnedText"] as string | undefined;
  const pinned = !!pinnedText;

  // Replies continuation
  let replies: Page | null = null;
  const repliesRenderer = thread["replies"] as Record<string, unknown> | undefined;
  const commentReplies = repliesRenderer?.["commentRepliesRenderer"] as Record<string, unknown> | undefined;
  if (commentReplies) {
    const replyContinuations = commentReplies["contents"] as Array<Record<string, unknown>> | undefined;
    if (replyContinuations?.[0]?.["continuationItemRenderer"]) {
      replies = extractCommentContinuation(
        replyContinuations[0]["continuationItemRenderer"] as Record<string, unknown>
      );
    }
  }

  return {
    serviceId: ServiceId.YouTube,
    url: videoUrl,
    name: uploaderName,
    commentId,
    commentText,
    uploaderName,
    uploaderUrl,
    uploaderAvatars,
    uploaderVerified,
    textualUploadDate,
    uploadDate: null,
    likeCount,
    heartedByUploader,
    pinned,
    replyCount,
    replies,
    creatorReply: isCreator,
  };
}

/**
 * Parses a comment from the legacy commentRenderer format.
 * Kept for backward compatibility in case YouTube serves both formats.
 */
function parseCommentFromRenderer(
  renderer: Record<string, unknown>,
  thread: Record<string, unknown>,
  videoUrl: string
): CommentItem | null {
  const commentId = (renderer["commentId"] as string) ?? "";
  const contentText = renderer["contentText"] as Record<string, unknown> | undefined;
  const commentText = getTextFromObject(contentText) ?? "";

  // Author info
  const authorText = renderer["authorText"] as Record<string, unknown> | undefined;
  const uploaderName = (authorText?.["simpleText"] as string) ?? getTextFromObject(authorText) ?? "";
  const authorEndpoint = renderer["authorEndpoint"] as Record<string, unknown> | undefined;
  const uploaderUrl = getUrlFromNavigationEndpoint(authorEndpoint);
  const uploaderAvatars = toImageInfoList(getThumbnailsFromInfoItem(renderer["authorThumbnail"] as Record<string, unknown> ?? {}));
  const authorIsChannelOwner = (renderer["authorIsChannelOwner"] as boolean) ?? false;

  // Published time
  const publishedTimeText = renderer["publishedTimeText"] as Record<string, unknown> | undefined;
  const textualUploadDate = getTextFromObject(publishedTimeText);

  // Likes
  const voteCount = renderer["voteCount"] as Record<string, unknown> | undefined;
  const likeText = getTextFromObject(voteCount);
  let likeCount: number | null = null;
  if (likeText) {
    const num = likeText.replace(/[^0-9]/g, "");
    if (num) likeCount = parseInt(num, 10);
  }

  // Hearted
  const actionButtons = renderer["actionButtons"] as Record<string, unknown> | undefined;
  const commentActionButtons = actionButtons?.["commentActionButtonsRenderer"] as Record<string, unknown> | undefined;
  const creatorHeart = commentActionButtons?.["creatorHeart"] as Record<string, unknown> | undefined;
  const heartedByUploader = !!creatorHeart?.["creatorHeartRenderer"];

  // Pinned
  const pinnedHeader = renderer["pinnedCommentBadge"] as Record<string, unknown> | undefined;
  const pinned = !!pinnedHeader;

  // Verified
  const authorBadges = renderer["authorCommentBadge"] as Record<string, unknown> | undefined;
  const uploaderVerified = !!authorBadges;

  // Replies
  const repliesRenderer = thread["replies"] as Record<string, unknown> | undefined;
  const commentReplies = repliesRenderer?.["commentRepliesRenderer"] as Record<string, unknown> | undefined;
  let replyCount: number | null = null;
  let replies: Page | null = null;

  if (commentReplies) {
    const moreText = commentReplies["viewReplies"] as Record<string, unknown> | undefined;
    const buttonRenderer = moreText?.["buttonRenderer"] as Record<string, unknown> | undefined;
    const replyText = getTextFromObject(buttonRenderer?.["text"] as Record<string, unknown>);
    if (replyText) {
      const num = replyText.replace(/[^0-9]/g, "");
      if (num) replyCount = parseInt(num, 10);
    }

    const replyContinuations = commentReplies["contents"] as Array<Record<string, unknown>> | undefined;
    if (replyContinuations?.[0]?.["continuationItemRenderer"]) {
      replies = extractCommentContinuation(
        replyContinuations[0]["continuationItemRenderer"] as Record<string, unknown>
      );
    }
  }

  return {
    serviceId: ServiceId.YouTube,
    url: videoUrl,
    name: uploaderName,
    commentId,
    commentText,
    uploaderName,
    uploaderUrl,
    uploaderAvatars,
    uploaderVerified,
    textualUploadDate,
    uploadDate: null,
    likeCount,
    heartedByUploader,
    pinned,
    replyCount,
    replies,
    creatorReply: authorIsChannelOwner,
  };
}

function extractCommentContinuation(renderer: Record<string, unknown>): Page | null {
  const continuationEndpoint = renderer["continuationEndpoint"] as Record<string, unknown> | undefined;
  const buttonRenderer = renderer["button"] as Record<string, unknown> | undefined;

  let token: string | undefined;

  if (continuationEndpoint) {
    const command = continuationEndpoint["continuationCommand"] as Record<string, unknown> | undefined;
    token = command?.["token"] as string | undefined;
  }

  if (!token && buttonRenderer) {
    const btnRenderer = buttonRenderer["buttonRenderer"] as Record<string, unknown> | undefined;
    const btnCommand = btnRenderer?.["command"] as Record<string, unknown> | undefined;
    const contCommand = btnCommand?.["continuationCommand"] as Record<string, unknown> | undefined;
    token = contCommand?.["token"] as string | undefined;
  }

  if (!token) {
    return null;
  }

  return { url: "", id: token };
}

function toImageInfoList(thumbs: Array<{ url: string; width: number; height: number }>): ImageInfo[] {
  return thumbs.map((t) => ({
    url: t.url,
    width: t.width,
    height: t.height,
    estimatedResolutionLevel:
      t.height <= 0 ? ImageResolutionLevel.Unknown
        : t.height < 200 ? ImageResolutionLevel.Low
          : t.height < 500 ? ImageResolutionLevel.Medium
            : ImageResolutionLevel.High,
  }));
}

import type { Env } from "./types";
import { StoriesRepository } from "./repositories/stories.repository";
import { ChaptersRepository } from "./repositories/chapters.repository";
import { UsersRepository } from "./repositories/users.repository";
import { SessionsRepository } from "./repositories/sessions.repository";
import { MagicLinkRepository } from "./repositories/magic-link.repository";
import { FollowsRepository } from "./repositories/follows.repository";
import { LikesRepository } from "./repositories/likes.repository";
import { CommentsRepository } from "./repositories/comments.repository";
import { RestrictionsRepository } from "./repositories/restrictions.repository";
import { McpTokensRepository } from "./repositories/mcp-tokens.repository";
import { OAuthClientsRepository } from "./repositories/oauth-clients.repository";
import { OAuthCodesRepository } from "./repositories/oauth-codes.repository";
import { OAuthTokensRepository } from "./repositories/oauth-tokens.repository";
import { StoryService } from "./services/story.service";
import { ChapterService } from "./services/chapter.service";
import { CommentService } from "./services/comment.service";
import { AuthService } from "./services/auth.service";
import { AdminStoryService } from "./services/admin-story.service";
import { AdminUserService } from "./services/admin-user.service";
import { ProfileService } from "./services/profile.service";
import { McpTokenService } from "./services/mcp-token.service";
import { McpToolsService } from "./services/mcp-tools.service";
import { OAuthService } from "./services/oauth.service";

/**
 * Composition root: wires repositories (data access) into services
 * (business logic) for a single request. Cheap to build per-request — these
 * are thin wrapper objects, no connection setup — which keeps every route
 * handler free of direct D1 access and free of picking which repos a given
 * flow needs.
 */
export function createContainer(env: Env) {
  const stories = new StoriesRepository(env.DB);
  const chapters = new ChaptersRepository(env.DB);
  const users = new UsersRepository(env.DB);
  const sessions = new SessionsRepository(env.DB);
  const magicLinks = new MagicLinkRepository(env.DB);
  const follows = new FollowsRepository(env.DB);
  const likes = new LikesRepository(env.DB);
  const comments = new CommentsRepository(env.DB);
  const restrictions = new RestrictionsRepository(env.DB);
  const mcpTokens = new McpTokensRepository(env.DB);
  const oauthClients = new OAuthClientsRepository(env.DB);
  const oauthCodes = new OAuthCodesRepository(env.DB);
  const oauthTokens = new OAuthTokensRepository(env.DB);

  return {
    storyService: new StoryService(stories, chapters, follows),
    chapterService: new ChapterService(stories, chapters, likes, restrictions),
    commentService: new CommentService(comments, restrictions),
    authService: new AuthService(users, sessions, magicLinks, restrictions, env),
    adminStoryService: new AdminStoryService(stories, chapters, comments, likes, follows),
    adminUserService: new AdminUserService(users, restrictions, sessions),
    profileService: new ProfileService(follows, comments, users),
    mcpTokenService: new McpTokenService(mcpTokens),
    mcpToolsService: new McpToolsService(stories, chapters),
    oauthService: new OAuthService(oauthClients, oauthCodes, oauthTokens),
  };
}

export type Container = ReturnType<typeof createContainer>;

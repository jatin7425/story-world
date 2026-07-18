import type { Env } from "./types";
import { StoriesRepository } from "./repositories/stories.repository";
import { ChaptersRepository } from "./repositories/chapters.repository";
import { ImagesRepository } from "./repositories/images.repository";
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
import { StoryTranslationsRepository } from "./repositories/story-translations.repository";
import { ChapterTranslationsRepository } from "./repositories/chapter-translations.repository";
import { TranslationJobsRepository } from "./repositories/translation-jobs.repository";
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
import { TranslationService } from "./services/translation.service";
import { TranslationJobService } from "./services/translation-job.service";
import { WorkersAiProvider, GroqProvider, GeminiProvider, AionProvider, type TranslationProvider } from "./lib/translation-providers";

/** Collects however many `${prefix}_1`..`${prefix}_10` secrets are actually set, in order — see types.ts's NumberedKeySlots. */
function collectNumberedKeys(env: Env, prefix: "GROQ_API_KEY" | "GEMINI_API_KEY" | "AION_API_KEY"): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const value = env[`${prefix}_${i}` as keyof Env] as string | undefined;
    if (value) keys.push(value);
  }
  return keys;
}

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
  const images = new ImagesRepository(env.DB);
  const oauthClients = new OAuthClientsRepository(env.DB);
  const oauthCodes = new OAuthCodesRepository(env.DB);
  const oauthTokens = new OAuthTokensRepository(env.DB);
  const storyTranslations = new StoryTranslationsRepository(env.DB);
  const chapterTranslations = new ChapterTranslationsRepository(env.DB);
  const translationJobs = new TranslationJobsRepository(env.DB);

  // Provider chain order: Workers AI (free, in-platform) -> Groq -> Gemini.
  // Aion is NOT part of this chain — it's only invoked by
  // TranslationJobService as a targeted fallback when one of these three
  // refuses on policy/safety grounds, never for quota/network failures.
  const providers: TranslationProvider[] = [
    new WorkersAiProvider(env.AI),
    new GroqProvider(collectNumberedKeys(env, "GROQ_API_KEY")),
    new GeminiProvider(collectNumberedKeys(env, "GEMINI_API_KEY")),
  ];
  const aionKeys = collectNumberedKeys(env, "AION_API_KEY");
  const aion = aionKeys.length > 0 ? new AionProvider(aionKeys) : undefined;

  const translationService = new TranslationService(storyTranslations, chapterTranslations);

  return {
    storyService: new StoryService(stories, chapters, follows, translationService),
    chapterService: new ChapterService(stories, chapters, likes, restrictions, translationService),
    commentService: new CommentService(comments, restrictions),
    authService: new AuthService(users, sessions, magicLinks, restrictions, env),
    adminStoryService: new AdminStoryService(stories, chapters, comments, likes, follows, storyTranslations, chapterTranslations),
    adminUserService: new AdminUserService(users, restrictions, sessions),
    profileService: new ProfileService(follows, comments, users),
    mcpTokenService: new McpTokenService(mcpTokens),
    mcpToolsService: new McpToolsService(stories, chapters, images, chapterTranslations),
    imagesRepository: images,
    oauthService: new OAuthService(oauthClients, oauthCodes, oauthTokens),
    translationJobService: new TranslationJobService(
      translationJobs,
      stories,
      chapters,
      storyTranslations,
      chapterTranslations,
      providers,
      aion
    ),
  };
}

export type Container = ReturnType<typeof createContainer>;

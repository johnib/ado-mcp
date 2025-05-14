import { WebApi } from 'azure-devops-node-api';
import {
  CommentThreadStatus,
  CommentType,
  GitPullRequest,
  GitPullRequestChange,
  GitPullRequestCommentThread,
  GitPullRequestSearchCriteria,
  PullRequestStatus
} from 'azure-devops-node-api/interfaces/GitInterfaces';
import { z } from 'zod';
import { AzureDevOpsResourceNotFoundError } from '../../common/errors';
import * as schemas from './schemas';

/**
 * Convert string status to PullRequestStatus enum
 */
function convertToPullRequestStatus(status: string): PullRequestStatus {
  switch (status) {
    case 'active':
      return PullRequestStatus.Active;
    case 'abandoned':
      return PullRequestStatus.Abandoned;
    case 'completed':
      return PullRequestStatus.Completed;
    case 'all':
      return PullRequestStatus.All;
    default:
      throw new Error(`Invalid pull request status: ${status}`);
  }
}

/**
 * Convert string status to CommentThreadStatus enum
 */
function convertToCommentThreadStatus(status: string): CommentThreadStatus {
  switch (status.toLowerCase()) {
    case 'unknown':
      return CommentThreadStatus.Unknown;
    case 'active':
      return CommentThreadStatus.Active;
    case 'fixed':
      return CommentThreadStatus.Fixed;
    case 'wontfix':
      return CommentThreadStatus.WontFix;
    case 'closed':
      return CommentThreadStatus.Closed;
    case 'bydesign':
      return CommentThreadStatus.ByDesign;
    case 'pending':
      return CommentThreadStatus.Pending;
    default:
      throw new Error(`Invalid thread status: ${status}`);
  }
}

/**
 * Get a specific pull request
 */
export async function getPullRequest(
  connection: WebApi,
  args: z.infer<typeof schemas.GetPullRequestSchema>
): Promise<GitPullRequest> {
  try {
    const gitApi = await connection.getGitApi();
    const pullRequest = await gitApi.getPullRequest(
      args.repositoryId,
      args.pullRequestId,
      args.projectId
    );

    if (!pullRequest) {
      throw new AzureDevOpsResourceNotFoundError(
        `Pull request ${args.pullRequestId} not found in repository ${args.repositoryId}`
      );
    }

    return pullRequest;
  } catch (error) {
    if (error instanceof AzureDevOpsResourceNotFoundError) {
      throw error;
    }
    throw new Error(`Failed to get pull request: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List pull requests in a repository
 */
export async function listPullRequests(
  connection: WebApi,
  args: z.infer<typeof schemas.ListPullRequestsSchema>
): Promise<GitPullRequest[]> {
  try {
    const gitApi = await connection.getGitApi();
    const searchCriteria: GitPullRequestSearchCriteria = {
      status: args.status ? convertToPullRequestStatus(args.status) : undefined,
      creatorId: args.creatorId,
      reviewerId: args.reviewerId,
      sourceRefName: args.sourceRefName,
      targetRefName: args.targetRefName,
      includeLinks: args.includeLinks
    };

    const pullRequests = await gitApi.getPullRequests(
      args.repositoryId,
      searchCriteria,
      args.projectId
    );

    return pullRequests;
  } catch (error) {
    throw new Error(`Failed to list pull requests: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * List comments in a pull request
 */
export async function listPRComments(
  connection: WebApi,
  args: z.infer<typeof schemas.ListPRCommentsSchema>
): Promise<schemas.PullRequestCommentResponse[]> {
  try {
    console.error('[API] Attempting to list PR comments...');
    const gitApi = await connection.getGitApi();
    const threads = await gitApi.getThreads(
      args.repositoryId,
      args.pullRequestId,
      args.projectId
    );

    console.error('[API] Successfully retrieved PR threads');
    const comments = schemas.processPullRequestComments(threads);
    console.error(`[API] Processed ${comments.length} comments with replies`);
    return comments;
  } catch (error) {
    console.error('[Error] Failed to list PR comments:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to list PR comments: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update a pull request comment
 */
export async function updatePRComment(
  connection: WebApi,
  args: z.infer<typeof schemas.UpdatePRCommentSchema>
): Promise<GitPullRequestCommentThread> {
  try {
    const gitApi = await connection.getGitApi();
    const comment = { content: args.content };
    
    const updatedThread = await gitApi.updateComment(
      comment,
      args.repositoryId,
      args.pullRequestId,
      args.threadId,
      args.commentId,
      args.projectId
    );

    if (!updatedThread) {
      throw new AzureDevOpsResourceNotFoundError(
        `Comment ${args.commentId} not found in thread ${args.threadId}`
      );
    }

    return updatedThread;
  } catch (error) {
    if (error instanceof AzureDevOpsResourceNotFoundError) {
      throw error;
    }
    throw new Error(`Failed to update PR comment: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update a pull request thread status
 */
export async function updatePRThreadStatus(
  connection: WebApi,
  args: z.infer<typeof schemas.UpdatePRThreadStatusSchema>
): Promise<GitPullRequestCommentThread> {
  try {
    const gitApi = await connection.getGitApi();
    const thread = { status: convertToCommentThreadStatus(args.status) };
    
    const updatedThread = await gitApi.updateThread(
      thread,
      args.repositoryId,
      args.pullRequestId,
      args.threadId,
      args.projectId
    );

    if (!updatedThread) {
      throw new AzureDevOpsResourceNotFoundError(
        `Thread ${args.threadId} not found in pull request ${args.pullRequestId}`
      );
    }

    return updatedThread;
  } catch (error) {
    if (error instanceof AzureDevOpsResourceNotFoundError) {
      throw error;
    }
    throw new Error(`Failed to update thread status: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a new pull request comment thread
 */
export async function createPRComment(
  connection: WebApi,
  args: z.infer<typeof schemas.CreatePRCommentSchema>
): Promise<GitPullRequestCommentThread> {
  try {
    console.error('[API] Attempting to create new PR comment thread...');
    const gitApi = await connection.getGitApi();
    
    const comment = {
      content: args.content
    };

    const thread = {
      comments: [comment],
      threadContext: args.filePath && typeof args.lineNumber === 'number' ? {
        filePath: args.filePath,
        rightFileStart: { line: args.lineNumber, offset: 1 },
        rightFileEnd: { line: args.lineNumber, offset: 1 }
      } : args.filePath ? {
        filePath: args.filePath,
        rightFileStart: { line: 1, offset: 1 },
        rightFileEnd: { line: 1, offset: 1 }
      } : undefined
    };

    const newThread = await gitApi.createThread(
      thread,
      args.repositoryId,
      args.pullRequestId,
      args.projectId
    );

    if (!newThread) {
      console.error('[Error] Failed to create comment thread');
      throw new Error('Failed to create comment thread');
    }

    console.error('[API] Successfully created PR comment thread');
    return newThread;
  } catch (error) {
    console.error('[Error] Failed to create PR comment:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to create PR comment: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Reply to an existing pull request comment thread
 */
export async function replyToPRComment(
  connection: WebApi,
  args: z.infer<typeof schemas.ReplyToPRCommentSchema>
): Promise<GitPullRequestCommentThread> {
  try {
    console.error('[API] Attempting to reply to PR comment...');
    const gitApi = await connection.getGitApi();
    
    const comment = {
      content: args.content,
      commentType: CommentType.Text
    };

    const updatedThread = await gitApi.createComment(
      comment,
      args.repositoryId,
      args.pullRequestId,
      args.threadId,
      args.projectId
    );

    if (!updatedThread) {
      console.error('[Error] Failed to create reply in thread');
      throw new Error('Failed to create reply in thread');
    }

    console.error('[API] Successfully created PR comment reply');
    return updatedThread;
  } catch (error) {
    console.error('[Error] Failed to create PR comment reply:', error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to create PR comment reply: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get files changed in a pull request
 */
export async function getPRFiles(
  connection: WebApi,
  args: z.infer<typeof schemas.GetPRFilesSchema>
): Promise<GitPullRequestChange[]> {
  try {
    const gitApi = await connection.getGitApi();
    const iterations = await gitApi.getPullRequestIterations(
      args.repositoryId,
      args.pullRequestId,
      args.projectId
    );
    
    if (!iterations.length) {
      return [];
    }

    const latestIteration = iterations[iterations.length - 1];
    if (!latestIteration.id) {
      throw new Error('Latest iteration ID is missing');
    }

    const changes = await gitApi.getPullRequestIterationChanges(
      args.repositoryId,
      args.pullRequestId,
      latestIteration.id,
      args.projectId,
      undefined, // top
      undefined, // skip
      args.compareTo ? parseInt(args.compareTo) : undefined
    );

    if (!changes.changeEntries) {
      return [];
    }

    return changes.changeEntries;
  } catch (error) {
    throw new Error(`Failed to get PR files: ${error instanceof Error ? error.message : String(error)}`);
  }
}

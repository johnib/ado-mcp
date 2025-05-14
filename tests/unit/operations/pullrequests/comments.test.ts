import { WebApi } from 'azure-devops-node-api';
import { CommentThreadStatus, CommentType, GitPullRequestCommentThread } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { createPRComment, listPRComments, replyToPRComment } from '../../../../src/operations/pullrequests/operations';
import { PullRequestCommentResponse } from '../../../../src/operations/pullrequests/schemas';

describe('Pull Request Comments Operations', () => {
  const mockConnection = {
    getGitApi: jest.fn()
  } as unknown as WebApi;

  const mockGitApi = {
    createThread: jest.fn(),
    getThreads: jest.fn(),
    createComment: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mockConnection.getGitApi as jest.Mock).mockResolvedValue(mockGitApi);
  });

  describe('listPRComments', () => {
    it('should list comments with proper thread hierarchy', async () => {
      // Mock thread data
      const mockThread: GitPullRequestCommentThread = {
        id: 1,
        status: CommentThreadStatus.Active,
        threadContext: {
          filePath: '/src/test.ts'
        },
        comments: [
          {
            id: 1,
            content: 'Initial comment',
            author: { displayName: 'User1' },
            commentType: CommentType.Text
          },
          {
            id: 2,
            parentCommentId: 1,
            content: 'Reply to comment',
            author: { displayName: 'User2' },
            commentType: CommentType.Text
          }
        ]
      };

      mockGitApi.getThreads.mockResolvedValue([mockThread]);

      const result = await listPRComments(mockConnection, {
        repositoryId: 'repo1',
        pullRequestId: 123,
        projectId: 'project1'
      });

      expect(result.length).toBe(1);
      expect(result[0].replies?.length).toBe(1);
      expect(mockGitApi.getThreads).toHaveBeenCalledWith('repo1', 123, 'project1');
    });

    it('should handle empty threads', async () => {
      mockGitApi.getThreads.mockResolvedValue([]);

      const result = await listPRComments(mockConnection, {
        repositoryId: 'repo1',
        pullRequestId: 123,
        projectId: 'project1'
      });

      expect(result).toEqual([]);
    });

    it('should handle errors', async () => {
      mockGitApi.getThreads.mockRejectedValue(new Error('API Error'));

      await expect(listPRComments(mockConnection, {
        repositoryId: 'repo1',
        pullRequestId: 123,
        projectId: 'project1'
      })).rejects.toThrow('Failed to list PR comments: API Error');
    });
  });

  describe('createPRComment', () => {
    it('should create a new thread with comment', async () => {
      const mockNewThread: GitPullRequestCommentThread = {
        id: 1,
        comments: [{ content: 'Test comment' }]
      };

      mockGitApi.createThread.mockResolvedValue(mockNewThread);

      const result = await createPRComment(mockConnection, {
        repositoryId: 'repo1',
        pullRequestId: 123,
        projectId: 'project1',
        content: 'Test comment',
        filePath: '/src/test.ts',
        lineNumber: 10
      });

      expect(result).toBe(mockNewThread);
      expect(mockGitApi.createThread).toHaveBeenCalledWith(
        expect.objectContaining({
          comments: [{ content: 'Test comment' }],
          threadContext: {
            filePath: '/src/test.ts',
            rightFileStart: { line: 10, offset: 1 },
            rightFileEnd: { line: 10, offset: 1 }
          }
        }),
        'repo1',
        123,
        'project1'
      );
    });

    it('should handle errors', async () => {
      mockGitApi.createThread.mockRejectedValue(new Error('API Error'));

      await expect(createPRComment(mockConnection, {
        repositoryId: 'repo1',
        pullRequestId: 123,
        projectId: 'project1',
        content: 'Test comment'
      })).rejects.toThrow('Failed to create PR comment: API Error');
    });
  });

  describe('replyToPRComment', () => {
    it('should create a reply in existing thread', async () => {
      const mockUpdatedThread: GitPullRequestCommentThread = {
        id: 1,
        comments: [
          { content: 'Initial comment' },
          { content: 'Reply comment' }
        ]
      };

      mockGitApi.createComment.mockResolvedValue(mockUpdatedThread);

      const result = await replyToPRComment(mockConnection, {
        repositoryId: 'repo1',
        pullRequestId: 123,
        projectId: 'project1',
        threadId: 1,
        content: 'Reply comment'
      });

      expect(result).toBe(mockUpdatedThread);
      expect(mockGitApi.createComment).toHaveBeenCalledWith(
        {
          content: 'Reply comment',
          commentType: CommentType.Text
        },
        'repo1',
        123,
        1,
        'project1'
      );
    });

    it('should handle errors', async () => {
      mockGitApi.createComment.mockRejectedValue(new Error('API Error'));

      await expect(replyToPRComment(mockConnection, {
        repositoryId: 'repo1',
        pullRequestId: 123,
        projectId: 'project1',
        threadId: 1,
        content: 'Reply comment'
      })).rejects.toThrow('Failed to create PR comment reply: API Error');
    });
  });
});

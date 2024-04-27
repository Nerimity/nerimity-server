import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { rateLimit } from '../../middleware/rateLimit';
import { votePostPoll } from '../../services/Post';

export function postPollVote(Router: Router) {
  Router.post(
    '/posts/:postId/polls/:pollId/choices/:choiceId',
    authenticate(),
    rateLimit({
      name: 'post_poll_vote',
      restrictMS: 20000,
      requests: 5,
    }),

    route
  );
}

async function route(req: Request, res: Response) {
  const postId = req.params.postId as string;
  const pollId = req.params.pollId as string;
  const choiceId = req.params.choiceId as string;

  const [success, error] = await votePostPoll(req.userCache.id, postId, pollId, choiceId);

  if (error) {
    return res.status(403).json(error);
  }

  res.json({success});
}

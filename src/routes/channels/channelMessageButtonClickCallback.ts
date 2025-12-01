import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { buttonClick, buttonClickCallback } from '../../services/Message/Message';
import { body, oneOf } from 'express-validator';
import { customExpressValidatorResult, generateError } from '../../common/errorHandler';
import { type } from 'arktype';

const dropdownItemSchema = {
  id: 'string<50',
  label: 'string<100',
} as const;

const textComponent = type({
  type: "'text'",
  content: 'string<=500',
});

const dropdownComponent = type({
  type: "'dropdown'",
  items: [dropdownItemSchema],
});

const component = textComponent.or(dropdownComponent);

const baseSchema = type({
  userId: 'string<=255',
  'title?': 'string<=100',
});

const contentRequiredSchema = baseSchema.and({
  content: 'string<=500',
  'components?': [component, 'Array<4'],
});

const componentsRequiredSchema = baseSchema.and({
  'content?': 'string<=500',
  components: [component, 'Array<4'],
});

const buttonCallbackSchema = contentRequiredSchema.or(componentsRequiredSchema);

export type ButtonCallback = type.infer<typeof buttonCallbackSchema>;

export function channelMessageButtonClickCallback(Router: Router) {
  Router.post(
    '/channels/:channelId/messages/:messageId/buttons/:buttonId/callback',
    authenticate({ allowBot: true }),
    channelVerification(),

    rateLimit({
      name: 'button_click_callback',
      restrictMS: 30000,
      requests: 10,
    }),
    route
  );
}

interface RequestParams {
  channelId: string;
  messageId: string;
  buttonId: string;
}

async function route(req: Request, res: Response) {
  const { channelId, messageId, buttonId } = req.params as unknown as RequestParams;

  const body = buttonCallbackSchema.(req.body);

  if (body instanceof type.errors) {
    res.status(400).json(generateError(body[0]?.message ?? 'Invalid request body.'));
    return;
  }

  const [status, error] = await buttonClickCallback({
    channelId,
    messageId,
    buttonId,
    data: body,
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status });
}

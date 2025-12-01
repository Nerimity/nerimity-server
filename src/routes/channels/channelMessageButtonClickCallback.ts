import { Request, Response, Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { channelVerification } from '../../middleware/channelVerification';
import { rateLimit } from '../../middleware/rateLimit';
import { buttonClickCallback } from '../../services/Message/Message';
import { generateError } from '../../common/errorHandler';
import { type } from 'arktype';
import { addToObjectIfExists } from '@src/common/addToObjectIfExists';

const dropdownItemSchema = type({
  id: 'string<50',
  label: 'string<100',
});

const textComponent = type({
  id: 'string<=50',
  type: "'text'",
  content: 'string<=500',
});

const dropdownComponent = type({
  id: 'string<=50',
  type: "'dropdown'",
  'label?': 'string<=100',
  items: dropdownItemSchema.array().lessThanLength(20),
});

const inputComponent = type({
  id: 'string<=50',
  type: "'input'",
  'label?': 'string<=100',
  'placeholder?': 'string<=100',
});

const component = textComponent.or(dropdownComponent).or(inputComponent);

const baseSchema = type({
  userId: 'string<=255',
  'title?': 'string<=100',
  'buttonLabel?': 'string<=100',
});

const contentRequiredSchema = baseSchema.and({
  content: 'string<=500',
  'components?': component.array().lessThanLength(4),
});

const componentsRequiredSchema = baseSchema.and({
  'content?': 'string<=500',
  components: component.array().lessThanLength(4),
});

const buttonCallbackSchema = contentRequiredSchema.or(componentsRequiredSchema);

export type ButtonCallback = type.infer<typeof buttonCallbackSchema>;

const sanitizeButtonCallback = (data: ButtonCallback): ButtonCallback => {
  return {
    ...addToObjectIfExists('content', data.content),
    ...addToObjectIfExists('title', data.title),
    ...addToObjectIfExists('userId', data.userId),
    ...addToObjectIfExists('buttonLabel', data.buttonLabel),
    ...(data.components
      ? {
          components: data.components.map((component) => ({
            ...addToObjectIfExists('type', component.type),
            ...addToObjectIfExists('id', component.id),
            ...(component.type === 'input'
              ? {
                  ...addToObjectIfExists('label', component.label),
                  ...addToObjectIfExists('placeholder', component.placeholder),
                }
              : undefined),
            ...(component.type === 'text'
              ? {
                  content: component.content,
                }
              : undefined),
            ...(component.type === 'dropdown'
              ? {
                  ...addToObjectIfExists('label', component.label),
                  items: component.items.map((item) => ({
                    ...addToObjectIfExists('id', item.id),
                    ...addToObjectIfExists('label', item.label),
                  })),
                }
              : undefined),
          })),
        }
      : undefined),
  } as any;
};

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

  const body = buttonCallbackSchema(req.body);

  if (body instanceof type.errors) {
    res.status(400).json(generateError(body[0]?.message ?? 'Invalid request body.'));
    return;
  }

  const [status, error] = await buttonClickCallback({
    channelId,
    messageId,
    buttonId,
    data: sanitizeButtonCallback(body),
  });

  if (error) {
    return res.status(400).json(error);
  }

  res.json({ status });
}

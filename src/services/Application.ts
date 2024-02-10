import { prisma } from '../common/database';
import { generateError } from '../common/errorHandler';
import { generateId } from '../common/flakeId';

export async function createApplication(requesterAccountId: string) {
  const count = await prisma.application.count({
    where: { creatorAccountId: requesterAccountId },
  });

  if (count >= 10) {
    return [
      null,
      generateError('You already created the maximum amount of applications!'),
    ] as const;
  }

  const application = await prisma.application.create({
    data: {
      id: generateId(),
      name: 'Untitled ' + (count + 1),
      creatorAccountId: requesterAccountId,
    },
  });

  return [application, null] as const;
}

export async function getApplications(requesterAccountId: string) {
  const applications = await prisma.application.findMany({
    where: { creatorAccountId: requesterAccountId },
  });

  return [applications, null] as const;
}
export async function getApplication(requesterAccountId: string, id: string) {
  const application = await prisma.application.findUnique({
    where: { creatorAccountId: requesterAccountId, id },
  });

  if (!application) {
    return [null, generateError('Application not found!')] as const;
  }

  return [application, null] as const;
}

import { postJson, type ApiError } from './apiClient';

type CreateServerPayload = {
  name: string;
};

type CreateServerResponse = {
  id: string;
  name: string;
  defaultChannelId: string;
}

export const createServer = (payload: CreateServerPayload, token: string) =>
  postJson<CreateServerResponse>('/servers', {body: payload, token});


export const createServerInvite = (serverId: string, token: string) =>
  postJson<{code: string}>(`/servers/${serverId}/invites`, { token});


export const joinServerInvite = (code: string, token: string) =>
  postJson<{id: string; name: string;}>(`/servers/invites/${code}`, { token});


